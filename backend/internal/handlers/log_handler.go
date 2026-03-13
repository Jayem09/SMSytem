package handlers

import (
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type LogHandler struct{}

func NewLogHandler() *LogHandler {
	return &LogHandler{}
}


func (h *LogHandler) List(c *gin.Context) {
	var logs []models.ActivityLog
	if err := database.DB.Preload("User").Order("created_at DESC").Limit(100).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}
