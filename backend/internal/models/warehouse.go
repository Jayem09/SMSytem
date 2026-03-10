package models

import (
	"time"

	"gorm.io/gorm"
)

// Warehouse represents a physical storage location.
type Warehouse struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"size:255;not null" json:"name"`
	Address   string         `gorm:"type:text" json:"address"`
	Contact   string         `gorm:"size:255" json:"contact"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Warehouse) TableName() string {
	return "warehouses"
}
