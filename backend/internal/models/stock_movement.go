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


type StockMovement struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ProductID   uint      `gorm:"not null;index" json:"product_id"`
	BatchID     *uint     `gorm:"index" json:"batch_id"` 
	WarehouseID uint      `gorm:"not null;index" json:"warehouse_id"`
	UserID      *uint     `gorm:"index" json:"user_id"`            
	BranchID    uint      `gorm:"index;not null" json:"branch_id"` 
	Type        string    `gorm:"size:20;not null" json:"type"`    
	Quantity    int       `gorm:"not null" json:"quantity"`        
	Reference   string    `gorm:"size:255" json:"reference"`       
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`

	
	Product   Product   `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Batch     *Batch    `gorm:"foreignKey:BatchID" json:"batch,omitempty"`
	Warehouse Warehouse `gorm:"foreignKey:WarehouseID" json:"warehouse,omitempty"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (StockMovement) TableName() string {
	return "stock_movements"
}
