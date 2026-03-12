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
	branchIDValue, _ := c.Get("branchID")
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	// Use a robust subquery for stock: prioritize batches sum, fallback to products.stock if no batches exist.
	stockSubquery := "COALESCE((SELECT SUM(quantity) FROM batches WHERE batches.product_id = products.id"
	var queryArgs []interface{}
	if branchID != 0 {
		stockSubquery += " AND batches.branch_id = ?"
		queryArgs = append(queryArgs, branchID)
	}
	stockSubquery += "), products.stock) as stock"

	if err := query.Select("products.*, "+stockSubquery, queryArgs...).
		Order("created_at DESC").Find(&products).Error; err != nil {
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
	branchIDValue, _ := c.Get("branchID")
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	stockSubquery := "COALESCE((SELECT SUM(quantity) FROM batches WHERE batches.product_id = products.id"
	var queryArgs []interface{}
	if branchID != 0 {
		stockSubquery += " AND batches.branch_id = ?"
		queryArgs = append(queryArgs, branchID)
	}
	stockSubquery += "), products.stock) as stock"

	if err := database.DB.Preload("Category").Preload("Brand").
		Select("products.*, "+stockSubquery, queryArgs...).
		First(&product, id).Error; err != nil {
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
		Stock:       0, // We set 0 here because actual stock is handled via Batch if > 0
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

	branchID, _ := c.Get("branchID")
	userIDValue, _ := c.Get("userID")

	// Start transaction to create product and initial batch atomicaly
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

		// If stock is specified and it's not a service, create an initial batch in the default warehouse
		if input.Stock > 0 && !input.IsService {
			var warehouse models.Warehouse
			if err := tx.Where("branch_id = ?", branchID).First(&warehouse).Error; err != nil {
				return fmt.Errorf("no warehouse found for this branch to store initial stock")
			}

			batch := models.Batch{
				ProductID:   product.ID,
				WarehouseID: warehouse.ID,
				BranchID:    branchID.(uint),
				BatchNumber: "INITIAL",
				Quantity:    input.Stock,
			}
			if err := tx.Create(&batch).Error; err != nil {
				return err
			}

			var userID *uint
			if userIDValue != nil {
				uid := userIDValue.(uint)
				userID = &uid
			}

			movement := models.StockMovement{
				ProductID:   product.ID,
				BatchID:     &batch.ID,
				WarehouseID: warehouse.ID,
				BranchID:    branchID.(uint),
				UserID:      userID,
				Type:        models.MovementTypeIn,
				Quantity:    input.Stock,
				Reference:   "Initial Stock upon Creation",
			}
			if err := tx.Create(&movement).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product and initialize stock: " + err.Error()})
		return
	}

	// Reload with relationships AND calculated stock
	database.DB.Preload("Category").Preload("Brand").
		Select("products.*, (SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = products.id AND branch_id = ?) as stock", branchID).
		First(&product, product.ID)

	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "CREATE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Created product: %s with initial stock %d", product.Name, input.Stock), c.ClientIP())
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

	branchID, _ := c.Get("branchID")
	userIDValue, _ := c.Get("userID")

	// Start transaction to handle metadata update and potential stock adjustment
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Calculate current stock from ledger BEFORE saving anything
		var currentStock int
		tx.Model(&models.Batch{}).
			Where("product_id = ? AND branch_id = ?", product.ID, branchID).
			Select("COALESCE(SUM(quantity), 0)").
			Row().Scan(&currentStock)

		if err := tx.Save(&product).Error; err != nil {
			return err
		}

		// Smart Stock Sync: If requested stock differs from ledger, create adjustment
		if !input.IsService && input.Stock != currentStock {
			diff := input.Stock - currentStock

			var warehouse models.Warehouse
			if err := tx.Where("branch_id = ?", branchID).First(&warehouse).Error; err != nil {
				return fmt.Errorf("no warehouse found for this branch to store adjustment")
			}

			// Create an adjustment batch
			batch := models.Batch{
				ProductID:   product.ID,
				WarehouseID: warehouse.ID,
				BranchID:    branchID.(uint),
				BatchNumber: fmt.Sprintf("ADJ-%s", time.Now().Format("20060102")),
				Quantity:    diff,
			}
			if err := tx.Create(&batch).Error; err != nil {
				return err
			}

			var userID *uint
			if userIDValue != nil {
				uid := userIDValue.(uint)
				userID = &uid
			}

			movement := models.StockMovement{
				ProductID:   product.ID,
				BatchID:     &batch.ID,
				WarehouseID: warehouse.ID,
				BranchID:    branchID.(uint),
				UserID:      userID,
				Type:        models.MovementTypeAdjustment,
				Quantity:    diff,
				Reference:   fmt.Sprintf("Direct Edit Sync (From %d to %d)", currentStock, input.Stock),
			}
			if err := tx.Create(&movement).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product and sync stock: " + err.Error()})
		return
	}

	userIDValue, exists := c.Get("userID")
	if exists {
		if oldPrice != product.Price {
			h.LogService.Record(userIDValue.(uint), "UPDATE_PRICE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Price changed for %s: P%.2f -> P%.2f", product.Name, oldPrice, product.Price), c.ClientIP())
		} else {
			h.LogService.Record(userIDValue.(uint), "UPDATE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Updated details/stock for %s", product.Name), c.ClientIP())
		}
	}

	// Reload with relationships AND calculated stock
	database.DB.Preload("Category").Preload("Brand").
		Select("products.*, (SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = products.id AND branch_id = ?) as stock", branchID).
		First(&product, product.ID)

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
