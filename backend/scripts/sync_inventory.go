package main

import (
	"fmt"
	"log"
	"os"
	"smsystem-backend/internal/models"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	
	_ = godotenv.Load(".env")
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	dbName := os.Getenv("DB_NAME")
	dbPort := os.Getenv("DB_PORT")
	dbHost := os.Getenv("DB_HOST")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", dbUser, dbPass, dbHost, dbPort, dbName)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	fmt.Println("Starting Inventory Re-sync and Legacy Migration...")

	var products []models.Product
	if err := db.Find(&products).Error; err != nil {
		log.Fatalf("Failed to fetch products: %v", err)
	}

	
	var mainWarehouse models.Warehouse
	if err := db.First(&mainWarehouse).Error; err != nil {
		fmt.Println("No warehouse found in database. Please create a warehouse first.")
		return
	}
	fmt.Printf("Using Warehouse: %s (ID: %d, BranchID: %d) for legacy stock.\n", mainWarehouse.Name, mainWarehouse.ID, mainWarehouse.BranchID)

	for _, p := range products {
		if p.IsService {
			continue
		}

		
		var batchSum int
		db.Model(&models.Batch{}).Where("product_id = ?", p.ID).Select("COALESCE(SUM(quantity), 0)").Scan(&batchSum)

		
		if p.Stock > batchSum {
			missingQty := p.Stock - batchSum
			fmt.Printf("Product '%s' (ID: %d) has %d missing units in batches. Creating legacy batch...\n", p.Name, p.ID, missingQty)
			
			legacyBatch := models.Batch{
				ProductID:   p.ID,
				WarehouseID: mainWarehouse.ID,
				BranchID:    mainWarehouse.BranchID,
				BatchNumber: "LEGACY-SYNC",
				Quantity:    missingQty,
			}
			if err := db.Create(&legacyBatch).Error; err != nil {
				fmt.Printf("Failed to create legacy batch for %s: %v\n", p.Name, err)
				continue
			}
			
			
			movement := models.StockMovement{
				ProductID:   p.ID,
				BatchID:     &legacyBatch.ID,
				WarehouseID: mainWarehouse.ID,
				BranchID:    mainWarehouse.BranchID,
				Type:        models.MovementTypeIn,
				Quantity:    missingQty,
				Reference:   "Legacy Data Re-sync",
			}
			db.Create(&movement)
			
			
			batchSum = p.Stock
		}

		
		if p.Stock != batchSum {
			fmt.Printf("Syncing cache for '%s' (ID: %d): %d -> %d\n", p.Name, p.ID, p.Stock, batchSum)
			if err := db.Model(&p).Update("stock", batchSum).Error; err != nil {
				fmt.Printf("Failed to update stock cache for %s: %v\n", p.Name, err)
			}
		}
	}

	fmt.Println(" Inventory Re-sync complete!")
}
