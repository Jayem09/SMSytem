package models

import (
	"time"
)

const (
	MovementTypeIn         = "IN"
	MovementTypeOut        = "OUT"
	MovementTypeAdjustment = "ADJUSTMENT"
	MovementTypeTransfer   = "TRANSFER"
)

// StockMovement represents an immutable ledger entry of inventory changes.
type StockMovement struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ProductID   uint      `gorm:"not null;index" json:"product_id"`
	BatchID     *uint     `gorm:"index" json:"batch_id"` // Links to a specific expiry batch
	WarehouseID uint      `gorm:"not null;index" json:"warehouse_id"`
	UserID      *uint     `gorm:"index" json:"user_id"`         // Who made the movement
	Type        string    `gorm:"size:20;not null" json:"type"` // "IN", "OUT", "ADJUSTMENT", "TRANSFER"
	Quantity    int       `gorm:"not null" json:"quantity"`     // Positive for IN, Negative for OUT/ADJUST (-10)
	Reference   string    `gorm:"size:255" json:"reference"`    // e.g. "PO-1002", "Expired Dispose", "Sale ORD-05"
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`

	// Relationships (read-only)
	Product   Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Batch     *Batch    `gorm:"foreignKey:BatchID" json:"batch,omitempty"`
	Warehouse Warehouse `gorm:"foreignKey:WarehouseID" json:"warehouse,omitempty"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (StockMovement) TableName() string {
	return "stock_movements"
}
