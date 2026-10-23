package google

import (
	"context"
	"fmt"

	"google.golang.org/api/idtoken"
)

// Payload contains the verified claims from a Google ID token.
type Payload struct {
	Sub           string
	Email         string
	Name          string
	Picture       string
	EmailVerified bool
}

// VerifyIDToken validates a Google ID token against the given audience (Google Client ID).
// It uses Google's public JWKS endpoint with built-in caching.
func VerifyIDToken(ctx context.Context, idToken, audience string) (*Payload, error) {
	payload, err := idtoken.Validate(ctx, idToken, audience)
	if err != nil {
		return nil, fmt.Errorf("invalid google id token: %w", err)
	}

	claims := payload.Claims

	sub, _ := claims["sub"].(string)
	if sub == "" {
		return nil, fmt.Errorf("google id token missing sub claim")
	}

	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	picture, _ := claims["picture"].(string)
	emailVerified, _ := claims["email_verified"].(bool)

	return &Payload{
		Sub:           sub,
		Email:         email,
		Name:          name,
		Picture:       picture,
		EmailVerified: emailVerified,
	}, nil
}
