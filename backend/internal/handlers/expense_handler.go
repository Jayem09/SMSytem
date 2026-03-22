package handlers

import (
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ExpenseHandler struct {
	LogService *services.LogService
}

func NewExpenseHandler(logService *services.LogService) *ExpenseHandler {
	return &ExpenseHandler{LogService: logService}
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
}

func (h *ExpenseHandler) List(c *gin.Context) {
	branchID, _ := c.Get("branchID")
	var expenses []models.Expense
	if err := database.DB.Where("branch_id = ?", branchID).Preload("User").Preload("Product").Order("expense_date desc").Find(&expenses).Error; err != nil {
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
}

func (h *ExpenseHandler) Delete(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.DB.Delete(&models.Expense{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete expense"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "DELETE", "Expense", strconv.Itoa(id), "Deleted expense", c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Expense deleted successfully"})
}
