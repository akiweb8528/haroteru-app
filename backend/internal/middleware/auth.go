package middleware

import (
	"net/http"
	"strings"

	jwtpkg "haroteru/backend/pkg/jwt"

	"github.com/labstack/echo/v4"
)

const UserIDKey = "user_id"
const UserEmailKey = "user_email"
const UserTierKey = "user_tier"

type AuthMiddleware struct {
	jwt *jwtpkg.Service
}

func NewAuthMiddleware(jwt *jwtpkg.Service) *AuthMiddleware {
	return &AuthMiddleware{jwt: jwt}
}

// Require returns an Echo middleware that validates the Bearer JWT in the Authorization header.
func (m *AuthMiddleware) Require() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Authorization header is required",
				})
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Authorization header format must be 'Bearer <token>'",
				})
			}

			claims, err := m.jwt.Verify(parts[1])
			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Invalid or expired token",
				})
			}

			if claims.Type != "access" {
				return echo.NewHTTPError(http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Token is not an access token",
				})
			}

			c.Set(UserIDKey, claims.UserID)
			c.Set(UserEmailKey, claims.Email)
			c.Set(UserTierKey, claims.Tier)

			return next(c)
		}
	}
}

// UserIDFromContext extracts the authenticated user's ID from the Echo context.
func UserIDFromContext(c echo.Context) string {
	id, _ := c.Get(UserIDKey).(string)
	return id
}

