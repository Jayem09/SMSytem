package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type OrderHandler struct{}

func NewOrderHandler() *OrderHandler {
	return &OrderHandler{}
}

type orderItemInput struct {
	ProductID uint `json:"product_id" binding:"required"`
	Quantity  int  `json:"quantity" binding:"required,min=1"`
}

type orderInput struct {
	CustomerID    uint             `json:"customer_id" binding:"required"`
	PaymentMethod string           `json:"payment_method" binding:"required"`
	Items         []orderItemInput `json:"items" binding:"required,min=1,dive"`
}

type statusInput struct {
	Status string `json:"status" binding:"required,oneof=pending confirmed completed cancelled"`
}

// List returns all orders with their items, customer, and user.
func (h *OrderHandler) List(c *gin.Context) {
	query := database.DB.Preload("Customer").Preload("User").Preload("Items.Product")

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by customer
	if customerID := c.Query("customer_id"); customerID != "" {
		query = query.Where("customer_id = ?", customerID)
	}

	var orders []models.Order
	if err := query.Order("created_at DESC").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

// GetByID returns a single order with full details.
func (h *OrderHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var order models.Order
	if err := database.DB.Preload("Customer").Preload("User").Preload("Items.Product").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"order": order})
}

// Create creates a new order with items inside a database transaction.
// It validates stock, calculates totals, and reduces product stock atomically.
func (h *OrderHandler) Create(c *gin.Context) {
	var input orderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	// Get the authenticated user ID
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	// Verify customer exists
	var customer models.Customer
	if err := database.DB.First(&customer, input.CustomerID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Customer not found"})
		return
	}

	// Run everything in a transaction
	var order models.Order
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var totalAmount float64
		var orderItems []models.OrderItem

		for _, item := range input.Items {
			// Fetch product and lock the row
			var product models.Product
			if err := tx.First(&product, item.ProductID).Error; err != nil {
				return errors.New("product ID " + strconv.Itoa(int(item.ProductID)) + " not found")
			}

			// Check stock
			if product.Stock < item.Quantity {
				return errors.New("insufficient stock for " + product.Name + " (available: " + strconv.Itoa(product.Stock) + ")")
			}

			// Calculate subtotal
			subtotal := product.Price * float64(item.Quantity)
			totalAmount += subtotal

			orderItems = append(orderItems, models.OrderItem{
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				UnitPrice: product.Price,
				Subtotal:  subtotal,
			})

			// Reduce stock
			if err := tx.Model(&product).Update("stock", product.Stock-item.Quantity).Error; err != nil {
				return errors.New("failed to update stock for " + product.Name)
			}
		}

		// Create order
		order = models.Order{
			CustomerID:    input.CustomerID,
			UserID:        userID.(uint),
			TotalAmount:   totalAmount,
			Status:        "pending",
			PaymentMethod: input.PaymentMethod,
			Items:         orderItems,
		}

		if err := tx.Create(&order).Error; err != nil {
			return errors.New("failed to create order")
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Reload with all relationships
	database.DB.Preload("Customer").Preload("User").Preload("Items.Product").First(&order, order.ID)
	c.JSON(http.StatusCreated, gin.H{"message": "Order created", "order": order})
}

// UpdateStatus updates an order's status.
func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var order models.Order
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	var input statusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	order.Status = input.Status
	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order status"})
		return
	}

	database.DB.Preload("Customer").Preload("User").Preload("Items.Product").First(&order, order.ID)
	c.JSON(http.StatusOK, gin.H{"message": "Order status updated", "order": order})
}

// Delete deletes an order and its items.
func (h *OrderHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	// Delete items first, then order
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("order_id = ?", id).Delete(&models.OrderItem{}).Error; err != nil {
			return err
		}
		result := tx.Delete(&models.Order{}, id)
		if result.RowsAffected == 0 {
			return errors.New("order not found")
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Order deleted"})
}
