package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"haroteru/backend/internal/database"
	"haroteru/backend/internal/models"
	"haroteru/backend/internal/repositories"

	"gorm.io/gorm"
)

func operationTestService(t *testing.T) (*TrackedSubscriptionService, *gorm.DB) {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is required for PostgreSQL receipt integration tests")
	}
	admin, err := database.Connect(dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("operation_test_%d", time.Now().UnixNano())
	if err := admin.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Exec("DROP SCHEMA " + schema + " CASCADE"); sql, _ := admin.DB(); sql.Close() })
	parsed, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := parsed.Query()
	q.Set("search_path", schema)
	parsed.RawQuery = q.Encode()
	if err := database.RunMigrations(parsed.String()); err != nil {
		t.Fatal(err)
	}
	db, err := database.Connect(parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sql, _ := db.DB(); sql.Close() })
	for _, id := range []string{ownerA, ownerB} {
		if err := db.Create(&models.User{ID: id, GoogleID: id, Email: id + "@example.invalid", Name: id}).Error; err != nil {
			t.Fatal(err)
		}
	}
	return NewTrackedSubscriptionService(repositories.NewTrackedSubscriptionRepository(db)), db
}

const ownerA = "11111111-1111-4111-8111-111111111111"
const ownerB = "22222222-2222-4222-8222-222222222222"

func TestCreateOperationIdentityIsReturnedByCreateAndList(t *testing.T) {
	svc, _ := operationTestService(t)
	created, err := svc.Create(ownerA, testCreateInput(), "create-identity")
	if err != nil {
		t.Fatal(err)
	}
	assertIdentity := func(item *models.TrackedSubscription, expected string) {
		t.Helper()
		encoded, err := json.Marshal(item)
		if err != nil {
			t.Fatal(err)
		}
		var data map[string]any
		if err := json.Unmarshal(encoded, &data); err != nil {
			t.Fatal(err)
		}
		if expected == "" {
			if _, exists := data["createOperationId"]; exists {
				t.Fatalf("legacy create acquired operation metadata: %s", encoded)
			}
		} else if data["createOperationId"] != expected {
			t.Fatalf("create operation identity missing from response: %s", encoded)
		}
	}
	assertIdentity(created, "create-identity")
	replayed, err := svc.Create(ownerA, testCreateInput(), "create-identity")
	if err != nil {
		t.Fatal(err)
	}
	assertIdentity(replayed, "create-identity")
	listed, err := svc.List(ownerA, repositories.SubscriptionFilter{Page: 1, Limit: 200})
	if err != nil || len(listed.Data) != 1 {
		t.Fatalf("list failed: %+v %v", listed, err)
	}
	assertIdentity(&listed.Data[0], "create-identity")
	legacy, err := svc.Create(ownerA, testCreateInput())
	if err != nil {
		t.Fatal(err)
	}
	assertIdentity(legacy, "")
}

func testCreateInput() *CreateTrackedSubscriptionInput {
	return &CreateTrackedSubscriptionInput{Name: "Music", AmountYen: 1000, BillingCycle: models.BillingCycleMonthly, ReviewPriority: models.PriorityMedium}
}

func TestOperationReceipts_PreserveMutationsAcrossLostResponses(t *testing.T) {
	svc, db := operationTestService(t)
	input := testCreateInput()
	created, err := svc.Create(ownerA, input, "create-1")
	if err != nil {
		t.Fatal(err)
	}
	replayed, err := svc.Create(ownerA, input, "create-1")
	if err != nil || replayed.ID != created.ID {
		t.Fatalf("create replay: %+v %v", replayed, err)
	}
	changed := *input
	changed.Name = "Changed"
	if _, err := svc.Create(ownerA, &changed, "create-1"); !errors.Is(err, repositories.ErrOperationConflict) {
		t.Fatalf("conflicting payload: %v", err)
	}
	other, err := svc.Create(ownerB, input, "create-1")
	if err != nil || other.ID == created.ID {
		t.Fatalf("owner-scoped identity: %+v %v", other, err)
	}
	if _, err := svc.Update(created.ID, ownerB, &UpdateTrackedSubscriptionInput{}, "foreign-update"); !errors.Is(err, repositories.ErrNotFound) {
		t.Fatalf("foreign owner update: %v", err)
	}

	first, last := "First edit", "Latest edit"
	if _, err := svc.Update(created.ID, ownerA, &UpdateTrackedSubscriptionInput{Name: &first}, "update-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(created.ID, ownerA, &UpdateTrackedSubscriptionInput{Name: &last}, "update-2"); err != nil {
		t.Fatal(err)
	}
	response, err := svc.Update(created.ID, ownerA, &UpdateTrackedSubscriptionInput{Name: &first}, "update-1")
	if err != nil || response.Name != first {
		t.Fatalf("original response: %+v %v", response, err)
	}
	current, err := svc.GetByID(created.ID, ownerA)
	if err != nil || current.Name != last {
		t.Fatalf("late retry overwrote current value: %+v %v", current, err)
	}

	if err := svc.Delete(created.ID, ownerA, "delete-1"); err != nil {
		t.Fatal(err)
	}
	if err := svc.Delete(created.ID, ownerA, "delete-1"); err != nil {
		t.Fatal(err)
	}
	if err := svc.Delete(created.ID, ownerA, "legacy-already-deleted"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Create(ownerA, input, "create-1"); err != nil {
		t.Fatal(err)
	}
	var count int64
	db.Model(&models.TrackedSubscription{}).Where("user_id = ?", ownerA).Count(&count)
	if count != 0 {
		t.Fatalf("late create replay resurrected deleted row: %d", count)
	}
}

func TestOperationReceipts_RollbackPartialReorderAndRetry(t *testing.T) {
	svc, _ := operationTestService(t)
	created, err := svc.Create(ownerA, testCreateInput(), "create-1")
	if err != nil {
		t.Fatal(err)
	}
	input := &ReorderInput{}
	input.Items = append(input.Items, struct {
		ID       string `json:"id" validate:"required"`
		Position int    `json:"position" validate:"min=0"`
	}{created.ID, 9})
	input.Items = append(input.Items, struct {
		ID       string `json:"id" validate:"required"`
		Position int    `json:"position" validate:"min=0"`
	}{"invalid-uuid", 0})
	if err := svc.Reorder(ownerA, input, "reorder-1"); err == nil {
		t.Fatal("expected second write to fail")
	}
	current, err := svc.GetByID(created.ID, ownerA)
	if err != nil || current.Position != 0 {
		t.Fatalf("partial success committed: %+v %v", current, err)
	}
	input.Items = input.Items[:1]
	if err := svc.Reorder(ownerA, input, "reorder-1"); err != nil {
		t.Fatalf("failed receipt blocked retry: %v", err)
	}
	newer := *input
	newer.Items = append(newer.Items[:0:0], input.Items...)
	newer.Items[0].Position = 3
	if err := svc.Reorder(ownerA, &newer, "reorder-2"); err != nil {
		t.Fatal(err)
	}
	if err := svc.Reorder(ownerA, input, "reorder-1"); err != nil {
		t.Fatal(err)
	}
	current, err = svc.GetByID(created.ID, ownerA)
	if err != nil || current.Position != 3 {
		t.Fatalf("late reorder replay overwrote current position: %+v %v", current, err)
	}
}

func TestOperationReceipts_ConcurrentCreateRetries(t *testing.T) {
	svc, db := operationTestService(t)
	var wg sync.WaitGroup
	ids := make(chan string, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			item, err := svc.Create(ownerA, testCreateInput(), "concurrent-create")
			if err != nil {
				t.Error(err)
				return
			}
			ids <- item.ID
		}()
	}
	wg.Wait()
	close(ids)
	var first string
	for id := range ids {
		if first == "" {
			first = id
		}
		if id != first {
			t.Fatalf("distinct results: %s %s", first, id)
		}
	}
	var count int64
	db.Model(&models.TrackedSubscription{}).Where("user_id = ?", ownerA).Count(&count)
	if count != 1 {
		t.Fatalf("duplicate create rows: %d", count)
	}
}

func TestOperationReceipts_ReplayPrecedesChangedValidationPolicy(t *testing.T) {
	svc, _ := operationTestService(t)
	input := testCreateInput()
	original, err := svc.Create(ownerA, input, "create-1")
	if err != nil {
		t.Fatal(err)
	}
	invalid := errors.New("validation policy changed")
	rejecting := svc.WithValidator(func(any) error { return invalid })
	replayed, err := rejecting.Create(ownerA, input, "create-1")
	if err != nil || replayed.ID != original.ID {
		t.Fatalf("committed receipt rejected by later validation: %+v %v", replayed, err)
	}
	if _, err := rejecting.Create(ownerA, input, "create-2"); !errors.Is(err, invalid) {
		t.Fatalf("new operation skipped validation: %v", err)
	}
	if _, err := svc.Create(ownerA, input, "create-2"); err != nil {
		t.Fatalf("rejected validation left a receipt: %v", err)
	}
}
