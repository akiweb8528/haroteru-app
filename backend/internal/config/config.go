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
		DatabaseURL:        mustGetEnv("DATABASE_URL"),
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
