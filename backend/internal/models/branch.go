package models

import (
	"time"
)


type Branch struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Code      string    `gorm:"size:50;unique;not null" json:"code"`
	Address   string    `gorm:"size:500" json:"address"`
	Phone     string    `gorm:"size:50" json:"phone"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Branch) TableName() string {
	return "branches"
}
