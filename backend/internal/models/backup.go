package models

import (
	"time"
)

type Backup struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Filename  string    `gorm:"size:255" json:"filename"`
	Size      int64     `json:"size"`
	Type      string    `gorm:"size:20" json:"type"`   // manual, auto
	Status    string    `gorm:"size:20" json:"status"` // completed, failed, in_progress
	CreatedAt time.Time `json:"created_at"`
}

func (Backup) TableName() string {
	return "backups"
}
