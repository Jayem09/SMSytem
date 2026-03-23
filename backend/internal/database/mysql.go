package database

import (
	"fmt"
	"log"
	"strings"
	"time"

	"smsystem-backend/db"
	"smsystem-backend/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.Config) {
	var dsn string

	if cfg.DatabaseURL != "" {
		dsn = cfg.DatabaseURL

		if strings.HasPrefix(dsn, "mysql://") {
			dsn = strings.TrimPrefix(dsn, "mysql://")

			parts := strings.SplitN(dsn, "@", 2)
			if len(parts) == 2 {
				credentials := parts[0]
				remainder := parts[1]

				subParts := strings.SplitN(remainder, "/", 2)
				if len(subParts) == 2 {
					hostPort := subParts[0]
					dbAndQuery := subParts[1]
					dsn = fmt.Sprintf("%s@tcp(%s)/%s", credentials, hostPort, dbAndQuery)
				}
			}
		}
	} else {
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s",
			cfg.DBUser,
			cfg.DBPassword,
			cfg.DBHost,
			cfg.DBPort,
			cfg.DBName,
		)
	}

	if !strings.Contains(dsn, "parseTime=True") {
		if strings.Contains(dsn, "?") {
			dsn += "&parseTime=True"
		} else {
			dsn += "?parseTime=True"
		}
	}
	if !strings.Contains(dsn, "loc=Local") {
		dsn += "&loc=Local"
	}
	if !strings.Contains(dsn, "charset=utf8mb4") {
		dsn += "&charset=utf8mb4"
	}

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(100)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
	}

	log.Println(" Database connected successfully")

	if err := db.RunMigrations(DB); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	log.Println(" Database migration completed")

	if err := db.SeedDefaultData(DB); err != nil {
		log.Printf("Warning: failed to seed default data: %v", err)
	}
}
