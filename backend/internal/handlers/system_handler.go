package handlers

import (
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct{}

func NewSystemHandler() *SystemHandler {
	return &SystemHandler{}
}

func (h *SystemHandler) GetStatus(c *gin.Context) {
	var maintenanceMode models.Setting
	var minAppVersion models.Setting

	database.DB.Where("`key` = ?", "maintenance_mode").First(&maintenanceMode)
	database.DB.Where("`key` = ?", "min_app_version").First(&minAppVersion)

	// Defaults if not set
	isMaintenance := maintenanceMode.Value == "true"
	minVersion := minAppVersion.Value
	if minVersion == "" {
		minVersion = "0.0.0"
	}

	c.JSON(http.StatusOK, gin.H{
		"maintenance": isMaintenance,
		"min_version": minVersion,
		"message":     "System status retrieved successfully",
	})
}
