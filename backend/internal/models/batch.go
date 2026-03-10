package models

import (
	"time"

	"gorm.io/gorm"
)

// Batch represents a specific group of inventory items with an expiry date.
type Batch struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	ProductID   uint           `gorm:"not null;index" json:"product_id"`
	WarehouseID uint           `gorm:"not null;index" json:"warehouse_id"`
	BatchNumber string         `gorm:"size:100;index" json:"batch_number"` // Optional tracking code
	Quantity    int            `gorm:"not null;default:0" json:"quantity"`
	ExpiryDate  *time.Time     `json:"expiry_date"` // Optional
	CreatedAt   time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Product   Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Warehouse Warehouse `gorm:"foreignKey:WarehouseID" json:"warehouse,omitempty"`
}

func (Batch) TableName() string {
	return "batches"
}
