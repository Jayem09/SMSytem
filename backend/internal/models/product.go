package models

import (
	"time"

	"gorm.io/gorm"
)

// Product represents an item available for sale.
type Product struct {
	ID          uint    `gorm:"primaryKey" json:"id"`
	Name        string  `gorm:"size:255;not null" json:"name"`
	Description string  `gorm:"type:text" json:"description"`
	Price       float64 `gorm:"not null;default:0" json:"price"`
	CostPrice   float64 `gorm:"not null;default:0" json:"cost_price"` // How much you pay the supplier
	Stock       int     `gorm:"not null;default:0" json:"stock"`
	Size        string  `gorm:"size:50" json:"size"` // e.g., "225/45 R17"
	ParentID    *uint   `gorm:"index" json:"parent_id"`
	ImageURL    string  `gorm:"size:500" json:"image_url"`
	CategoryID  uint    `gorm:"index" json:"category_id"`
	BrandID     uint    `gorm:"index" json:"brand_id"`

	// Industry Specific & Services
	IsService   bool   `gorm:"not null;default:false" json:"is_service"`
	PCD         string `gorm:"size:50" json:"pcd"`
	OffsetET    string `gorm:"size:20" json:"offset_et"`    // e.g. "ET45"
	Width       string `gorm:"size:20" json:"width"`        // e.g. "8.5J"
	Bore        string `gorm:"size:20" json:"bore"`         // Center bore e.g. "73.1"
	Finish      string `gorm:"size:100" json:"finish"`      // e.g. "Matte Black"
	SpeedRating string `gorm:"size:10" json:"speed_rating"` // e.g. "V"
	LoadIndex   string `gorm:"size:10" json:"load_index"`   // e.g. "91"
	DOTCode     string `gorm:"size:20" json:"dot_code"`     // e.g. "DOT 1223"
	PlyRating   string `gorm:"size:10" json:"ply_rating"`   // e.g. "10PR"

	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Category Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Brand    Brand    `gorm:"foreignKey:BrandID" json:"brand,omitempty"`
}

func (Product) TableName() string {
	return "products"
}
