package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port               string
	Environment        string
	DatabaseURL        string
	JWTSecret          string
	GoogleClientID     string
	GoogleClientSecret string
	FrontendURL        string
	DevAuthEnabled     bool
	DevAuthCode        string
	DevAuthEmail       string
	DevAuthName        string
}

func Load() *Config {
	return &Config{
		Port:               getEnv("PORT", "8080"),
		Environment:        getEnv("ENVIRONMENT", "development"),
		DatabaseURL:        resolveDatabaseURL(),
		JWTSecret:          mustGetEnv("JWT_SECRET"),
		GoogleClientID:     mustGetEnv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: mustGetEnv("GOOGLE_CLIENT_SECRET"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:3000"),
		DevAuthEnabled:     getEnv("DEV_AUTH_ENABLED", "false") == "true",
		DevAuthCode:        getEnv("DEV_AUTH_CODE", ""),
		DevAuthEmail:       getEnv("DEV_AUTH_EMAIL", "dev-signin@haroteru.local"),
		DevAuthName:        getEnv("DEV_AUTH_NAME", "検証ユーザー"),
	}
}

func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

func getEnv(key, defaultValue string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return defaultValue
}

func mustGetEnv(key string) string {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		panic(fmt.Sprintf("required environment variable %q is not set", key))
	}
	return v
}

func resolveDatabaseURL() string {
	if v, ok := os.LookupEnv("DATABASE_URL"); ok && v != "" {
		return v
	}

	user := getEnv("POSTGRES_USER", "haroteru_user")
	password := getEnv("POSTGRES_PASSWORD", "haroteru_password")
	dbName := getEnv("POSTGRES_DB", "haroteru_db")
	host := getEnv("POSTGRES_HOST", "localhost")
	port := getEnv("POSTGRES_PORT", "5432")
	sslMode := getEnv("POSTGRES_SSLMODE", "disable")

	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		user,
		password,
		host,
		port,
		dbName,
		sslMode,
	)
}
