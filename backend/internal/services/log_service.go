package services

import (
	"log"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"sync"
)

type LogService struct {
	logChan chan logEntry
	wg      sync.WaitGroup
}

type logEntry struct {
	userID   uint
	action   string
	entity   string
	entityID string
	details  string
	ip       string
}

func NewLogService() *LogService {
	s := &LogService{
		logChan: make(chan logEntry, 1000),
	}
	s.wg.Add(1)
	go s.processLogs()
	return s
}

func (s *LogService) processLogs() {
	defer s.wg.Done()
	for entry := range s.logChan {
		logModel := models.ActivityLog{
			UserID:    entry.userID,
			Action:    entry.action,
			Entity:    entry.entity,
			EntityID:  entry.entityID,
			Details:   entry.details,
			IPAddress: entry.ip,
		}
		if err := database.DB.Create(&logModel).Error; err != nil {
			log.Printf("ERROR: Failed to record activity log: %v", err)
		}
	}
}

func (s *LogService) Record(userID uint, action, entity, entityID, details, ip string) {
	select {
	case s.logChan <- logEntry{
		userID:   userID,
		action:   action,
		entity:   entity,
		entityID: entityID,
		details:  details,
		ip:       ip,
	}:
	default:
		log.Printf("WARNING: Activity log channel full, dropping log entry")
	}
}

func (s *LogService) Shutdown() {
	close(s.logChan)
	s.wg.Wait()
}
