package models

import (
	"time"
)

// User represents a system user with role-based access.
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Email     string    `gorm:"size:255;not null;uniqueIndex" json:"email"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	Role      string    `gorm:"size:50;default:user" json:"role"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName sets the MySQL table name.
func (User) TableName() string {
	return "users"
}
