package services

import (
	"fmt"

	"haroteru/backend/internal/repositories"
)

type UserService struct {
	users         *repositories.UserRepository
	subscriptions *repositories.TrackedSubscriptionRepository
}

func NewUserService(users *repositories.UserRepository, subscriptions *repositories.TrackedSubscriptionRepository) *UserService {
	return &UserService{users: users, subscriptions: subscriptions}
}

type MeResponse struct {
	ID              string                        `json:"id"`
	Email           string                        `json:"email"`
	Name            string                        `json:"name"`
	AvatarURL       string                        `json:"avatarUrl"`
	Theme           string                        `json:"theme"`
	UseGoogleAvatar bool                          `json:"useGoogleAvatar"`
	Summary         repositories.DashboardSummary `json:"summary"`
}

type UpdatePreferencesInput struct {
	Theme           *string `json:"theme"`
	UseGoogleAvatar *bool   `json:"useGoogleAvatar"`
}

func (s *UserService) UpdatePreferences(userID string, input UpdatePreferencesInput) (*MeResponse, error) {
	updates := map[string]interface{}{}
	if input.Theme != nil {
		updates["theme"] = *input.Theme
	}
	if input.UseGoogleAvatar != nil {
		updates["use_google_avatar"] = *input.UseGoogleAvatar
	}
	if len(updates) == 0 {
		return s.GetMe(userID)
	}
	if _, err := s.users.UpdatePreferences(userID, updates); err != nil {
		return nil, fmt.Errorf("updating preferences: %w", err)
	}
	return s.GetMe(userID)
}

func (s *UserService) DeleteAccount(userID string) error {
	return s.users.Delete(userID)
}

func (s *UserService) GetMe(userID string) (*MeResponse, error) {
	user, err := s.users.FindByID(userID)
	if err != nil {
		return nil, fmt.Errorf("finding user: %w", err)
	}

	summary, err := s.subscriptions.Summary(userID)
	if err != nil {
		return nil, fmt.Errorf("loading user summary: %w", err)
	}

	return &MeResponse{
		ID:              user.ID,
		Email:           user.Email,
		Name:            user.Name,
		AvatarURL:       user.AvatarURL,
		Theme:           user.Theme,
		UseGoogleAvatar: user.UseGoogleAvatar,
		Summary:         *summary,
	}, nil
}
