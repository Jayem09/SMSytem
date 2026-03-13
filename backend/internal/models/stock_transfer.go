package models

import (
	"time"
)


const (
	TransferStatusPending   = "pending"
	TransferStatusApproved  = "approved"
	TransferStatusInTransit = "in_transit"
	TransferStatusCompleted = "completed"
	TransferStatusRejected  = "rejected"
	TransferStatusCancelled = "cancelled"
)


type StockTransfer struct {
	ID                  uint                `gorm:"primaryKey" json:"id"`
	ReferenceNumber     string              `gorm:"size:50;uniqueIndex;not null" json:"reference_number"`
	SourceBranchID      uint                `gorm:"not null" json:"source_branch_id"`
	DestinationBranchID uint                `gorm:"not null" json:"destination_branch_id"`
	RequestedByUserID   uint                `gorm:"not null" json:"requested_by_user_id"`
	ApprovedByUserID    *uint               `json:"approved_by_user_id"` 
	ReceivedByUserID    *uint               `json:"received_by_user_id"` 
	Status              string              `gorm:"size:20;not null;default:'pending'" json:"status"`
	Notes               string              `gorm:"type:text" json:"notes"`
	Items               []StockTransferItem `gorm:"foreignKey:StockTransferID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"items"`
	
	
	SourceBranch      *Branch `gorm:"foreignKey:SourceBranchID" json:"source_branch,omitempty"`
	DestinationBranch *Branch `gorm:"foreignKey:DestinationBranchID" json:"destination_branch,omitempty"`
	RequestedByUser   *User   `gorm:"foreignKey:RequestedByUserID" json:"requested_by_user,omitempty"`
	ApprovedByUser    *User   `gorm:"foreignKey:ApprovedByUserID" json:"approved_by_user,omitempty"`
	ReceivedByUser    *User   `gorm:"foreignKey:ReceivedByUserID" json:"received_by_user,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (StockTransfer) TableName() string {
	return "stock_transfers"
}


type StockTransferItem struct {
	ID              uint    `gorm:"primaryKey" json:"id"`
	StockTransferID uint    `gorm:"not null;index" json:"stock_transfer_id"`
	ProductID       uint    `gorm:"not null" json:"product_id"`
	Quantity        int     `gorm:"not null;check:quantity > 0" json:"quantity"`
	ReceivedQuantity int    `gorm:"not null;default:0" json:"received_quantity"` 

	
	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (StockTransferItem) TableName() string {
	return "stock_transfer_items"
}
