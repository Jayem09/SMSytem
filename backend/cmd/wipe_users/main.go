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

	log.Println("Wiping users table...")

	
	database.DB.Exec("SET FOREIGN_KEY_CHECKS = 0;")

	if err := database.DB.Unscoped().Where("1 = 1").Delete(&models.User{}).Error; err != nil {
		log.Fatalf("Failed to delete users: %v", err)
	}

	database.DB.Exec("SET FOREIGN_KEY_CHECKS = 1;")

	log.Println("✅ All users deleted successfully from the cloud database!")
}
