package database

import (
	"fmt"
	"log"
	"strings"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/models"

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

	
	if err := DB.AutoMigrate(
		&models.Branch{},
		&models.User{},
		&models.Category{},
		&models.Brand{},
		&models.Product{},
		&models.Customer{},
		&models.Order{},
		&models.OrderItem{},
		&models.Expense{},
		&models.ActivityLog{},
		&models.Supplier{},
		&models.PurchaseOrder{},
		&models.PurchaseOrderItem{},
		&models.Warehouse{},
		&models.Batch{},
		&models.StockMovement{},
		&models.Setting{},
		&models.StockTransfer{},
		&models.StockTransferItem{},
	); err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	log.Println(" Database migration completed")

	
	var count int64
	DB.Model(&models.Branch{}).Count(&count)
	if count == 0 {
		defaultBranch := models.Branch{
			Name: "Default Branch",
			Code: "MAIN-01",
		}
		DB.Create(&defaultBranch)
		log.Println(" Default branch seeded")
	}

	
	var branches []models.Branch
	DB.Find(&branches)
	for _, branch := range branches {
		var warehouseCount int64
		DB.Model(&models.Warehouse{}).Where("branch_id = ?", branch.ID).Count(&warehouseCount)
		if warehouseCount == 0 {
			defaultWarehouse := models.Warehouse{
				Name:     "Main Warehouse",
				Address:  "",
				Contact:  "",
				BranchID: branch.ID,
			}
			DB.Create(&defaultWarehouse)
			log.Printf(" Default warehouse seeded for branch: %s", branch.Name)
		}
	}
}
