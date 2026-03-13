package models

import (
	"time"
)


type Supplier struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"size:255;not null;uniqueIndex" json:"name"`
	ContactPerson string    `gorm:"size:255" json:"contact_person"`
	Phone         string    `gorm:"size:50" json:"phone"`
	Email         string    `gorm:"size:255" json:"email"`
	Address       string    `gorm:"type:text" json:"address"`
	Notes         string    `gorm:"type:text" json:"notes"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

func (Supplier) TableName() string {
	return "suppliers"
}
