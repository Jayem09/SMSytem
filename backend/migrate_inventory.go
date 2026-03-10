package main

import (
	"fmt"
	"log"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
)

func main() {
	cfg := config.Load()
	database.Connect(cfg)

	// 1. Create Default Warehouse if not exists
	var warehouse models.Warehouse
	if err := database.DB.Where("name = ?", "Main Warehouse").FirstOrCreate(&warehouse, models.Warehouse{
		Name:    "Main Warehouse",
		Address: "Default Location",
		Contact: "N/A",
	}).Error; err != nil {
		log.Fatalf("Failed to create default warehouse: %v", err)
	}

	fmt.Printf("Default warehouse ready: ID %d\n", warehouse.ID)

	// 2. Find all products that have stock > 0
	var products []models.Product
	if err := database.DB.Where("stock > 0").Find(&products).Error; err != nil {
		log.Fatalf("Failed to fetch products: %v", err)
	}

	for _, p := range products {
		fmt.Printf("Migrating product #%d: %s (Stock: %d)\n", p.ID, p.Name, p.Stock)

		// Create a batch
		batch := models.Batch{
			ProductID:   p.ID,
			WarehouseID: warehouse.ID,
			BatchNumber: "LEGACY-STOCK",
			Quantity:    p.Stock,
		}

		if err := database.DB.Create(&batch).Error; err != nil {
			log.Printf("Failed to create batch for product %d: %v", p.ID, err)
			continue
		}

		// Create a movement log
		movement := models.StockMovement{
			ProductID:   p.ID,
			BatchID:     &batch.ID,
			WarehouseID: warehouse.ID,
			Type:        models.MovementTypeAdjustment,
			Quantity:    p.Stock,
			Reference:   "Legacy Migration",
		}

		if err := database.DB.Create(&movement).Error; err != nil {
			log.Printf("Failed to create movement for product %d: %v", p.ID, err)
		}
	}

	fmt.Println("Inventory migration completed successfully!")
}
