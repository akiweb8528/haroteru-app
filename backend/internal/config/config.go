package config

import (
	"fmt"
	"os"
	"strings"
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
	cfg := &Config{
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
	if err := cfg.validate(); err != nil {
		panic(err.Error())
	}
	return cfg
}

func (c *Config) IsProduction() bool {
	return strings.EqualFold(strings.TrimSpace(c.Environment), "production")
}

func (c *Config) validate() error {
	switch strings.ToLower(strings.TrimSpace(c.Environment)) {
	case "development", "test", "staging", "production":
	default:
		return fmt.Errorf("ENVIRONMENT must be development, test, staging, or production")
	}
	if c.IsProduction() && c.DevAuthEnabled {
		return fmt.Errorf("DEV_AUTH_ENABLED must be false in production")
	}
	if c.DevAuthEnabled && strings.TrimSpace(c.DevAuthCode) == "" {
		return fmt.Errorf("DEV_AUTH_CODE is required when DEV_AUTH_ENABLED is true")
	}
	if c.IsProduction() && !suitableProductionJWTSecret(c.JWTSecret) {
		return fmt.Errorf("JWT_SECRET must be a randomly generated secret of at least 32 bytes, without whitespace, placeholders, or repeated patterns")
	}
	return nil
}

func suitableProductionJWTSecret(secret string) bool {
	if len(secret) < 32 || strings.ContainsAny(secret, " \t\r\n") {
		return false
	}
	lower := strings.ToLower(secret)
	for _, marker := range []string{"your-", "your_", "your ", "changeme", "change-me", "change_me", "replace", "example", "sample", "default", "development", "playwright", "secret", "password", "insecure"} {
		if strings.Contains(lower, marker) {
			return false
		}
	}
	unique := make(map[rune]bool)
	for _, ch := range secret {
		unique[ch] = true
	}
	if len(unique) < 8 {
		return false
	}
	// Long alphabet, digit and keyboard runs remain predictable even with a suffix.
	for _, sequence := range []string{"0123456789", "0123456789abcdef", "abcdefghijklmnopqrstuvwxyz", "abcdefghijklmnopqrstuvwxyz0123456789", "0123456789abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm"} {
		for direction := 0; direction < 2; direction++ {
			if direction == 1 {
				bytes := []byte(sequence)
				for i, j := 0, len(bytes)-1; i < j; i, j = i+1, j-1 {
					bytes[i], bytes[j] = bytes[j], bytes[i]
				}
				sequence = string(bytes)
			}
			run := strings.Repeat(sequence, 3)
			for start := 0; start < len(sequence); start++ {
				if strings.Contains(lower, run[start:start+16]) {
					return false
				}
			}
		}
	}
	for size := 1; size <= len(secret)/2; size++ {
		repeated := true
		for i := size; i < len(secret); i++ {
			if secret[i] != secret[i%size] {
				repeated = false
				break
			}
		}
		if repeated {
			return false
		}
	}
	return true
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
