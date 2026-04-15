package handlers

import (
	"fmt"

	"smsystem-backend/internal/models"

	"gorm.io/gorm"
)

func syncProductStock(tx *gorm.DB, productID uint) error {
	var totalStock int
	if err := tx.Model(&models.Batch{}).
		Where("product_id = ?", productID).
		Select("COALESCE(SUM(quantity), 0)").
		Row().
		Scan(&totalStock); err != nil {
		return fmt.Errorf("failed to recalculate product stock: %w", err)
	}

	if err := tx.Model(&models.Product{}).
		Where("id = ?", productID).
		Update("stock", totalStock).Error; err != nil {
		return fmt.Errorf("failed to sync product stock cache: %w", err)
	}

	return nil
}

func getOrCreateBranchWarehouse(tx *gorm.DB, branchID uint) (*models.Warehouse, error) {
	var warehouse models.Warehouse
	if err := tx.Where("branch_id = ?", branchID).First(&warehouse).Error; err == nil {
		return &warehouse, nil
	}

	warehouse = models.Warehouse{
		Name:     "Default Warehouse",
		BranchID: branchID,
	}

	if err := tx.Create(&warehouse).Error; err != nil {
		return nil, fmt.Errorf("failed to create branch warehouse: %w", err)
	}

	return &warehouse, nil
}
