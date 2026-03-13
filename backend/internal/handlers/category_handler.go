package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type CategoryHandler struct {
	LogService *services.LogService
}

func NewCategoryHandler(logService *services.LogService) *CategoryHandler {
	return &CategoryHandler{LogService: logService}
}

type categoryInput struct {
	Name        string `json:"name" binding:"required,min=2,max=255"`
	Description string `json:"description" binding:"max=500"`
}


func (h *CategoryHandler) List(c *gin.Context) {
	var categories []models.Category
	if err := database.DB.Order("name ASC").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"categories": categories})
}


func (h *CategoryHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	var category models.Category
	if err := database.DB.First(&category, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"category": category})
}


func (h *CategoryHandler) Create(c *gin.Context) {
	var input categoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	category := models.Category{
		Name:        input.Name,
		Description: input.Description,
	}

	if err := database.DB.Create(&category).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Category already exists or creation failed"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "CREATE", "Category", strconv.Itoa(int(category.ID)), fmt.Sprintf("Created category: %s", category.Name), c.ClientIP())
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Category created", "category": category})
}


func (h *CategoryHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	var category models.Category
	if err := database.DB.First(&category, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	var input categoryInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	category.Name = input.Name
	category.Description = input.Description

	if err := database.DB.Save(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UPDATE", "Category", strconv.Itoa(int(category.ID)), fmt.Sprintf("Updated category: %s", category.Name), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category updated", "category": category})
}


func (h *CategoryHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category ID"})
		return
	}

	result := database.DB.Delete(&models.Category{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "DELETE", "Category", strconv.Itoa(int(id)), fmt.Sprintf("Deleted category #%d", id), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}
