package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InventoryHandler struct {
	LogService *services.LogService
}

func NewInventoryHandler(logService *services.LogService) *InventoryHandler {
	return &InventoryHandler{LogService: logService}
}

// GetWarehouses returns all configured physical locations
func (h *InventoryHandler) GetWarehouses(c *gin.Context) {
	var warehouses []models.Warehouse
	if err := database.DB.Find(&warehouses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch warehouses"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"warehouses": warehouses})
}

// GetStockLevels returns aggregated stock per product + warehouse
func (h *InventoryHandler) GetStockLevels(c *gin.Context) {
	type StockLevelResult struct {
		ProductID       uint       `json:"product_id"`
		ProductName     string     `json:"product_name"`
		ProductSize     string     `json:"product_size"`
		WarehouseID     uint       `json:"warehouse_id"`
		WarehouseName   string     `json:"warehouse_name"`
		TotalStock      int        `json:"total_stock"`
		ClosestExpiry   *time.Time `json:"closest_expiry"`
		ExpiringBatches int        `json:"expiring_batches"` // Number of distinct batches for this product here
	}

	var results []StockLevelResult
	// Aggregate from the batches table. We only care about products that have stock or had stock.
	query := database.DB.Table("batches").
		Select("batches.product_id, products.name as product_name, products.size as product_size, batches.warehouse_id, warehouses.name as warehouse_name, SUM(batches.quantity) as total_stock, MIN(batches.expiry_date) as closest_expiry, COUNT(batches.id) as expiring_batches").
		Joins("JOIN products ON batches.product_id = products.id").
		Joins("JOIN warehouses ON batches.warehouse_id = warehouses.id").
		Group("batches.product_id, batches.warehouse_id")

	if search := c.Query("search"); search != "" {
		query = query.Where("products.name LIKE ?", "%"+search+"%")
	}

	if err := query.Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stock levels", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"levels": results})
}

// GetMovementLogs returns the immutable history of inventory changes
func (h *InventoryHandler) GetMovementLogs(c *gin.Context) {
	var logs []models.StockMovement
	query := database.DB.Preload("Product").Preload("Batch").Preload("Warehouse").Preload("User").
		Order("created_at DESC")

	if productID := c.Query("product_id"); productID != "" {
		query = query.Where("product_id = ?", productID)
	}

	if err := query.Limit(100).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movement logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

type stockMovementInput struct {
	ProductID   uint       `json:"product_id" binding:"required"`
	WarehouseID uint       `json:"warehouse_id" binding:"required"`
	Quantity    int        `json:"quantity" binding:"required"` // Must be strictly positive for IN, OUT
	BatchNumber string     `json:"batch_number"`
	ExpiryDate  *time.Time `json:"expiry_date"`
	Reference   string     `json:"reference" binding:"required"`
}

// StockIn receives new items into the warehouse as a new batch
func (h *InventoryHandler) StockIn(c *gin.Context) {
	var input stockMovementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	if input.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be greater than zero for Stock In"})
		return
	}

	userIDValue, _ := c.Get("userID")
	userID := userIDValue.(uint)

	tx := database.DB.Begin()

	// 1. Create the new Batch
	batch := models.Batch{
		ProductID:   input.ProductID,
		WarehouseID: input.WarehouseID,
		BatchNumber: input.BatchNumber,
		Quantity:    input.Quantity,
		ExpiryDate:  input.ExpiryDate,
	}

	if err := tx.Create(&batch).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create inventory batch"})
		return
	}

	// 2. Create Movement Log
	movement := models.StockMovement{
		ProductID:   input.ProductID,
		BatchID:     &batch.ID,
		WarehouseID: input.WarehouseID,
		UserID:      &userID,
		Type:        models.MovementTypeIn,
		Quantity:    input.Quantity, // Positive
		Reference:   input.Reference,
	}

	if err := tx.Create(&movement).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record stock movement"})
		return
	}

	// 3. Update the global Product stock cache
	if err := tx.Model(&models.Product{}).Where("id = ?", input.ProductID).UpdateColumn("stock", gorm.Expr("stock + ?", input.Quantity)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
		return
	}

	tx.Commit()

	h.LogService.Record(userID, "CREATE", "Inventory", strconv.Itoa(int(movement.ID)), fmt.Sprintf("Stock In: +%d for Product #%d", input.Quantity, input.ProductID), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Stock successfully received", "batch": batch})
}

// StockOut explicitly removes items (e.g., damaged, expired, manual deduction) using FIFO
func (h *InventoryHandler) StockOut(c *gin.Context) {
	var input stockMovementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	if input.Quantity <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Quantity must be strictly positive for Stock Out"})
		return
	}

	userIDValue, _ := c.Get("userID")
	userID := userIDValue.(uint)

	tx := database.DB.Begin()

	// Find available batches for this product in this warehouse, ordered by expiry (oldest first)
	var batches []models.Batch
	if err := tx.Where("product_id = ? AND warehouse_id = ? AND quantity > 0", input.ProductID, input.WarehouseID).
		Order("expiry_date ASC, created_at ASC").
		Find(&batches).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find available batches"})
		return
	}

	remainingToDeduct := input.Quantity
	for i := range batches {
		if remainingToDeduct <= 0 {
			break
		}

		deduct := remainingToDeduct
		if batches[i].Quantity < deduct {
			deduct = batches[i].Quantity
		}

		// Update batch quantity
		batches[i].Quantity -= deduct
		if err := tx.Save(&batches[i]).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update batch quantity"})
			return
		}

		// Record partial movement
		movement := models.StockMovement{
			ProductID:   input.ProductID,
			BatchID:     &batches[i].ID,
			WarehouseID: input.WarehouseID,
			UserID:      &userID,
			Type:        models.MovementTypeOut,
			Quantity:    -deduct, // Negative for OUT
			Reference:   input.Reference,
		}

		if err := tx.Create(&movement).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record stock movement"})
			return
		}

		remainingToDeduct -= deduct
	}

	if remainingToDeduct > 0 {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock available in this warehouse to fullfill the out request."})
		return
	}

	// Update the global Product stock cache
	if err := tx.Model(&models.Product{}).Where("id = ?", input.ProductID).UpdateColumn("stock", gorm.Expr("stock - ?", input.Quantity)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
		return
	}

	tx.Commit()

	h.LogService.Record(userID, "CREATE", "Inventory", strconv.Itoa(int(input.ProductID)), fmt.Sprintf("Stock Out: -%d for Product #%d", input.Quantity, input.ProductID), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Stock successfully deducted"})
}

// AdjustStock completely overrides the quantity of a SPECIFIC batch (auditing purposes)
type adjustStockInput struct {
	BatchID     uint   `json:"batch_id" binding:"required"`
	NewQuantity int    `json:"new_quantity" binding:"required,min=0"`
	Reference   string `json:"reference" binding:"required"`
}

func (h *InventoryHandler) AdjustStock(c *gin.Context) {
	var input adjustStockInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	userIDValue, _ := c.Get("userID")
	userID := userIDValue.(uint)

	tx := database.DB.Begin()

	var batch models.Batch
	if err := tx.First(&batch, input.BatchID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	difference := input.NewQuantity - batch.Quantity
	if difference == 0 {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "New quantity is the same as current quantity"})
		return
	}

	// Update Batch
	batch.Quantity = input.NewQuantity
	if err := tx.Save(&batch).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update batch quantity"})
		return
	}

	// Record Movement
	movement := models.StockMovement{
		ProductID:   batch.ProductID,
		BatchID:     &batch.ID,
		WarehouseID: batch.WarehouseID,
		UserID:      &userID,
		Type:        models.MovementTypeAdjustment,
		Quantity:    difference,
		Reference:   input.Reference,
	}

	if err := tx.Create(&movement).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record adjustment movement"})
		return
	}

	// Update the global Product stock cache
	if difference > 0 {
		if err := tx.Model(&models.Product{}).Where("id = ?", batch.ProductID).UpdateColumn("stock", gorm.Expr("stock + ?", difference)).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
			return
		}
	} else {
		// difference is negative, so adding it actually subtracts
		if err := tx.Model(&models.Product{}).Where("id = ?", batch.ProductID).UpdateColumn("stock", gorm.Expr("stock - ?", -difference)).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
			return
		}
	}

	tx.Commit()

	h.LogService.Record(userID, "UPDATE", "Inventory", strconv.Itoa(int(batch.ID)), fmt.Sprintf("Adjusted Batch #%d to %d", batch.ID, input.NewQuantity), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Stock successfully adjusted"})
}
