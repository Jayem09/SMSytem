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

type ProductHandler struct {
	LogService *services.LogService
}

func NewProductHandler(logSvc *services.LogService) *ProductHandler {
	return &ProductHandler{LogService: logSvc}
}

type productInput struct {
	Name        string  `json:"name" binding:"required,min=2,max=255"`
	Description string  `json:"description"`
	Price       float64 `json:"price" binding:"required,gt=0"`
	Stock       int     `json:"stock" binding:"min=0"`
	Size        string  `json:"size"`
	ParentID    *uint   `json:"parent_id"`
	ImageURL    string  `json:"image_url"`
	CategoryID  uint    `json:"category_id" binding:"required"`
	BrandID     uint    `json:"brand_id" binding:"required"`

	// Tech Specs
	PCD         string `json:"pcd"`
	OffsetET    string `json:"offset_et"`
	Width       string `json:"width"`
	Bore        string `json:"bore"`
	Finish      string `json:"finish"`
	SpeedRating string `json:"speed_rating"`
	LoadIndex   string `json:"load_index"`
	DOTCode     string `json:"dot_code"`
	PlyRating   string `json:"ply_rating"`

	IsService bool `json:"is_service"`
}

// List returns all products with optional filters.
// Query params: category_id, brand_id, search, min_price, max_price
func (h *ProductHandler) List(c *gin.Context) {
	query := database.DB.Preload("Category").Preload("Brand")

	// Filter by category
	if categoryID := c.Query("category_id"); categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}

	// Filter by brand
	if brandID := c.Query("brand_id"); brandID != "" {
		query = query.Where("brand_id = ?", brandID)
	}

	// Search by name and specialized fields
	if search := c.Query("search"); search != "" {
		s := "%" + search + "%"
		query = query.Where(
			"name LIKE ? OR size LIKE ? OR pcd LIKE ? OR offset_et LIKE ? OR width LIKE ? OR speed_rating LIKE ? OR finish LIKE ?",
			s, s, s, s, s, s, s,
		)
	}

	// Price range
	if minPrice := c.Query("min_price"); minPrice != "" {
		query = query.Where("price >= ?", minPrice)
	}
	if maxPrice := c.Query("max_price"); maxPrice != "" {
		query = query.Where("price <= ?", maxPrice)
	}

	// Filter by parent (for variants)
	if parentID := c.Query("parent_id"); parentID != "" {
		query = query.Where("parent_id = ?", parentID)
	} else if c.Query("all") == "" {
		// By default, only show top-level products (not variants)
		query = query.Where("parent_id IS NULL")
	}

	var products []models.Product
	if err := query.Order("created_at DESC").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"products": products})
}

// GetByID returns a single product with its category and brand.
func (h *ProductHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	if err := database.DB.Preload("Category").Preload("Brand").First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"product": product})
}

// Create creates a new product.
func (h *ProductHandler) Create(c *gin.Context) {
	var input productInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	// Verify category exists
	var category models.Category
	if err := database.DB.First(&category, input.CategoryID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category not found"})
		return
	}

	// Verify brand exists
	var brand models.Brand
	if err := database.DB.First(&brand, input.BrandID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Brand not found"})
		return
	}

	product := models.Product{
		Name:        input.Name,
		Description: input.Description,
		Price:       input.Price,
		Stock:       input.Stock,
		Size:        input.Size,
		ParentID:    input.ParentID,
		ImageURL:    input.ImageURL,
		CategoryID:  input.CategoryID,
		BrandID:     input.BrandID,
		PCD:         input.PCD,
		OffsetET:    input.OffsetET,
		Width:       input.Width,
		Bore:        input.Bore,
		Finish:      input.Finish,
		SpeedRating: input.SpeedRating,
		LoadIndex:   input.LoadIndex,
		DOTCode:     input.DOTCode,
		PlyRating:   input.PlyRating,
		IsService:   input.IsService,
	}

	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
		return
	}

	// Reload with relationships
	database.DB.Preload("Category").Preload("Brand").First(&product, product.ID)

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "CREATE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Created product: %s", product.Name), c.ClientIP())
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Product created", "product": product})
}

// Update updates an existing product.
func (h *ProductHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	if err := database.DB.First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	var input productInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	oldPrice := product.Price
	product.Name = input.Name
	product.Description = input.Description
	product.Price = input.Price
	product.Stock = input.Stock
	product.Size = input.Size
	product.ParentID = input.ParentID
	product.ImageURL = input.ImageURL
	product.CategoryID = input.CategoryID
	product.BrandID = input.BrandID
	product.PCD = input.PCD
	product.OffsetET = input.OffsetET
	product.Width = input.Width
	product.Bore = input.Bore
	product.Finish = input.Finish
	product.SpeedRating = input.SpeedRating
	product.LoadIndex = input.LoadIndex
	product.DOTCode = input.DOTCode
	product.PlyRating = input.PlyRating
	product.IsService = input.IsService

	if err := database.DB.Save(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		if oldPrice != product.Price {
			h.LogService.Record(userIDValue.(uint), "UPDATE_PRICE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Price changed for %s: P%.2f -> P%.2f", product.Name, oldPrice, product.Price), c.ClientIP())
		} else {
			h.LogService.Record(userIDValue.(uint), "UPDATE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Updated details for %s", product.Name), c.ClientIP())
		}
	}

	database.DB.Preload("Category").Preload("Brand").First(&product, product.ID)
	c.JSON(http.StatusOK, gin.H{"message": "Product updated", "product": product})
}

// Delete deletes a product.
func (h *ProductHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	if err := database.DB.First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	if err := database.DB.Delete(&models.Product{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete product"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "DELETE", "Product", strconv.Itoa(int(id)), fmt.Sprintf("Deleted product: %s", product.Name), c.ClientIP())
	}
	c.JSON(http.StatusOK, gin.H{"message": "Product deleted"})
}
