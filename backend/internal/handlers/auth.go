package handlers

import (
	"errors"
	"net/http"

	"haroteru/backend/internal/services"

	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	svc *services.AuthService
}

func NewAuthHandler(svc *services.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

type googleSignInRequest struct {
	IDToken string `json:"id_token" validate:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type devSignInRequest struct {
	Code string `json:"code" validate:"required"`
}

// GoogleSignIn exchanges a Google ID token for backend JWT tokens.
func (h *AuthHandler) GoogleSignIn(c echo.Context) error {
	var req googleSignInRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_body", "Invalid request body"))
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	resp, err := h.svc.GoogleSignIn(c.Request().Context(), req.IDToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, errorResponse("auth_failed", err.Error()))
	}

	return c.JSON(http.StatusOK, resp)
}

// DevSignIn exchanges a verification code for backend JWT tokens when dev auth is enabled.
func (h *AuthHandler) DevSignIn(c echo.Context) error {
	var req devSignInRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_body", "Invalid request body"))
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	resp, err := h.svc.DevSignIn(req.Code)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrDevAuthDisabled):
			return echo.NewHTTPError(http.StatusForbidden, errorResponse("dev_auth_disabled", "Dev auth is disabled"))
		case errors.Is(err, services.ErrInvalidDevCode):
			return echo.NewHTTPError(http.StatusUnauthorized, errorResponse("invalid_dev_code", "Invalid verification code"))
		default:
			return echo.NewHTTPError(http.StatusUnauthorized, errorResponse("auth_failed", err.Error()))
		}
	}

	return c.JSON(http.StatusOK, resp)
}

// RefreshToken issues a new access token from a valid refresh token.
func (h *AuthHandler) RefreshToken(c echo.Context) error {
	var req refreshRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_body", "Invalid request body"))
	}
	if err := c.Validate(&req); err != nil {
		return err
	}

	newAccessToken, err := h.svc.RefreshToken(req.RefreshToken)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, errorResponse("refresh_failed", "Invalid or expired refresh token"))
	}

	return c.JSON(http.StatusOK, map[string]string{
		"access_token": newAccessToken,
	})
}

func errorResponse(code, message string) map[string]string {
	return map[string]string{"error": code, "message": message}
}

