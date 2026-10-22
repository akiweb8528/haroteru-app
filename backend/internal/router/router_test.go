package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"haroteru/backend/internal/handlers"
	"haroteru/backend/internal/middleware"
	jwtpkg "haroteru/backend/pkg/jwt"

	"github.com/labstack/echo/v4"
)

func TestProductionDoesNotRegisterDevAuthRoute(t *testing.T) {
	e := echo.New()
	Setup(e, nil, nil, nil, nil, nil, "https://app.example.com", true, true)
	recorder := httptest.NewRecorder()
	e.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/auth/dev", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("production must not expose dev auth, got %d", recorder.Code)
	}
}

func TestSyncMutationRoutesRequireAuthenticationAndAnOperationKey(t *testing.T) {
	jwt := jwtpkg.NewService("router-test-key")
	token, err := jwt.SignAccessToken("11111111-1111-4111-8111-111111111111", "test@example.invalid", "free")
	if err != nil {
		t.Fatal(err)
	}
	for _, route := range []struct{ method, path string }{
		{http.MethodPost, "/api/v1/sync/subscriptions"},
		{http.MethodPatch, "/api/v1/sync/subscriptions/item"},
		{http.MethodDelete, "/api/v1/sync/subscriptions/item"},
		{http.MethodPatch, "/api/v1/sync/subscriptions/reorder"},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			e := echo.New()
			Setup(e, middleware.NewAuthMiddleware(jwt), nil, nil, nil, handlers.NewTrackedSubscriptionHandler(nil), "https://app.example.com", false, false)
			request := httptest.NewRequest(route.method, route.path, strings.NewReader("{}"))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Idempotency-Key", "operation-1")
			recorder := httptest.NewRecorder()
			e.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusUnauthorized {
				t.Fatalf("sync route must authenticate, got %d", recorder.Code)
			}
			request = httptest.NewRequest(route.method, route.path, strings.NewReader("{}"))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+token)
			recorder = httptest.NewRecorder()
			e.ServeHTTP(recorder, request)
			if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "missing_operation_id") {
				t.Fatalf("sync route must reject missing key before mutation, got %d %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func TestSyncMutationWithKeyReachesTheReceiptHandler(t *testing.T) {
	jwt := jwtpkg.NewService("router-test-key")
	token, err := jwt.SignAccessToken("11111111-1111-4111-8111-111111111111", "test@example.invalid", "free")
	if err != nil {
		t.Fatal(err)
	}
	e := echo.New()
	Setup(e, middleware.NewAuthMiddleware(jwt), nil, nil, nil, handlers.NewTrackedSubscriptionHandler(nil), "https://app.example.com", false, false)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/sync/subscriptions", strings.NewReader("invalid-json"))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Idempotency-Key", "operation-1")
	recorder := httptest.NewRecorder()
	e.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "invalid_body") {
		t.Fatalf("keyed sync route did not reach mutation handler: %d %s", recorder.Code, recorder.Body.String())
	}
}
