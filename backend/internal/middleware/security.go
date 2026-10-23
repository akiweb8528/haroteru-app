package middleware

import (
	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

// SecurityHeaders adds baseline security headers to every response.
func SecurityHeaders(production bool) echo.MiddlewareFunc {
	config := echomw.SecureConfig{
		XSSProtection:      "1; mode=block",
		ContentTypeNosniff: "nosniff",
		XFrameOptions:      "SAMEORIGIN",
		ReferrerPolicy:     "strict-origin-when-cross-origin",
	}

	if production {
		config.HSTSMaxAge = 31536000
		config.HSTSPreloadEnabled = true
	}

	return echomw.SecureWithConfig(config)
}
