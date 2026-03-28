package validator

import (
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

// CustomValidator wraps go-playground/validator for use with Echo.
type CustomValidator struct {
	v *validator.Validate
}

func New() *CustomValidator {
	return &CustomValidator{v: validator.New()}
}

func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.v.Struct(i); err != nil {
		var details []map[string]string
		for _, e := range err.(validator.ValidationErrors) {
			details = append(details, map[string]string{
				"field":   e.Field(),
				"message": fieldErrorMessage(e),
			})
		}
		return echo.NewHTTPError(http.StatusUnprocessableEntity, map[string]interface{}{
			"error":   "validation_error",
			"message": "Request validation failed",
			"details": details,
		})
	}
	return nil
}

func fieldErrorMessage(e validator.FieldError) string {
	switch e.Tag() {
	case "required":
		return e.Field() + " is required"
	case "min":
		return e.Field() + " must be at least " + e.Param() + " characters"
	case "max":
		return e.Field() + " must be at most " + e.Param() + " characters"
	case "email":
		return e.Field() + " must be a valid email address"
	case "oneof":
		return e.Field() + " must be one of: " + e.Param()
	default:
		return e.Field() + " is invalid"
	}
}
