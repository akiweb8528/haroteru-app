package models

import "time"

type User struct {
	ID              string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	GoogleID        string    `gorm:"column:google_id;uniqueIndex;not null"          json:"-"`
	Email           string    `gorm:"uniqueIndex;not null"                           json:"email"`
	Name            string    `gorm:"not null"                                       json:"name"`
	AvatarURL       string    `gorm:"column:avatar_url;not null;default:''"          json:"avatarUrl"`
	Theme           string    `gorm:"column:theme;not null;default:'light'"          json:"theme"`
	UseGoogleAvatar bool      `gorm:"column:use_google_avatar;not null;default:true" json:"useGoogleAvatar"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func (User) TableName() string { return "users" }
