package services

import (
	"errors"
	"testing"

	"haroteru/backend/internal/config"
)

func TestProductionDevSignInFailsClosedEvenWithoutStartupValidation(t *testing.T) {
	svc := NewAuthService(&config.Config{
		Environment: "production", DevAuthEnabled: true, DevAuthCode: "verification-code",
	}, nil, nil)
	_, err := svc.DevSignIn("invalid-code")
	if !errors.Is(err, ErrDevAuthDisabled) {
		t.Fatalf("production dev auth must be disabled, got %v", err)
	}
}
