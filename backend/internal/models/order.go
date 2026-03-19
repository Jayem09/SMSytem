package models

import (
	"time"
)


type Order struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	CustomerID         *uint     `gorm:"index" json:"customer_id"`
	GuestName          string    `gorm:"size:255" json:"guest_name"`
	GuestPhone         string    `gorm:"size:50" json:"guest_phone"`
	UserID             uint      `gorm:"index;not null" json:"user_id"`
	BranchID           uint      `gorm:"index;not null" json:"branch_id"`
	ServiceAdvisorName string    `gorm:"size:255" json:"service_advisor_name"`
	TotalAmount        float64   `gorm:"not null;default:0" json:"total_amount"`
	DiscountAmount     float64   `gorm:"default:0" json:"discount_amount"`
	DiscountType       string    `gorm:"size:20;default:fixed" json:"discount_type"` 
	TaxAmount          float64   `gorm:"default:0" json:"tax_amount"`
	IsTaxInclusive     bool      `gorm:"default:false" json:"is_tax_inclusive"`
	Status             string    `gorm:"size:50;not null;default:pending" json:"status"`
	PaymentMethod      string    `gorm:"size:100" json:"payment_method"`
	ReceiptType        string    `gorm:"size:10;default:SI" json:"receipt_type"`
	TIN                string    `gorm:"size:100" json:"tin"`
	BusinessAddress    string    `gorm:"size:255" json:"business_address"`
	WithholdingTaxRate float64   `gorm:"default:0" json:"withholding_tax_rate"`
	CreatedAt          time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt          time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	
	Customer Customer    `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Branch   Branch      `gorm:"foreignKey:BranchID" json:"branch,omitempty"`
	User     User        `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Items    []OrderItem `gorm:"foreignKey:OrderID" json:"items,omitempty"`
}

func (Order) TableName() string {
	return "orders"
}


type OrderItem struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	OrderID   uint    `gorm:"index;not null" json:"order_id"`
	ProductID uint    `gorm:"index;not null" json:"product_id"`
	Quantity  int     `gorm:"not null;default:1" json:"quantity"`
	UnitPrice float64 `gorm:"not null;default:0" json:"unit_price"`
	Subtotal  float64 `gorm:"not null;default:0" json:"subtotal"`

	
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (OrderItem) TableName() string {
	return "order_items"
}
