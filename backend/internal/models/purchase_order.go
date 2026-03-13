package models

import (
	"time"
)


type PurchaseOrder struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	SupplierID   *uint      `gorm:"index" json:"supplier_id"`                       
	UserID       uint       `gorm:"index;not null" json:"user_id"`                  
	Status       string     `gorm:"size:50;not null;default:pending" json:"status"` 
	PONumber     string     `gorm:"size:100" json:"po_number"`                      
	TotalCost    float64    `gorm:"not null;default:0" json:"total_cost"`
	OrderDate    time.Time  `gorm:"not null" json:"order_date"`
	ReceivedDate *time.Time `json:"received_date"`
	Notes        string     `gorm:"type:text" json:"notes"`
	CreatedAt    time.Time  `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"autoUpdateTime" json:"updated_at"`

	
	Supplier *Supplier           `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	User     User                `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Items    []PurchaseOrderItem `gorm:"foreignKey:PurchaseOrderID" json:"items,omitempty"`
}

func (PurchaseOrder) TableName() string {
	return "purchase_orders"
}


type PurchaseOrderItem struct {
	ID              uint    `gorm:"primaryKey" json:"id"`
	PurchaseOrderID uint    `gorm:"index;not null" json:"purchase_order_id"`
	ProductID       uint    `gorm:"index;not null" json:"product_id"`
	Quantity        int     `gorm:"not null;default:1" json:"quantity"`
	UnitCost        float64 `gorm:"not null;default:0" json:"unit_cost"`
	Subtotal        float64 `gorm:"not null;default:0" json:"subtotal"`

	
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (PurchaseOrderItem) TableName() string {
	return "purchase_order_items"
}
