package database

import (
	"errors"
	"embed"
	"fmt"
	"net/url"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/hashicorp/go-multierror"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Connect opens a GORM database connection using pgx driver.
func Connect(databaseURL string) (*gorm.DB, error) {
	databaseURL = normalizeDatabaseURL(databaseURL)

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  databaseURL,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("getting sql.DB: %w", err)
	}

	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)

	return db, nil
}

// RunMigrations applies all pending up-migrations embedded in the binary.
func RunMigrations(databaseURL string) error {
	databaseURL = normalizeMigrationDatabaseURL(databaseURL)

	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("creating iofs migration source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, databaseURL)
	if err != nil {
		return fmt.Errorf("creating migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && !isIgnorableMigrationError(err) {
		return fmt.Errorf("running migrations: %w", err)
	}

	return nil
}

// Ping verifies the database connection is alive.
func Ping(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}

func normalizeDatabaseURL(rawURL string) string {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	if !isPostgresScheme(parsedURL.Scheme) {
		return rawURL
	}

	parsedURL.RawQuery = normalizePostgresQuery(parsedURL, false).Encode()

	return parsedURL.String()
}

func normalizeMigrationDatabaseURL(rawURL string) string {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}

	if !isPostgresScheme(parsedURL.Scheme) {
		return rawURL
	}

	parsedURL.Scheme = "pgx5"
	parsedURL.RawQuery = normalizePostgresQuery(parsedURL, true).Encode()

	return parsedURL.String()
}

func normalizePostgresQuery(parsedURL *url.URL, forMigrations bool) url.Values {
	query := parsedURL.Query()

	if isNeonHost(parsedURL.Hostname()) && query.Get("sslmode") == "" {
		query.Set("sslmode", "require")
	}

	if forMigrations && query.Get("default_query_exec_mode") == "" {
		query.Set("default_query_exec_mode", "simple_protocol")
	}

	return query
}

func isIgnorableMigrationError(err error) bool {
	if err == nil {
		return true
	}

	var multiErr *multierror.Error
	if errors.As(err, &multiErr) {
		for _, wrappedErr := range multiErr.Errors {
			if wrappedErr == nil || errors.Is(wrappedErr, migrate.ErrNoChange) {
				continue
			}

			if !isIgnorableAdvisoryUnlockError(wrappedErr) {
				return false
			}
		}

		return true
	}

	return errors.Is(err, migrate.ErrNoChange)
}

func isIgnorableAdvisoryUnlockError(err error) bool {
	if err == nil {
		return false
	}

	message := err.Error()
	return strings.Contains(message, "SELECT pg_advisory_unlock($1)") &&
		strings.Contains(message, "unnamed prepared statement does not exist")
}

func isPostgresScheme(scheme string) bool {
	switch strings.ToLower(scheme) {
	case "postgres", "postgresql":
		return true
	default:
		return false
	}
}

func isNeonHost(host string) bool {
	host = strings.ToLower(host)
	return strings.HasSuffix(host, ".neon.tech") || strings.HasSuffix(host, ".aws.neon.tech")
}
