package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"
	"time"

	"github.com/gin-gonic/gin"
)

type CustomerHandler struct {
	LogService *services.LogService
}

func NewCustomerHandler(logService *services.LogService) *CustomerHandler {
	return &CustomerHandler{LogService: logService}
}

type customerInput struct {
	Name          string  `json:"name" binding:"required,min=2,max=255"`
	Email         string  `json:"email" binding:"omitempty,email"`
	Phone         string  `json:"phone" binding:"max=50"`
	Address       string  `json:"address"`
	RFIDCardID    string  `json:"rfid_card_id"`
	LoyaltyPoints float64 `json:"loyalty_points"`
}

func (h *CustomerHandler) List(c *gin.Context) {
	query := database.DB.Model(&models.Customer{})

	if search := c.Query("search"); search != "" {
		sanitized := sanitizeForLike(search)
		query = query.Where("name LIKE ? OR phone LIKE ? OR email LIKE ?", "%"+sanitized+"%", "%"+sanitized+"%", "%"+sanitized+"%")
	}

	var customers []models.Customer
	if err := query.Order("name ASC").Find(&customers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch customers"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"customers": customers})
}

func (h *CustomerHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}

	var customer models.Customer
	if err := database.DB.First(&customer, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"customer": customer})
}

func (h *CustomerHandler) GetByRFID(c *gin.Context) {
	rfid := c.Param("rfid")
	if rfid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "RFID card ID is required"})
		return
	}

	var customer models.Customer
	if err := database.DB.Where("rfid_card_id = ?", rfid).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No customer found with this RFID card"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"customer": customer})
}

func (h *CustomerHandler) Create(c *gin.Context) {
	var input customerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	customer := models.Customer{
		Name:          input.Name,
		Email:         input.Email,
		Phone:         input.Phone,
		Address:       input.Address,
		RFIDCardID:    input.RFIDCardID,
		LoyaltyPoints: input.LoyaltyPoints,
	}

	if err := database.DB.Create(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		if uid, ok := userIDValue.(uint); ok {
			h.LogService.Record(uid, "CREATE", "Customer", strconv.Itoa(int(customer.ID)), fmt.Sprintf("Created customer: %s", customer.Name), c.ClientIP())
		}
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Customer created", "customer": customer})
}

func (h *CustomerHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}

	var customer models.Customer
	if err := database.DB.First(&customer, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var input customerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	customer.Name = input.Name
	customer.Email = input.Email
	customer.Phone = input.Phone
	customer.Address = input.Address
	customer.RFIDCardID = input.RFIDCardID
	if input.LoyaltyPoints > 0 {
		customer.LoyaltyPoints = input.LoyaltyPoints
	}

	if err := database.DB.Save(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update customer"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		if uid, ok := userIDValue.(uint); ok {
			h.LogService.Record(uid, "UPDATE", "Customer", strconv.Itoa(int(customer.ID)), fmt.Sprintf("Updated customer: %s", customer.Name), c.ClientIP())
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Customer updated", "customer": customer})
}

func (h *CustomerHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid customer ID"})
		return
	}

	result := database.DB.Delete(&models.Customer{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		if uid, ok := userIDValue.(uint); ok {
			h.LogService.Record(uid, "DELETE", "Customer", strconv.Itoa(int(id)), fmt.Sprintf("Deleted customer #%d", id), c.ClientIP())
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Customer deleted"})
}

func (h *CustomerHandler) GetCRMStats(c *gin.Context) {
	var totalCustomers int64
	database.DB.Model(&models.Customer{}).Count(&totalCustomers)

	type TopSpender struct {
		ID          uint    `json:"id"`
		Name        string  `json:"name"`
		Email       string  `json:"email"`
		Phone       string  `json:"phone"`
		TotalSpent  float64 `json:"total_spent"`
		OrderCount  int     `json:"order_count"`
		LastPayment string  `json:"last_payment"`
	}
	var topSpenders []TopSpender
	database.DB.Table("customers").
		Select("customers.id, customers.name, customers.email, customers.phone, SUM(orders.total_amount) as total_spent, count(orders.id) as order_count, MAX(orders.created_at) as last_payment").
		Joins("JOIN orders ON orders.customer_id = customers.id").
		Where("orders.status = ?", "completed").
		Group("customers.id, customers.name, customers.email, customers.phone").
		Order("total_spent DESC").
		Limit(5).
		Scan(&topSpenders)

	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	var recentBuyers []TopSpender
	database.DB.Table("customers").
		Select("customers.id, customers.name, customers.email, customers.phone, SUM(orders.total_amount) as total_spent, count(orders.id) as order_count, MAX(orders.created_at) as last_payment").
		Joins("JOIN orders ON orders.customer_id = customers.id").
		Where("orders.status = ? AND orders.created_at >= ?", "completed", thirtyDaysAgo).
		Group("customers.id, customers.name, customers.email, customers.phone").
		Order("last_payment DESC").
		Scan(&recentBuyers)

	sixtyDaysAgo := time.Now().AddDate(0, 0, -60)
	var atRiskCustomers []TopSpender
	database.DB.Table("customers").
		Select("customers.id, customers.name, customers.email, customers.phone, SUM(orders.total_amount) as total_spent, count(orders.id) as order_count, MAX(orders.created_at) as last_payment").
		Joins("JOIN orders ON orders.customer_id = customers.id").
		Where("orders.status = ?", "completed").
		Group("customers.id, customers.name, customers.email, customers.phone").
		Having("MAX(orders.created_at) < ?", sixtyDaysAgo).
		Order("last_payment DESC").
		Scan(&atRiskCustomers)

	type CategoryStat struct {
		Category string `json:"category"`
		Count    int    `json:"count"`
	}
	var categoryStats []CategoryStat
	database.DB.Table("order_items").
		Select("categories.name as category, COUNT(order_items.id) as count").
		Joins("JOIN products ON order_items.product_id = products.id").
		Joins("JOIN categories ON products.category_id = categories.id").
		Group("categories.id, categories.name").
		Order("count DESC").
		Limit(5).
		Scan(&categoryStats)

	c.JSON(http.StatusOK, gin.H{
		"total_customers":    totalCustomers,
		"top_spenders":       topSpenders,
		"recent_buyers":      recentBuyers,
		"at_risk":            atRiskCustomers,
		"popular_categories": categoryStats,
	})
}
