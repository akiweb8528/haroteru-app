package jwt_test

import (
	"strings"
	"testing"
	"time"

	jwtpkg "haroteru/backend/pkg/jwt"

	"github.com/golang-jwt/jwt/v5"
)

func TestSignAccessToken_ClaimsAreCorrect(t *testing.T) {
	svc := jwtpkg.NewService("test-secret-32-characters-long!!")

	token, err := svc.SignAccessToken("user-123", "user@example.com", "free")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	claims, err := svc.Verify(token)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if claims.UserID != "user-123" {
		t.Errorf("UserID: got %q, want %q", claims.UserID, "user-123")
	}
	if claims.Email != "user@example.com" {
		t.Errorf("Email: got %q, want %q", claims.Email, "user@example.com")
	}
	if claims.Tier != "free" {
		t.Errorf("Tier: got %q, want %q", claims.Tier, "free")
	}
	if claims.Type != "access" {
		t.Errorf("Type: got %q, want %q", claims.Type, "access")
	}
}

func TestSignRefreshToken_TypeIsRefresh(t *testing.T) {
	svc := jwtpkg.NewService("test-secret-32-characters-long!!")

	token, err := svc.SignRefreshToken("user-456")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	claims, err := svc.Verify(token)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if claims.Type != "refresh" {
		t.Errorf("Type: got %q, want %q", claims.Type, "refresh")
	}
	if claims.UserID != "user-456" {
		t.Errorf("UserID: got %q, want %q", claims.UserID, "user-456")
	}
	// refresh token には email/tier が含まれない
	if claims.Email != "" {
		t.Errorf("Email should be empty in refresh token, got %q", claims.Email)
	}
}

func TestVerify_WrongSecret_ReturnsError(t *testing.T) {
	svc1 := jwtpkg.NewService("secret-A-32-characters-long!!!!!!")
	svc2 := jwtpkg.NewService("secret-B-32-characters-long!!!!!!")

	token, err := svc1.SignAccessToken("user-1", "a@example.com", "free")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	_, err = svc2.Verify(token)
	if err == nil {
		t.Fatal("expected error when verifying with wrong secret, got nil")
	}
}

func TestVerify_MalformedToken_ReturnsError(t *testing.T) {
	svc := jwtpkg.NewService("test-secret-32-characters-long!!")

	_, err := svc.Verify("not.a.valid.token")
	if err == nil {
		t.Fatal("expected error for malformed token, got nil")
	}
}

func TestVerify_ExpiredToken_ReturnsError(t *testing.T) {
	svc := jwtpkg.NewService("test-secret-32-characters-long!!")

	// 過去に期限切れとなるトークンを手動で生成する
	secret := []byte("test-secret-32-characters-long!!")
	claims := &jwtpkg.Claims{
		UserID: "user-expired",
		Email:  "expired@example.com",
		Tier:   "free",
		Type:   "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString(secret)
	if err != nil {
		t.Fatalf("failed to sign expired token: %v", err)
	}

	_, err = svc.Verify(tokenStr)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestAccessTokenAndRefreshToken_AreDifferent(t *testing.T) {
	svc := jwtpkg.NewService("test-secret-32-characters-long!!")

	access, _ := svc.SignAccessToken("uid", "u@example.com", "free")
	refresh, _ := svc.SignRefreshToken("uid")

	if access == refresh {
		t.Fatal("access token and refresh token should not be identical")
	}
	// アクセストークンは3セクション(header.payload.sig)
	if strings.Count(access, ".") != 2 {
		t.Errorf("expected 3 sections in access token, got: %q", access)
	}
}
