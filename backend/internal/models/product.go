package models

import (
	"time"

	"gorm.io/gorm"
)


type Product struct {
	ID          uint    `gorm:"primaryKey" json:"id"`
	Name        string  `gorm:"size:255;not null" json:"name"`
	Description string  `gorm:"type:text" json:"description"`
	Price       float64 `gorm:"not null;default:0" json:"price"`
	CostPrice   float64 `gorm:"not null;default:0" json:"cost_price"` 
	Stock       int     `gorm:"not null;default:0" json:"stock"`
	Size        string  `gorm:"size:50" json:"size"` 
	ParentID    *uint   `gorm:"index" json:"parent_id"`
	ImageURL    string  `gorm:"size:500" json:"image_url"`
	CategoryID  uint    `gorm:"index" json:"category_id"`
	BrandID    uint `gorm:"index" json:"brand_id"`
	ReorderLevel int `gorm:"not null;default:5" json:"reorder_level"`
	PrimarySupplierID *uint `gorm:"index" json:"primary_supplier_id"`

	
	IsService   bool   `gorm:"not null;default:false" json:"is_service"`
	PCD         string `gorm:"size:50" json:"pcd"`
	OffsetET    string `gorm:"size:20" json:"offset_et"`    
	Width       string `gorm:"size:20" json:"width"`        
	Bore        string `gorm:"size:20" json:"bore"`         
	Finish      string `gorm:"size:100" json:"finish"`      
	SpeedRating string `gorm:"size:10" json:"speed_rating"` 
	LoadIndex   string `gorm:"size:10" json:"load_index"`   
	DOTCode     string `gorm:"size:20" json:"dot_code"`     
	PlyRating   string `gorm:"size:10" json:"ply_rating"`   

	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	
	Category Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Brand    Brand    `gorm:"foreignKey:BrandID" json:"brand,omitempty"`
}

func (Product) TableName() string {
	return "products"
}
