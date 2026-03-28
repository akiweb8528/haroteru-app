package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"haroteru/backend/internal/middleware"
	"haroteru/backend/internal/repositories"
	"haroteru/backend/internal/services"

	"github.com/labstack/echo/v4"
)

type TrackedSubscriptionHandler struct {
	svc *services.TrackedSubscriptionService
}

func NewTrackedSubscriptionHandler(svc *services.TrackedSubscriptionService) *TrackedSubscriptionHandler {
	return &TrackedSubscriptionHandler{svc: svc}
}

func (h *TrackedSubscriptionHandler) List(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)

	f := repositories.SubscriptionFilter{
		Search:         c.QueryParam("search"),
		Category:       c.QueryParam("category"),
		BillingCycle:   c.QueryParam("billingCycle"),
		ReviewPriority: c.QueryParam("reviewPriority"),
		SortBy:         c.QueryParam("sort"),
		SortOrder:      c.QueryParam("order"),
		Page:           queryInt(c, "page", 1),
		Limit:          queryInt(c, "limit", 50),
	}

	if locked := c.QueryParam("locked"); locked != "" {
		v := locked == "true"
		f.Locked = &v
	}

	result, err := h.svc.List(userID, f)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスク一覧の取得に失敗しました"))
	}

	return c.JSON(http.StatusOK, result)
}

func (h *TrackedSubscriptionHandler) Create(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)

	var input services.CreateTrackedSubscriptionInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_body", "Invalid request body"))
	}
	if err := c.Validate(&input); err != nil {
		return err
	}

	item, err := h.svc.Create(userID, &input)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスクの登録に失敗しました"))
	}

	return c.JSON(http.StatusCreated, item)
}

func (h *TrackedSubscriptionHandler) GetByID(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)
	id := c.Param("id")

	item, err := h.svc.GetByID(id, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, errorResponse("not_found", "サブスクが見つかりません"))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスクの取得に失敗しました"))
	}

	return c.JSON(http.StatusOK, item)
}

func (h *TrackedSubscriptionHandler) Update(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)
	id := c.Param("id")

	var input services.UpdateTrackedSubscriptionInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_body", "Invalid request body"))
	}
	if err := c.Validate(&input); err != nil {
		return err
	}

	item, err := h.svc.Update(id, userID, &input)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, errorResponse("not_found", "サブスクが見つかりません"))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスクの更新に失敗しました"))
	}

	return c.JSON(http.StatusOK, item)
}

func (h *TrackedSubscriptionHandler) Delete(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)
	id := c.Param("id")

	if err := h.svc.Delete(id, userID); err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return echo.NewHTTPError(http.StatusNotFound, errorResponse("not_found", "サブスクが見つかりません"))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスクの削除に失敗しました"))
	}

	return c.NoContent(http.StatusNoContent)
}

func (h *TrackedSubscriptionHandler) Reorder(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)

	var input services.ReorderInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_body", "Invalid request body"))
	}
	if err := c.Validate(&input); err != nil {
		return err
	}

	if err := h.svc.Reorder(userID, &input); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスクの並び替えに失敗しました"))
	}

	return c.NoContent(http.StatusNoContent)
}

func queryInt(c echo.Context, key string, defaultVal int) int {
	v := c.QueryParam(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		return defaultVal
	}
	return n
}
