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

	limit := queryInt(c, "limit", 50)
	if limit > 200 {
		limit = 200
	}
	f := repositories.SubscriptionFilter{
		Search:         c.QueryParam("search"),
		Category:       c.QueryParam("category"),
		BillingCycle:   c.QueryParam("billingCycle"),
		ReviewPriority: c.QueryParam("reviewPriority"),
		SortBy:         c.QueryParam("sort"),
		SortOrder:      c.QueryParam("order"),
		Page:           queryInt(c, "page", 1),
		Limit:          limit,
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

	item, err := h.svc.WithContext(c.Request().Context()).WithValidator(c.Validate).Create(userID, &input, c.Request().Header.Get("Idempotency-Key"))
	if err != nil {
		if operationErr := subscriptionOperationError(err); operationErr != nil {
			return operationErr
		}
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

	item, err := h.svc.WithContext(c.Request().Context()).WithValidator(c.Validate).Update(id, userID, &input, c.Request().Header.Get("Idempotency-Key"))
	if err != nil {
		if operationErr := subscriptionOperationError(err); operationErr != nil {
			return operationErr
		}
		if errors.Is(err, repositories.ErrNotFound) {
			code := "not_found"
			if c.Request().Header.Get("Idempotency-Key") != "" {
				code = "subscription_not_found"
			}
			return echo.NewHTTPError(http.StatusNotFound, errorResponse(code, "サブスクが見つかりません"))
		}
		return echo.NewHTTPError(http.StatusInternalServerError, errorResponse("internal_error", "サブスクの更新に失敗しました"))
	}

	return c.JSON(http.StatusOK, item)
}

func (h *TrackedSubscriptionHandler) Delete(c echo.Context) error {
	userID := middleware.UserIDFromContext(c)
	id := c.Param("id")

	if err := h.svc.WithContext(c.Request().Context()).Delete(id, userID, c.Request().Header.Get("Idempotency-Key")); err != nil {
		if operationErr := subscriptionOperationError(err); operationErr != nil {
			return operationErr
		}
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

	if err := h.svc.WithContext(c.Request().Context()).WithValidator(c.Validate).Reorder(userID, &input, c.Request().Header.Get("Idempotency-Key")); err != nil {
		if operationErr := subscriptionOperationError(err); operationErr != nil {
			return operationErr
		}
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

func subscriptionOperationError(err error) error {
	var httpError *echo.HTTPError
	if errors.As(err, &httpError) {
		return httpError
	}
	if errors.Is(err, repositories.ErrOperationConflict) {
		return echo.NewHTTPError(http.StatusConflict, errorResponse("operation_conflict", "同じ同期操作を異なる内容で送信できません"))
	}
	if errors.Is(err, repositories.ErrInvalidOperationID) {
		return echo.NewHTTPError(http.StatusBadRequest, errorResponse("invalid_operation_id", "同期操作の識別子が不正です"))
	}
	return nil
}
