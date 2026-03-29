package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

// CORS returns a configured CORS middleware that allows requests from the given frontend origin.
func CORS(frontendURL string) echo.MiddlewareFunc {
	origins := []string{}
	for _, origin := range strings.Split(frontendURL, ",") {
		trimmed := strings.TrimSpace(origin)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	if len(origins) == 0 {
		origins = append(origins, "http://localhost:3000")
	}

	return echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           86400,
	})
}
