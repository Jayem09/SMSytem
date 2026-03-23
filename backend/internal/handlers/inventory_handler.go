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

func (h *InventoryHandler) GetStockLevels(c *gin.Context) {
	type StockLevelResult struct {
		ProductID       uint       `json:"product_id"`
		ProductName     string     `json:"product_name"`
		ProductSize     string     `json:"product_size"`
		WarehouseID     uint       `json:"warehouse_id"`
		WarehouseName   string     `json:"warehouse_name"`
		TotalStock      int        `json:"total_stock"`
		InTransitStock  int        `json:"in_transit_stock"`
		ClosestExpiry   *time.Time `json:"closest_expiry"`
		ExpiringBatches int        `json:"expiring_batches"`
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

	query := database.DB.Table("batches").
		Select("batches.product_id, products.name as product_name, products.size as product_size, batches.warehouse_id, warehouses.name as warehouse_name, SUM(batches.quantity) as total_stock, MIN(batches.expiry_date) as closest_expiry, COUNT(CASE WHEN batches.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as expiring_batches, (SELECT COALESCE(SUM(sti.quantity), 0) FROM stock_transfer_items sti JOIN stock_transfers st ON sti.stock_transfer_id = st.id WHERE sti.product_id = batches.product_id AND st.destination_branch_id = batches.branch_id AND st.status = 'in_transit') as in_transit_stock").
		Joins("LEFT JOIN products ON batches.product_id = products.id").
		Joins("LEFT JOIN warehouses ON batches.warehouse_id = warehouses.id")

	if branchID != 0 {
		query = query.Where("batches.branch_id = ?", branchID)
	}

	query = query.Group("batches.product_id, products.name, products.size, batches.warehouse_id, warehouses.name")

	if search := c.Query("search"); search != "" {
		query = query.Where("products.name LIKE ?", "%"+search+"%")
	}

	if err := query.Scan(&results).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stock levels", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"levels": results})
}

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
	Quantity    int        `json:"quantity" binding:"required"`
	BatchNumber string     `json:"batch_number"`
	ExpiryDate  *time.Time `json:"expiry_date"`
	Reference   string     `json:"reference" binding:"required"`
}

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

	userID, _ := GetUintFromContext(c, "userID")
	branchID, _ := GetUintFromContext(c, "branchID")

	var wh models.Warehouse
	if err := database.DB.First(&wh, input.WarehouseID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid warehouse ID"})
		return
	}
	actualBranchID := wh.BranchID

	if branchID != 0 && actualBranchID != branchID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot stock in to a warehouse belonging to another branch"})
		return
	}

	tx := database.DB.Begin()

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

	movement := models.StockMovement{
		ProductID:   input.ProductID,
		BatchID:     &batch.ID,
		WarehouseID: input.WarehouseID,
		BranchID:    actualBranchID,
		UserID:      &userID,
		Type:        models.MovementTypeIn,
		Quantity:    input.Quantity,
		Reference:   input.Reference,
	}

	if err := tx.Create(&movement).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record stock movement"})
		return
	}

	if err := tx.Model(&models.Product{}).Where("id = ?", input.ProductID).UpdateColumn("stock", gorm.Expr("stock + ?", input.Quantity)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
		return
	}

	tx.Commit()

	h.LogService.Record(userID, "CREATE", "Inventory", strconv.Itoa(int(movement.ID)), fmt.Sprintf("Stock In: +%d for Product #%d", input.Quantity, input.ProductID), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Stock successfully received", "batch": batch})
}

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

	userID, _ := GetUintFromContext(c, "userID")
	branchID, _ := GetUintFromContext(c, "branchID")

	tx := database.DB.Begin()

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

		batches[i].Quantity -= deduct
		if err := tx.Save(&batches[i]).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update batch quantity"})
			return
		}

		movement := models.StockMovement{
			ProductID:   input.ProductID,
			BatchID:     &batches[i].ID,
			WarehouseID: input.WarehouseID,
			BranchID:    batches[i].BranchID,
			UserID:      &userID,
			Type:        models.MovementTypeOut,
			Quantity:    -deduct,
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

		var product models.Product
		if err := tx.First(&product, input.ProductID).Error; err == nil {
			if product.Stock >= remainingToDeduct {

				legacyBatch := models.Batch{
					ProductID:   product.ID,
					WarehouseID: input.WarehouseID,
					BranchID:    branchID,
					BatchNumber: "LEGACY-SYNC",
					Quantity:    product.Stock - remainingToDeduct,
				}

				var wh models.Warehouse
				if err := database.DB.First(&wh, input.WarehouseID).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find warehouse"})
					return
				}
				legacyBatch.BranchID = wh.BranchID

				if err := tx.Create(&legacyBatch).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create legacy batch"})
					return
				}

				movement := models.StockMovement{
					ProductID:   product.ID,
					BatchID:     &legacyBatch.ID,
					WarehouseID: input.WarehouseID,
					BranchID:    legacyBatch.BranchID,
					UserID:      &userID,
					Type:        models.MovementTypeOut,
					Quantity:    -remainingToDeduct,
					Reference:   input.Reference + " (Legacy Sync)",
				}
				if err := tx.Create(&movement).Error; err != nil {
					tx.Rollback()
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stock movement"})
					return
				}
				remainingToDeduct = 0
			}
		}
	}

	if remainingToDeduct > 0 {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock available in this warehouse to fullfill the out request."})
		return
	}

	if err := tx.Model(&models.Product{}).Where("id = ?", input.ProductID).UpdateColumn("stock", gorm.Expr("stock - ?", input.Quantity)).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
		return
	}

	tx.Commit()

	h.LogService.Record(userID, "CREATE", "Inventory", strconv.Itoa(int(input.ProductID)), fmt.Sprintf("Stock Out: -%d for Product #%d", input.Quantity, input.ProductID), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Stock successfully deducted"})
}

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
	userID := uint(0)
	branchID := uint(0)
	if userIDValue != nil {
		if v, ok := userIDValue.(uint); ok {
			userID = v
		}
	}
	if branchIDValue != nil {
		if v, ok := branchIDValue.(uint); ok {
			branchID = v
		}
	}

	tx := database.DB.Begin()

	var batch models.Batch
	if err := tx.First(&batch, input.BatchID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"error": "Batch not found"})
		return
	}

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

	batch.Quantity = input.NewQuantity
	if err := tx.Save(&batch).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update batch quantity"})
		return
	}

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

	if difference > 0 {
		if err := tx.Model(&models.Product{}).Where("id = ?", batch.ProductID).UpdateColumn("stock", gorm.Expr("stock + ?", difference)).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update total product stock"})
			return
		}
	} else {

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

func (h *InventoryHandler) GetLowStockReport(c *gin.Context) {
	type LowStockResult struct {
		ProductID         uint   `json:"product_id"`
		ProductName       string `json:"product_name"`
		ProductSize       string `json:"product_size"`
		CurrentStock      int    `json:"current_stock"`
		ReorderLevel      int    `json:"reorder_level"`
		PrimarySupplierID *uint  `json:"primary_supplier_id"`
		SupplierName      string `json:"supplier_name"`
	}

	var results []LowStockResult

	database.DB.Table("products").
		Select("products.id as product_id, products.name as product_name, products.size as product_size, products.stock as current_stock, products.reorder_level, products.primary_supplier_id, suppliers.name as supplier_name").
		Joins("LEFT JOIN suppliers ON products.primary_supplier_id = suppliers.id").
		Where("products.is_service = ? AND products.stock <= products.reorder_level AND products.deleted_at IS NULL", false).
		Scan(&results)

	c.JSON(http.StatusOK, gin.H{"low_stock": results})
}

func (h *InventoryHandler) GenerateDraftPOs(c *gin.Context) {
	userIDVal, _ := c.Get("userID")
	var userID uint
	if userIDVal != nil {
		switch v := userIDVal.(type) {
		case uint:
			userID = v
		case float64:
			userID = uint(v)
		case int:
			userID = uint(v)
		}
	}

	var lowStockProducts []models.Product
	database.DB.Where("is_service = ? AND stock <= reorder_level AND primary_supplier_id IS NOT NULL", false).Find(&lowStockProducts)

	if len(lowStockProducts) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No low stock products with assigned suppliers found."})
		return
	}

	supplierGroups := make(map[uint][]models.Product)
	for _, p := range lowStockProducts {
		supplierGroups[*p.PrimarySupplierID] = append(supplierGroups[*p.PrimarySupplierID], p)
	}

	createdCount := 0
	for supplierID, products := range supplierGroups {
		sid := supplierID

		po := models.PurchaseOrder{
			SupplierID: &sid,
			UserID:     userID,
			OrderDate:  time.Now(),
			Status:     "pending",
			Notes:      "Auto-generated draft PO for low stock replenishment",
			TotalCost:  0,
		}

		err := database.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&po).Error; err != nil {
				return err
			}

			var totalCost float64
			for _, p := range products {

				qtyToOrder := (p.ReorderLevel * 2) - p.Stock
				if qtyToOrder <= 0 {
					qtyToOrder = p.ReorderLevel
				}

				item := models.PurchaseOrderItem{
					PurchaseOrderID: po.ID,
					ProductID:       p.ID,
					Quantity:        qtyToOrder,
					UnitCost:        p.CostPrice,
					Subtotal:        float64(qtyToOrder) * p.CostPrice,
				}
				if err := tx.Create(&item).Error; err != nil {
					return err
				}
				totalCost += item.Subtotal
			}

			return tx.Model(&po).Update("total_cost", totalCost).Error
		})

		if err == nil {
			createdCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      fmt.Sprintf("Successfully generated %d draft Purchase Orders.", createdCount),
		"orders_count": createdCount,
	})
}

func (h *InventoryHandler) GetBatchMovementHistory(c *gin.Context) {
	batchID := c.Param("id")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Batch ID is required"})
		return
	}

	var movements []models.StockMovement
	if err := database.DB.Preload("User").Preload("Warehouse").Where("batch_id = ?", batchID).Order("created_at desc").Find(&movements).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch movement history"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"movements": movements})
}

func (h *InventoryHandler) GetProductBatches(c *gin.Context) {
	productID := c.Query("product_id")
	warehouseID := c.Query("warehouse_id")

	if productID == "" || warehouseID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Product ID and Warehouse ID are required"})
		return
	}

	var batches []models.Batch
	if err := database.DB.Where("product_id = ? AND warehouse_id = ? AND quantity > 0", productID, warehouseID).Order("expiry_date asc").Find(&batches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch batches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"batches": batches})
}
