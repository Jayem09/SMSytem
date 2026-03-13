package handlers

import (
	"encoding/json"
	"net/http"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	LogService *services.LogService
}

func NewSettingsHandler(logService *services.LogService) *SettingsHandler {
	return &SettingsHandler{LogService: logService}
}


func (h *SettingsHandler) GetAll(c *gin.Context) {
	var settings []models.Setting
	if err := database.DB.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch settings"})
		return
	}

	result := make(map[string]interface{})
	for _, s := range settings {
		var parsed interface{}
		
		if err := json.Unmarshal([]byte(s.Value), &parsed); err == nil {
			result[s.Key] = parsed
		} else {
			result[s.Key] = s.Value
		}
	}

	c.JSON(http.StatusOK, result)
}


func (h *SettingsHandler) UpdateBulk(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	tx := database.DB.Begin()
	for key, value := range input {
		strValue := ""
		switch v := value.(type) {
		case string:
			strValue = v
		default:
			bytes, _ := json.Marshal(v)
			strValue = string(bytes)
		}

		setting := models.Setting{Key: key, Value: strValue}
		var existing models.Setting
		if err := tx.First(&existing, "key = ?", key).Error; err != nil {
			if err := tx.Create(&setting).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
				return
			}
		} else {
			if err := tx.Model(&existing).Update("value", strValue).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save settings"})
				return
			}
		}
	}
	tx.Commit()

	currentUserID, _ := c.Get("userID")
	if currentUserID != nil {
		h.LogService.Record(currentUserID.(uint), "UPDATE", "Settings", "0", "Updated system settings", c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated successfully"})
}
