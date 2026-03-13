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

type PurchaseOrderHandler struct {
	LogService *services.LogService
}

func NewPurchaseOrderHandler(logService *services.LogService) *PurchaseOrderHandler {
	return &PurchaseOrderHandler{LogService: logService}
}

type purchaseOrderItemInput struct {
	ProductID uint    `json:"product_id" binding:"required"`
	Quantity  int     `json:"quantity" binding:"required,min=1"`
	UnitCost  float64 `json:"unit_cost" binding:"required,min=0"`
}

type purchaseOrderInput struct {
	SupplierID *uint                    `json:"supplier_id"`
	OrderDate  string                   `json:"order_date" binding:"required"`
	Notes      string                   `json:"notes"`
	Items      []purchaseOrderItemInput `json:"items" binding:"required,min=1,dive"`
}


func (h *PurchaseOrderHandler) List(c *gin.Context) {
	var orders []models.PurchaseOrder
	if err := database.DB.
		Preload("Supplier").
		Preload("User").
		Preload("Items.Product").
		Order("created_at DESC").
		Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch purchase orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"purchase_orders": orders})
}


func (h *PurchaseOrderHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid purchase order ID"})
		return
	}

	var po models.PurchaseOrder
	if err := database.DB.
		Preload("Supplier").
		Preload("User").
		Preload("Items.Product").
		First(&po, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"purchase_order": po})
}


func (h *PurchaseOrderHandler) Create(c *gin.Context) {
	var input purchaseOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	
	orderDate, err := time.Parse("2006-01-02", input.OrderDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order date format. Use YYYY-MM-DD"})
		return
	}

	
	userID, _ := c.Get("userID")

	
	var totalCost float64
	var items []models.PurchaseOrderItem
	for _, item := range input.Items {
		subtotal := float64(item.Quantity) * item.UnitCost
		totalCost += subtotal
		items = append(items, models.PurchaseOrderItem{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
			UnitCost:  item.UnitCost,
			Subtotal:  subtotal,
		})
	}

	po := models.PurchaseOrder{
		SupplierID: input.SupplierID,
		UserID:     userID.(uint),
		Status:     "pending",
		TotalCost:  totalCost,
		OrderDate:  orderDate,
		Notes:      input.Notes,
		Items:      items,
	}

	if err := database.DB.Create(&po).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create purchase order"})
		return
	}

	
	database.DB.Preload("Supplier").Preload("User").Preload("Items.Product").First(&po, po.ID)

	h.LogService.Record(userID.(uint), "CREATE", "Purchase Order", strconv.Itoa(int(po.ID)), fmt.Sprintf("Created PO to supplier #%d", po.SupplierID), c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{"message": "Purchase order created", "purchase_order": po})
}


func (h *PurchaseOrderHandler) Receive(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid purchase order ID"})
		return
	}

	var po models.PurchaseOrder
	if err := database.DB.Preload("Items").First(&po, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase order not found"})
		return
	}

	if po.Status == "received" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Purchase order already received"})
		return
	}

	if po.Status == "cancelled" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot receive a cancelled purchase order"})
		return
	}

	
	tx := database.DB.Begin()

	
	var receiveInput struct {
		PONumber string `json:"po_number"`
	}
	if errJSON := c.ShouldBindJSON(&receiveInput); errJSON != nil {
		fmt.Printf("Purchase Order Receive JSON bind error: %v\n", errJSON)
	}
	fmt.Printf("Purchase Order Receive payload: po_number='%s'\n", receiveInput.PONumber)

	
	branchIDValue, _ := c.Get("branchID")
	userIDCtx, _ := c.Get("userID")
	branchID := branchIDValue.(uint)

	for _, item := range po.Items {
		
		if err := tx.Model(&models.Product{}).
			Where("id = ?", item.ProductID).
			Updates(map[string]interface{}{
				"stock":      gorm.Expr("stock + ?", item.Quantity),
				"cost_price": item.UnitCost,
			}).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product stock"})
			return
		}

		
		var warehouse models.Warehouse
		whQuery := tx.Model(&models.Warehouse{})
		if branchID != 0 {
			whQuery = whQuery.Where("branch_id = ?", branchID)
		}
		if err := whQuery.First(&warehouse).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "No warehouse assigned to store stock for this branch."})
			return
		}

		batch := models.Batch{
			ProductID:   item.ProductID,
			WarehouseID: warehouse.ID,
			BranchID:    warehouse.BranchID,
			BatchNumber: fmt.Sprintf("PO-%d", po.ID),
			Quantity:    item.Quantity,
		}
		if err := tx.Create(&batch).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create inventory batch"})
			return
		}

		var uid *uint
		if userIDCtx != nil {
			u := userIDCtx.(uint)
			uid = &u
		}
		movement := models.StockMovement{
			ProductID:   item.ProductID,
			BatchID:     &batch.ID,
			WarehouseID: warehouse.ID,
			BranchID:    warehouse.BranchID,
			UserID:      uid,
			Type:        models.MovementTypeIn,
			Quantity:    item.Quantity,
			Reference:   fmt.Sprintf("Purchase Order #%d received", po.ID),
		}
		if err := tx.Create(&movement).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create inventory movement"})
			return
		}
	}

	
	now := time.Now()
	po.Status = "received"
	po.ReceivedDate = &now
	po.PONumber = receiveInput.PONumber
	if err := tx.Save(&po).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update purchase order"})
		return
	}

	tx.Commit()

	
	database.DB.Preload("Supplier").Preload("User").Preload("Items.Product").First(&po, po.ID)

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UPDATE", "Purchase Order", strconv.Itoa(int(po.ID)), "Received items and updated stock", c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Purchase order received. Stock updated.", "purchase_order": po})
}


func (h *PurchaseOrderHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid purchase order ID"})
		return
	}

	var po models.PurchaseOrder
	if err := database.DB.First(&po, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase order not found"})
		return
	}

	if po.Status == "received" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete a received purchase order"})
		return
	}

	
	database.DB.Where("purchase_order_id = ?", id).Delete(&models.PurchaseOrderItem{})
	database.DB.Delete(&po)

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "DELETE", "Purchase Order", strconv.Itoa(int(id)), fmt.Sprintf("Deleted PO #%d", id), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Purchase order deleted"})
}
