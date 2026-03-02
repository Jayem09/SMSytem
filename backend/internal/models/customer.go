package models

import (
	"time"
)

// Customer represents a buyer or client.
type Customer struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"size:255;not null" json:"name"`
	Email     string    `gorm:"size:255" json:"email"`
	Phone     string    `gorm:"size:50" json:"phone"`
	Address   string    `gorm:"type:text" json:"address"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Customer) TableName() string {
	return "customers"
}
