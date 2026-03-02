package handlers

import (
	"net/http"
	"strconv"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type BrandHandler struct{}

func NewBrandHandler() *BrandHandler {
	return &BrandHandler{}
}

type brandInput struct {
	Name    string `json:"name" binding:"required,min=2,max=255"`
	LogoURL string `json:"logo_url" binding:"max=500"`
}

// List returns all brands.
func (h *BrandHandler) List(c *gin.Context) {
	var brands []models.Brand
	if err := database.DB.Order("name ASC").Find(&brands).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch brands"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"brands": brands})
}

// GetByID returns a single brand by ID.
func (h *BrandHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid brand ID"})
		return
	}

	var brand models.Brand
	if err := database.DB.First(&brand, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Brand not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"brand": brand})
}

// Create creates a new brand.
func (h *BrandHandler) Create(c *gin.Context) {
	var input brandInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	brand := models.Brand{
		Name:    input.Name,
		LogoURL: input.LogoURL,
	}

	if err := database.DB.Create(&brand).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Brand already exists or creation failed"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Brand created", "brand": brand})
}

// Update updates an existing brand.
func (h *BrandHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid brand ID"})
		return
	}

	var brand models.Brand
	if err := database.DB.First(&brand, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Brand not found"})
		return
	}

	var input brandInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	brand.Name = input.Name
	brand.LogoURL = input.LogoURL

	if err := database.DB.Save(&brand).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update brand"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Brand updated", "brand": brand})
}

// Delete deletes a brand.
func (h *BrandHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid brand ID"})
		return
	}

	result := database.DB.Delete(&models.Brand{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Brand not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Brand deleted"})
}
