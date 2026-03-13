package models

import (
	"time"
)


type Brand struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:255;not null;uniqueIndex" json:"name"`
	LogoURL   string    `gorm:"size:500" json:"logo_url"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Brand) TableName() string {
	return "brands"
}
