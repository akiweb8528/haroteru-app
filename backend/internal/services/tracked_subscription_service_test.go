package services

import (
	"errors"
	"testing"

	"haroteru/backend/internal/models"
	"haroteru/backend/internal/repositories"
)

// ---- mock ----------------------------------------------------------------

type mockSubscriptionRepo struct {
	listFn     func(userID string, f repositories.SubscriptionFilter) (*repositories.SubscriptionListResult, error)
	createFn   func(item *models.TrackedSubscription) error
	findByIDFn func(id, userID string) (*models.TrackedSubscription, error)
	updateFn   func(item *models.TrackedSubscription, fields map[string]any) error
	deleteFn   func(id, userID string) error
	reorderFn  func(userID string, items []repositories.ReorderItem) error
	summaryFn  func(userID string) (*repositories.DashboardSummary, error)
}

func (m *mockSubscriptionRepo) List(userID string, f repositories.SubscriptionFilter) (*repositories.SubscriptionListResult, error) {
	return m.listFn(userID, f)
}
func (m *mockSubscriptionRepo) Create(item *models.TrackedSubscription) error {
	return m.createFn(item)
}
func (m *mockSubscriptionRepo) FindByID(id, userID string) (*models.TrackedSubscription, error) {
	return m.findByIDFn(id, userID)
}
func (m *mockSubscriptionRepo) Update(item *models.TrackedSubscription, fields map[string]any) error {
	return m.updateFn(item, fields)
}
func (m *mockSubscriptionRepo) Delete(id, userID string) error {
	return m.deleteFn(id, userID)
}
func (m *mockSubscriptionRepo) Reorder(userID string, items []repositories.ReorderItem) error {
	return m.reorderFn(userID, items)
}
func (m *mockSubscriptionRepo) Summary(userID string) (*repositories.DashboardSummary, error) {
	return m.summaryFn(userID)
}

func newTestService(repo *mockSubscriptionRepo) *TrackedSubscriptionService {
	return &TrackedSubscriptionService{subscriptions: repo}
}

// ---- List / TotalPages ---------------------------------------------------

func TestList_ExactDivision_TotalPagesCorrect(t *testing.T) {
	// total=50, limit=10 → 5 ページぴったり
	svc := newTestService(&mockSubscriptionRepo{
		listFn: func(userID string, f repositories.SubscriptionFilter) (*repositories.SubscriptionListResult, error) {
			return &repositories.SubscriptionListResult{
				Total:         50,
				Subscriptions: make([]models.TrackedSubscription, 10),
				Summary:       repositories.DashboardSummary{},
			}, nil
		},
	})

	resp, err := svc.List("uid", repositories.SubscriptionFilter{Page: 1, Limit: 10})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Meta.TotalPages != 5 {
		t.Errorf("TotalPages: got %d, want 5", resp.Meta.TotalPages)
	}
}

func TestList_WithRemainder_TotalPagesRoundsUp(t *testing.T) {
	// total=51, limit=10 → 6 ページ (切り上げ)
	svc := newTestService(&mockSubscriptionRepo{
		listFn: func(userID string, f repositories.SubscriptionFilter) (*repositories.SubscriptionListResult, error) {
			return &repositories.SubscriptionListResult{
				Total:         51,
				Subscriptions: make([]models.TrackedSubscription, 10),
				Summary:       repositories.DashboardSummary{},
			}, nil
		},
	})

	resp, err := svc.List("uid", repositories.SubscriptionFilter{Page: 1, Limit: 10})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Meta.TotalPages != 6 {
		t.Errorf("TotalPages: got %d, want 6", resp.Meta.TotalPages)
	}
}

func TestList_SingleItem_TotalPagesIsOne(t *testing.T) {
	svc := newTestService(&mockSubscriptionRepo{
		listFn: func(_ string, _ repositories.SubscriptionFilter) (*repositories.SubscriptionListResult, error) {
			return &repositories.SubscriptionListResult{
				Total:         1,
				Subscriptions: []models.TrackedSubscription{{Name: "Netflix"}},
				Summary:       repositories.DashboardSummary{},
			}, nil
		},
	})

	resp, err := svc.List("uid", repositories.SubscriptionFilter{Page: 1, Limit: 50})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Meta.TotalPages != 1 {
		t.Errorf("TotalPages: got %d, want 1", resp.Meta.TotalPages)
	}
	if len(resp.Data) != 1 {
		t.Errorf("Data length: got %d, want 1", len(resp.Data))
	}
}

// ---- Update / field mapping ----------------------------------------------

func TestUpdate_NoFields_ReturnsExistingItemWithoutCalling(t *testing.T) {
	existing := &models.TrackedSubscription{ID: "sub-1", Name: "Netflix", AmountYen: 1490}
	updateCalled := false

	svc := newTestService(&mockSubscriptionRepo{
		findByIDFn: func(id, _ string) (*models.TrackedSubscription, error) {
			return existing, nil
		},
		updateFn: func(_ *models.TrackedSubscription, _ map[string]any) error {
			updateCalled = true
			return nil
		},
	})

	result, err := svc.Update("sub-1", "uid", &UpdateTrackedSubscriptionInput{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updateCalled {
		t.Error("Update should not be called when no fields changed")
	}
	if result.Name != "Netflix" {
		t.Errorf("Name: got %q, want %q", result.Name, "Netflix")
	}
}

func TestUpdate_ClearBillingDay_SetsNil(t *testing.T) {
	day := 15
	existing := &models.TrackedSubscription{ID: "sub-2", Name: "Spotify", BillingDay: &day}

	var capturedFields map[string]any
	svc := newTestService(&mockSubscriptionRepo{
		findByIDFn: func(_, _ string) (*models.TrackedSubscription, error) {
			return existing, nil
		},
		updateFn: func(_ *models.TrackedSubscription, fields map[string]any) error {
			capturedFields = fields
			return nil
		},
		// 2回目の FindByID (更新後の取得)
	})
	// 2回目 findByID が呼ばれるため findByIDFn を上書き
	callCount := 0
	updated := &models.TrackedSubscription{ID: "sub-2", Name: "Spotify", BillingDay: nil}
	svc = newTestService(&mockSubscriptionRepo{
		findByIDFn: func(_, _ string) (*models.TrackedSubscription, error) {
			callCount++
			if callCount == 1 {
				return existing, nil
			}
			return updated, nil
		},
		updateFn: func(_ *models.TrackedSubscription, fields map[string]any) error {
			capturedFields = fields
			return nil
		},
	})

	_, err := svc.Update("sub-2", "uid", &UpdateTrackedSubscriptionInput{ClearBillingDay: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v, ok := capturedFields["billing_day"]; !ok || v != nil {
		t.Errorf("billing_day should be nil in update fields, got: %v (present=%v)", v, ok)
	}
}

func TestUpdate_PartialFields_OnlyChangedFieldsSent(t *testing.T) {
	existing := &models.TrackedSubscription{ID: "sub-3", Name: "Old", AmountYen: 500}
	newName := "New"
	var capturedFields map[string]any
	callCount := 0
	svc := newTestService(&mockSubscriptionRepo{
		findByIDFn: func(_, _ string) (*models.TrackedSubscription, error) {
			callCount++
			if callCount == 1 {
				return existing, nil
			}
			return &models.TrackedSubscription{ID: "sub-3", Name: "New", AmountYen: 500}, nil
		},
		updateFn: func(_ *models.TrackedSubscription, fields map[string]any) error {
			capturedFields = fields
			return nil
		},
	})

	_, err := svc.Update("sub-3", "uid", &UpdateTrackedSubscriptionInput{Name: &newName})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(capturedFields) != 1 {
		t.Errorf("expected 1 field updated, got %d: %v", len(capturedFields), capturedFields)
	}
	if capturedFields["name"] != "New" {
		t.Errorf("name field: got %v, want %q", capturedFields["name"], "New")
	}
	if _, hasAmount := capturedFields["amount_yen"]; hasAmount {
		t.Error("amount_yen should not be in update fields when unchanged")
	}
}

// ---- Delete --------------------------------------------------------------

func TestDelete_PropagatesRepoError(t *testing.T) {
	svc := newTestService(&mockSubscriptionRepo{
		deleteFn: func(_, _ string) error {
			return repositories.ErrNotFound
		},
	})

	err := svc.Delete("non-existent", "uid")
	if !errors.Is(err, repositories.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got: %v", err)
	}
}

// ---- Create --------------------------------------------------------------

func TestCreate_MapsInputFieldsToModel(t *testing.T) {
	var created *models.TrackedSubscription
	category := models.CategoryVideo
	svc := newTestService(&mockSubscriptionRepo{
		createFn: func(item *models.TrackedSubscription) error {
			created = item
			return nil
		},
	})

	input := &CreateTrackedSubscriptionInput{
		Name:           "YouTube Premium",
		AmountYen:      1280,
		BillingCycle:   models.BillingCycleMonthly,
		Category:       &category,
		ReviewPriority: models.PriorityMedium,
		Locked:         true,
		Note:           "家族プラン",
	}
	result, err := svc.Create("uid-99", input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Name != "YouTube Premium" {
		t.Errorf("Name: got %q", result.Name)
	}
	if created.UserID != "uid-99" {
		t.Errorf("UserID: got %q, want %q", created.UserID, "uid-99")
	}
	if !created.Locked {
		t.Error("Locked should be true")
	}
	if created.Note != "家族プラン" {
		t.Errorf("Note: got %q", created.Note)
	}
}
