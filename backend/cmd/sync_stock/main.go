package main

import (
	"fmt"
	"log"
	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
)

func main() {
	// Load config to get DB credentials
	cfg := config.Load()
	database.Connect(cfg)

	fmt.Println("🚀 Starting Inventory Self-Healing Sync...")

	var products []models.Product
	if err := database.DB.Find(&products).Error; err != nil {
		log.Fatal(err)
	}

	for _, p := range products {
		var totalStock int
		if err := database.DB.Model(&models.Batch{}).
			Where("product_id = ?", p.ID).
			Select("COALESCE(SUM(quantity), 0)").
			Row().Scan(&totalStock); err != nil {
			log.Printf("Skipping product %d stock sync: %v", p.ID, err)
			continue
		}

		if p.Stock != totalStock {
			fmt.Printf("📦 Product ID %d (%s): Syncing %d -> %d\n", p.ID, p.Name, p.Stock, totalStock)
			database.DB.Model(&p).Update("stock", totalStock)
		}
	}

	fmt.Println("✅ All products synchronized with inventory batches.")
}
