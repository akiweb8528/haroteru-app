package router

import (
	"net/http"

	"haroteru/backend/internal/handlers"
	"haroteru/backend/internal/middleware"
	customvalidator "haroteru/backend/pkg/validator"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func Setup(
	e *echo.Echo,
	authMW *middleware.AuthMiddleware,
	health *handlers.HealthHandler,
	auth *handlers.AuthHandler,
	users *handlers.UserHandler,
	subscriptions *handlers.TrackedSubscriptionHandler,
	frontendURL string,
	production bool,
) {
	e.Validator = customvalidator.New()
	e.HideBanner = true
	e.HidePort = true

	e.Use(echomw.RequestID())
	e.Use(echomw.Recover())
	e.Use(middleware.SecurityHeaders(production))
	e.Use(middleware.CORS(frontendURL))
	e.Use(echomw.LoggerWithConfig(echomw.LoggerConfig{
		Format: `{"time":"${time_rfc3339}","id":"${id}","method":"${method}","uri":"${uri}","status":${status},"latency_ms":${latency_human}}` + "\n",
	}))

	globalRL := middleware.NewRateLimiter(100, 200)
	e.Use(globalRL.Middleware())

	e.GET("/health", health.Liveness)
	e.GET("/health/ready", health.Readiness)

	v1 := e.Group("/api/v1")
	authRL := middleware.NewRateLimiter(5, 10)
	authGroup := v1.Group("/auth")
	authGroup.Use(authRL.Middleware())
	authGroup.POST("/google", auth.GoogleSignIn)
	authGroup.POST("/dev", auth.DevSignIn)
	authGroup.POST("/refresh", auth.RefreshToken)

	protected := v1.Group("")
	protected.Use(authMW.Require())

	protected.GET("/users/me", users.GetMe)
	protected.PATCH("/users/me", users.UpdatePreferences)
	protected.DELETE("/users/me", users.DeleteAccount)

	protected.GET("/subscriptions", subscriptions.List)
	protected.POST("/subscriptions", subscriptions.Create)
	protected.GET("/subscriptions/:id", subscriptions.GetByID)
	protected.PATCH("/subscriptions/:id", subscriptions.Update)
	protected.DELETE("/subscriptions/:id", subscriptions.Delete)
	protected.PATCH("/subscriptions/reorder", subscriptions.Reorder)

	e.RouteNotFound("/*", func(c echo.Context) error {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error":   "not_found",
			"message": "The requested endpoint does not exist",
		})
	})
}
