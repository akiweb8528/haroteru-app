package handlers

import (
	"errors"
	"net/http"

	"haroteru/backend/internal/middleware"
	"haroteru/backend/internal/repositories"
	"haroteru/backend/internal/services"

	"github.com/labstack/echo/v4"
)

type UserHandler struct {
	svc *services.UserService
}

func NewUserHandler(svc *services.UserService) *UserHandler {
	return &UserHandler{svc: svc}
}

func (h *UserHandler) UpdatePreferences(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)

	var req services.UpdatePreferencesInput
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_input", "Invalid request body"))
	}

	if req.Theme != nil && *req.Theme != "light" && *req.Theme != "dark" {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_input", "Theme must be 'light' or 'dark'"))
	}
	if req.Taste != nil && *req.Taste != "ossan" && *req.Taste != "simple" {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_input", "Taste must be 'ossan' or 'simple'"))
	}

	me, err := h.svc.UpdatePreferences(userID, req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "Failed to update preferences"))
	}

	return c.JSON(http.StatusOK, me)
}

func (h *UserHandler) DeleteAccount(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)

	if err := h.svc.DeleteAccount(userID); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, errorResponse("not_found", "User not found"))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "Failed to delete account"))
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *UserHandler) GetMe(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)

	me, err := h.svc.GetMe(userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "Failed to retrieve user"))
	}

	return c.JSON(http.StatusOK, me)
}
