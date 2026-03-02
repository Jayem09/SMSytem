package models

import (
	"time"
)

// Product represents an item available for sale.
type Product struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:255;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Price       float64   `gorm:"not null;default:0" json:"price"`
	Stock       int       `gorm:"not null;default:0" json:"stock"`
	ImageURL    string    `gorm:"size:500" json:"image_url"`
	CategoryID  uint      `gorm:"index" json:"category_id"`
	BrandID     uint      `gorm:"index" json:"brand_id"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	Category Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Brand    Brand    `gorm:"foreignKey:BrandID" json:"brand,omitempty"`
}

func (Product) TableName() string {
	return "products"
}
