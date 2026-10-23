package repositories

import (
	"errors"
	"fmt"

	"haroteru/backend/internal/models"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) FindByID(id string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("finding user by id: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) FindByGoogleID(googleID string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, "google_id = ?", googleID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("finding user by google_id: %w", err)
	}
	return &user, nil
}

func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, "email = ?", email).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("finding user by email: %w", err)
	}
	return &user, nil
}

// UpdatePreferences updates theme and/or use_google_avatar for a user.
func (r *UserRepository) UpdatePreferences(id string, updates map[string]interface{}) (*models.User, error) {
	if err := r.db.Model(&models.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, fmt.Errorf("updating user preferences: %w", err)
	}
	return r.FindByID(id)
}

// Delete removes a user and all associated synced data.
func (r *UserRepository) Delete(id string) error {
	result := r.db.Delete(&models.User{}, "id = ?", id)
	if result.Error != nil {
		return fmt.Errorf("deleting user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// Upsert creates a new user or updates name and avatar_url if they already exist (matched by google_id).
func (r *UserRepository) Upsert(user *models.User) error {
	result := r.db.Where(models.User{GoogleID: user.GoogleID}).
		Assign(models.User{
			Email:     user.Email,
			Name:      user.Name,
			AvatarURL: user.AvatarURL,
		}).
		FirstOrCreate(user)
	if result.Error != nil {
		return fmt.Errorf("upserting user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		// Record existed — update mutable fields
		if err := r.db.Model(user).Updates(map[string]interface{}{
			"name":       user.Name,
			"avatar_url": user.AvatarURL,
		}).Error; err != nil {
			return fmt.Errorf("updating user: %w", err)
		}
	}
	return nil
}


