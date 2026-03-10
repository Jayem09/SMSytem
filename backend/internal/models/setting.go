package models

// Setting stores dynamic, global application configuration
type Setting struct {
	Key   string `gorm:"primaryKey;size:100" json:"key"`
	Value string `gorm:"type:text" json:"value"`
}
