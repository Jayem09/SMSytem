package handlers

import (
	"log"
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ExpenseHandler struct {
	LogService   *services.LogService
	CacheService *services.CacheService
}

func NewExpenseHandler(logService *services.LogService, cacheSvc *services.CacheService) *ExpenseHandler {
	return &ExpenseHandler{LogService: logService, CacheService: cacheSvc}
}

func (h *ExpenseHandler) Create(c *gin.Context) {
	var expense models.Expense
	if err := c.ShouldBindJSON(&expense); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDValue, _ := c.Get("userID")
	branchIDValue, _ := c.Get("branchID")

	var userID uint
	var branchID uint
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

	expense.UserID = userID
	expense.BranchID = branchID

	tx := database.DB.Begin()

	if err := tx.Create(&expense).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create expense"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	h.LogService.Record(userID, "CREATE", "Expense", strconv.Itoa(int(expense.ID)), "Recorded new expense", c.ClientIP())

	c.JSON(http.StatusCreated, expense)

	// Invalidate dashboard cache after successful create
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.InvalidateDashboard(c.Request.Context()); err != nil {
			log.Printf("Warning: failed to invalidate dashboard cache: %v", err)
		}
	}

	// Broadcast event for live dashboard updates
	services.GetBroadcaster().BroadcastToBranch(services.EventExpenseAdded, expense.BranchID, nil)
}

func (h *ExpenseHandler) List(c *gin.Context) {
	branchID, _ := c.Get("branchID")
	userRole, _ := c.Get("userRole")
	roleStr, _ := userRole.(string)

	var expenses []models.Expense
	query := database.DB.Preload("User").Preload("Product").Order("expense_date desc")

	// Only super_admin sees all expenses, others see only their branch's
	if roleStr != "super_admin" {
		query = query.Where("branch_id = ?", branchID)
	}

	if err := query.Find(&expenses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch expenses"})
		return
	}
	c.JSON(http.StatusOK, expenses)
}

func (h *ExpenseHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var expense models.Expense
	if err := database.DB.First(&expense, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}

	if err := c.ShouldBindJSON(&expense); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Save(&expense).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update expense"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UPDATE", "Expense", strconv.Itoa(id), "Updated expense details", c.ClientIP())
	}

	c.JSON(http.StatusOK, expense)

	// Invalidate dashboard cache after successful update
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.InvalidateDashboard(c.Request.Context()); err != nil {
			log.Printf("Warning: failed to invalidate dashboard cache: %v", err)
		}
	}
}

func (h *ExpenseHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))

	// Fetch expense first to get branch_id for broadcast
	var expense models.Expense
	if err := database.DB.First(&expense, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
		return
	}

	if err := database.DB.Delete(&models.Expense{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete expense"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "DELETE", "Expense", strconv.Itoa(id), "Deleted expense", c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Expense deleted successfully"})

	// Invalidate dashboard cache after successful delete
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.InvalidateDashboard(c.Request.Context()); err != nil {
			log.Printf("Warning: failed to invalidate dashboard cache: %v", err)
		}
	}

	// Broadcast event for live dashboard updates
	services.GetBroadcaster().BroadcastToBranch(services.EventExpenseAdded, expense.BranchID, nil)
}
