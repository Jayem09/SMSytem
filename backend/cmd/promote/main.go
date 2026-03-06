package main

import (
	"log"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
)

func main() {
	cfg := config.Load()
	database.Connect(cfg)

	res := database.DB.Model(&models.User{}).Where("1 = 1").Update("role", "admin")
	if res.Error != nil {
		log.Fatalf("Failed to update users: %v", res.Error)
	}

	log.Printf("Successfully updated %d users to 'admin' role.", res.RowsAffected)
}
