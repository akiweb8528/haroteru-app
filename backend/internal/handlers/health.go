package handlers

import (
	"net/http"

	"haroteru/backend/internal/database"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type HealthHandler struct {
	db *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Liveness(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func (h *HealthHandler) Readiness(c echo.Context) error {
	if err := database.Ping(h.db); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"status": "unavailable",
			"reason": "database unreachable",
		})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
}

