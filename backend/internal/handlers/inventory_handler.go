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
	branchIDVal, exists := c.Get("branchID")
	var branchID uint
	if exists && branchIDVal != nil {
		switch v := branchIDVal.(type) {
		case uint:
			branchID = v
		case float64:
			branchID = uint(v)
		case int:
			branchID = uint(v)
		}
	}

	var warehouses []models.Warehouse
	query := database.DB.Model(&models.Warehouse{})

	if branchID != 0 {
		query = query.Where("branch_id = ?", branchID)
	}

	if err := query.Find(&warehouses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch warehouses", "details": err.Error()})
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
	branchIDVal, exists := c.Get("branchID")
	var branchID uint
	if exists && branchIDVal != nil {
		switch v := branchIDVal.(type) {
		case uint:
			branchID = v
		case float64:
			branchID = uint(v)
		case int:
			branchID = uint(v)
		}
	}

	// Aggregate from the batches table. We only care about products that have stock or had stock.
	query := database.DB.Table("batches").
		Select("batches.product_id, products.name as product_name, products.size as product_size, batches.warehouse_id, warehouses.name as warehouse_name, SUM(batches.quantity) as total_stock, MIN(batches.expiry_date) as closest_expiry, COUNT(batches.id) as expiring_batches").
		Joins("LEFT JOIN products ON batches.product_id = products.id").
		Joins("LEFT JOIN warehouses ON batches.warehouse_id = warehouses.id")

	if branchID != 0 {
		query = query.Where("batches.branch_id = ?", branchID)
	}

	query = query.Group("batches.product_id, batches.warehouse_id")

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
	branchIDVal, exists := c.Get("branchID")
	var branchID uint
	if exists && branchIDVal != nil {
		switch v := branchIDVal.(type) {
		case uint:
			branchID = v
		case float64:
			branchID = uint(v)
		case int:
			branchID = uint(v)
		}
	}

	var logs []models.StockMovement
	query := database.DB.Preload("Product").Preload("Batch").Preload("Warehouse").Preload("User").
		Order("created_at DESC")

	if branchID != 0 {
		query = query.Where("branch_id = ?", branchID)
	}

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
	branchIDValue, _ := c.Get("branchID")
	userID := userIDValue.(uint)
	branchID := branchIDValue.(uint)

	// 0. Ensure we grab the actual branch ID mapping for the selected warehouse
	var wh models.Warehouse
	if err := database.DB.First(&wh, input.WarehouseID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid warehouse ID"})
		return
	}
	actualBranchID := wh.BranchID

	// Security: Prevent normal users from altering other branches
	if branchID != 0 && actualBranchID != branchID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot stock in to a warehouse belonging to another branch"})
		return
	}

	tx := database.DB.Begin()

	// 1. Create the new Batch
	batch := models.Batch{
		ProductID:   input.ProductID,
		WarehouseID: input.WarehouseID,
		BranchID:    actualBranchID,
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
		BranchID:    actualBranchID,
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
	branchIDValue, _ := c.Get("branchID")
	userID := userIDValue.(uint)
	branchID := branchIDValue.(uint)

	tx := database.DB.Begin()

	// Find available batches for this product in this warehouse, ordered by expiry (oldest first)
	var batches []models.Batch
	batchQuery := tx.Where("product_id = ? AND warehouse_id = ? AND quantity > 0", input.ProductID, input.WarehouseID)
	if branchID != 0 {
		batchQuery = batchQuery.Where("branch_id = ?", branchID)
	}
	if err := batchQuery.Order("expiry_date ASC, created_at ASC").Find(&batches).Error; err != nil {
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
			BranchID:    batches[i].BranchID,
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
	branchIDValue, _ := c.Get("branchID")
	userID := userIDValue.(uint)
	branchID := branchIDValue.(uint)

	tx := database.DB.Begin()

	var batch models.Batch
	if err := tx.First(&batch, input.BatchID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

	// Security: Prevent normal users from altering other branches
	if branchID != 0 && batch.BranchID != branchID {
		tx.Rollback()
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot adjust stock for a batch belonging to another branch"})
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
		BranchID:    batch.BranchID,
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
		if err := tx.Model(&models.Product{}).Where("id = ? AND branch_id = ?", batch.ProductID, branchID).UpdateColumn("stock", gorm.Expr("stock + ?", difference)).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
			return
		}
	} else {
		// difference is negative, so adding it actually subtracts
		if err := tx.Model(&models.Product{}).Where("id = ? AND branch_id = ?", batch.ProductID, branchID).UpdateColumn("stock", gorm.Expr("stock - ?", -difference)).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
			return
		}
	}

	tx.Commit()

	h.LogService.Record(userID, "UPDATE", "Inventory", strconv.Itoa(int(batch.ID)), fmt.Sprintf("Adjusted Batch #%d to %d", batch.ID, input.NewQuantity), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Stock successfully adjusted"})
}
