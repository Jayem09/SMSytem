package services

import (
	"log"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
)

type LogService struct{}

func NewLogService() *LogService {
	return &LogService{}
}


func (s *LogService) Record(userID uint, action, entity, entityID, details, ip string) {
	entry := models.ActivityLog{
		UserID:    userID,
		Action:    action,
		Entity:    entity,
		EntityID:  entityID,
		Details:   details,
		IPAddress: ip,
	}

	if err := database.DB.Create(&entry).Error; err != nil {
		log.Printf("ERROR: Failed to record activity log: %v", err)
	}
}
