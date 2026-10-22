package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

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
