package models

import (
	"time"
)

type LoyaltyLedger struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	CustomerID     uint      `gorm:"index;not null" json:"customer_id"`
	OrderID        *uint     `gorm:"index" json:"order_id"`
	PointsEarned   float64   `gorm:"type:decimal(10,2);default:0" json:"points_earned"`
	PointsRedeemed float64   `gorm:"type:decimal(10,2);default:0" json:"points_redeemed"`
	Remarks        string    `gorm:"type:text" json:"remarks"`
	CreatedAt      time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (LoyaltyLedger) TableName() string {
	return "loyalty_ledgers"
}
