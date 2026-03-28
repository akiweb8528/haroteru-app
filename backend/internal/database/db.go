package database

import (
	"embed"
	"fmt"
	"net/url"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
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
	databaseURL = normalizeDatabaseURL(databaseURL)

	src, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("creating iofs migration source: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, databaseURL)
	if err != nil {
		return fmt.Errorf("creating migrator: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
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

	if !isPostgresScheme(parsedURL.Scheme) || !isNeonHost(parsedURL.Hostname()) {
		return rawURL
	}

	query := parsedURL.Query()
	if query.Get("sslmode") == "" {
		query.Set("sslmode", "require")
	}
	parsedURL.RawQuery = query.Encode()

	return parsedURL.String()
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
