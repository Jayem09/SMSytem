package database

import (
	"fmt"
	"log"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Connect initializes the MySQL database connection and runs auto-migrations.
func Connect(cfg *config.Config) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPassword,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
	)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("✅ Database connected successfully")

	// Auto-migrate models
	if err := DB.AutoMigrate(&models.User{}); err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	log.Println("✅ Database migration completed")
}
