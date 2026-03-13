package models

import (
	"time"
)


type Expense struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Description string    `gorm:"size:255;not null" json:"description"`
	Amount      float64   `gorm:"not null;default:0" json:"amount"`
	Category    string    `gorm:"size:100;not null" json:"category"` 
	ExpenseDate time.Time `gorm:"not null" json:"expense_date"`
	UserID      uint      `gorm:"index" json:"user_id"`
	BranchID    uint      `gorm:"index" json:"branch_id"`
	ProductID   *uint     `gorm:"index" json:"product_id"`
	Quantity    int       `gorm:"default:0" json:"quantity"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	
	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (Expense) TableName() string {
	return "expenses"
}
