package database

import (
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

func TestMigration000005PreservesExistingUsersAndSubscriptions(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is required for PostgreSQL migration integration tests")
	}
	admin, err := Connect(dsn)
	if err != nil {
		t.Fatal(err)
	}
	adminSQL, err := admin.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { adminSQL.Close() })
	schema := fmt.Sprintf("migration_test_%d", time.Now().UnixNano())
	if err := admin.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := admin.Exec("DROP SCHEMA " + schema + " CASCADE").Error; err != nil {
			t.Error(err)
		}
	})
	parsed, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	dsn = parsed.String()
	source, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	migrator, err := migrate.NewWithSourceInstance("iofs", source, normalizeMigrationDatabaseURL(dsn))
	if err != nil {
		t.Fatal(err)
	}
	if err := migrator.Migrate(4); err != nil {
		migrator.Close()
		t.Fatal(err)
	}
	if sourceErr, databaseErr := migrator.Close(); sourceErr != nil || databaseErr != nil {
		t.Fatalf("closing version 4 migrator: %v %v", sourceErr, databaseErr)
	}
	db, err := Connect(dsn)
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { sqlDB.Close() })
	const owner = "11111111-1111-4111-8111-111111111111"
	if err := db.Exec(`INSERT INTO users
		(id, google_id, email, name, avatar_url, theme, use_google_avatar, taste, created_at, updated_at)
		VALUES (?, 'existing-google-identity', 'existing@example.invalid', '既存ユーザー',
		'https://example.invalid/avatar', 'dark', false, 'simple', '2026-09-01T01:02:03Z', '2026-09-02T04:05:06Z')`, owner).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO tracked_subscriptions
		(user_id, name, amount_yen, billing_cycle, category, review_priority, locked, billing_day, note, position, created_at, updated_at)
		VALUES (?, '継続中の年間プラン', 12345, 'yearly', 'music', 'high', true, 31,
		'保持するメモ', 7, '2026-09-01T01:02:03Z', '2026-09-02T04:05:06Z'),
		(?, 'カテゴリ未設定', 678, 'monthly', NULL, 'low', false, NULL,
		'', 8, '2026-09-03T01:02:03Z', '2026-09-04T04:05:06Z')`, owner, owner).Error; err != nil {
		t.Fatal(err)
	}
	snapshot := func(subscriptionExpression string) string {
		t.Helper()
		var value string
		statement := `SELECT jsonb_build_object(
			'users', (SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM users u),
			'subscriptions', (SELECT jsonb_agg(` + subscriptionExpression + ` ORDER BY id) FROM tracked_subscriptions s)
		)::text`
		if err := db.Raw(statement).Scan(&value).Error; err != nil {
			t.Fatal(err)
		}
		return value
	}
	before := snapshot("to_jsonb(s)")
	for range 2 {
		if err := RunMigrations(dsn); err != nil {
			t.Fatal(err)
		}
		if after := snapshot("to_jsonb(s) - 'create_operation_id'"); after != before {
			t.Fatalf("migration changed existing data:\nbefore: %s\nafter: %s", before, after)
		}
	}
	var version struct {
		Version int
		Dirty   bool
	}
	if err := db.Raw("SELECT version, dirty FROM schema_migrations").Scan(&version).Error; err != nil {
		t.Fatal(err)
	}
	if version.Version != 5 || version.Dirty {
		t.Fatalf("unexpected migration state: %+v", version)
	}
	var count int64
	if err := db.Raw("SELECT COUNT(*) FROM tracked_subscriptions WHERE create_operation_id IS NOT NULL").Scan(&count).Error; err != nil || count != 0 {
		t.Fatalf("legacy rows acquired operation identities: count=%d error=%v", count, err)
	}
	if err := db.Raw("SELECT COUNT(*) FROM subscription_operation_receipts").Scan(&count).Error; err != nil || count != 0 {
		t.Fatalf("migration invented operation receipts: count=%d error=%v", count, err)
	}
}
