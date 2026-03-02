package models

import (
	"time"
)

// Order represents a customer purchase.
type Order struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	CustomerID    uint      `gorm:"index;not null" json:"customer_id"`
	UserID        uint      `gorm:"index;not null" json:"user_id"`
	TotalAmount   float64   `gorm:"not null;default:0" json:"total_amount"`
	Status        string    `gorm:"size:50;not null;default:pending" json:"status"`
	PaymentMethod string    `gorm:"size:100" json:"payment_method"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relationships
	Customer Customer    `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	User     User        `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Items    []OrderItem `gorm:"foreignKey:OrderID" json:"items,omitempty"`
}

func (Order) TableName() string {
	return "orders"
}

// OrderItem represents a single line item in an order.
type OrderItem struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	OrderID   uint    `gorm:"index;not null" json:"order_id"`
	ProductID uint    `gorm:"index;not null" json:"product_id"`
	Quantity  int     `gorm:"not null;default:1" json:"quantity"`
	UnitPrice float64 `gorm:"not null;default:0" json:"unit_price"`
	Subtotal  float64 `gorm:"not null;default:0" json:"subtotal"`

	// Relationships
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (OrderItem) TableName() string {
	return "order_items"
}
