package config

import (
	"strings"
	"testing"
)

const testProductionSecret = "8e7d4cbf3a19657204b8c12ae94f630d"

func configureStartup(t *testing.T) {
	t.Helper()
	t.Setenv("ENVIRONMENT", "production")
	t.Setenv("JWT_SECRET", testProductionSecret)
	t.Setenv("GOOGLE_CLIENT_ID", "test-client-id")
	t.Setenv("GOOGLE_CLIENT_SECRET", "test-client-secret")
	t.Setenv("DEV_AUTH_ENABLED", "false")
}

func requireStartupPanic(t *testing.T, field string) {
	t.Helper()
	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("unsafe configuration was accepted at startup")
		}
		message, ok := r.(string)
		if !ok || !strings.Contains(message, field) {
			t.Fatalf("startup error must identify %s without exposing values", field)
		}
	}()
	Load()
}

func TestProductionRejectsDevAuthAtStartup(t *testing.T) {
	configureStartup(t)
	t.Setenv("DEV_AUTH_ENABLED", "true")
	requireStartupPanic(t, "DEV_AUTH_ENABLED")
}

func TestProductionRejectsUnsafeJWTSecretAtStartup(t *testing.T) {
	for _, secret := range []string{
		"short-secret", "your-super-secret-jwt-key-min-32-chars",
		strings.Repeat("x", 64), strings.Repeat("abcd1234", 8), strings.Repeat("0123456789", 3) + "01",
		"   " + testProductionSecret, "replace-me-with-a-random-jwt-secret-key",
		"abcdefghijklmnopqrstuvwxyz0123456789",
		"9876543210zyxwvutsrqponmlkjihgfedcba",
		"0123456789abcdefghijklmnopqrstuvwxyz",
		"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!",
		"0123456789abcdef0123456789abcdef00",
		"qwertyuiopasdfghjklzxcvbnm12345678",
	} {
		t.Run(secret[:5], func(t *testing.T) {
			configureStartup(t)
			t.Setenv("JWT_SECRET", secret)
			requireStartupPanic(t, "JWT_SECRET")
		})
	}
}

func TestProductionConfigurationAcceptsRandomSecret(t *testing.T) {
	configureStartup(t)
	if !Load().IsProduction() {
		t.Fatal("expected production config")
	}
}

func TestProductionModeIgnoresWhitespaceAndCase(t *testing.T) {
	configureStartup(t)
	t.Setenv("ENVIRONMENT", " Production ")
	t.Setenv("DEV_AUTH_ENABLED", "true")
	requireStartupPanic(t, "DEV_AUTH_ENABLED")
}

func TestStagingAllowsExplicitDevAuth(t *testing.T) {
	configureStartup(t)
	t.Setenv("ENVIRONMENT", "staging")
	t.Setenv("DEV_AUTH_ENABLED", "true")
	t.Setenv("DEV_AUTH_CODE", "staging-verification-code")
	if cfg := Load(); cfg.IsProduction() || !cfg.DevAuthEnabled {
		t.Fatal("staging dev auth must remain available")
	}
}

func TestUnknownEnvironmentDoesNotBypassProductionValidation(t *testing.T) {
	configureStartup(t)
	t.Setenv("ENVIRONMENT", "prod")
	requireStartupPanic(t, "ENVIRONMENT")
}
