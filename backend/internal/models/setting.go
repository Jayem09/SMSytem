package models


type Setting struct {
	Key   string `gorm:"column:key;primaryKey;size:100" json:"key"`
	Value string `gorm:"type:text" json:"value"`
}
