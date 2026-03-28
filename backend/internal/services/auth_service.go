package services

import (
	"context"
	"fmt"

	"haroteru/backend/internal/config"
	"haroteru/backend/internal/models"
	"haroteru/backend/internal/repositories"
	googleverify "haroteru/backend/pkg/google"
	jwtpkg "haroteru/backend/pkg/jwt"
)

type AuthService struct {
	cfg   *config.Config
	jwt   *jwtpkg.Service
	users *repositories.UserRepository
}

func NewAuthService(cfg *config.Config, jwt *jwtpkg.Service, users *repositories.UserRepository) *AuthService {
	return &AuthService{cfg: cfg, jwt: jwt, users: users}
}

type AuthResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	User         *UserDTO `json:"user"`
}

type UserDTO struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
	Tier      string `json:"tier"`
}

func (s *AuthService) GoogleSignIn(ctx context.Context, idToken string) (*AuthResponse, error) {
	payload, err := googleverify.VerifyIDToken(ctx, idToken, s.cfg.GoogleClientID)
	if err != nil {
		return nil, fmt.Errorf("verifying google token: %w", err)
	}
	if !payload.EmailVerified {
		return nil, fmt.Errorf("google account email is not verified")
	}

	user := &models.User{
		GoogleID:  payload.Sub,
		Email:     payload.Email,
		Name:      payload.Name,
		AvatarURL: payload.Picture,
	}
	if err := s.users.Upsert(user); err != nil {
		return nil, fmt.Errorf("upserting user: %w", err)
	}

	accessToken, err := s.jwt.SignAccessToken(user.ID, user.Email, "free")
	if err != nil {
		return nil, fmt.Errorf("signing access token: %w", err)
	}
	refreshToken, err := s.jwt.SignRefreshToken(user.ID)
	if err != nil {
		return nil, fmt.Errorf("signing refresh token: %w", err)
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: &UserDTO{
			ID:        user.ID,
			Email:     user.Email,
			Name:      user.Name,
			AvatarURL: user.AvatarURL,
			Tier:      "free",
		},
	}, nil
}

func (s *AuthService) RefreshToken(refreshToken string) (string, error) {
	claims, err := s.jwt.Verify(refreshToken)
	if err != nil {
		return "", fmt.Errorf("invalid refresh token: %w", err)
	}
	if claims.Type != "refresh" {
		return "", fmt.Errorf("token is not a refresh token")
	}

	user, err := s.users.FindByID(claims.UserID)
	if err != nil {
		return "", fmt.Errorf("finding user: %w", err)
	}

	newAccessToken, err := s.jwt.SignAccessToken(user.ID, user.Email, "free")
	if err != nil {
		return "", fmt.Errorf("signing access token: %w", err)
	}
	return newAccessToken, nil
}
