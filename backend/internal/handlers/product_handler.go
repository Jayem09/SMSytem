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
	CostPrice   float64 `json:"cost_price" binding:"min=0"`
	Stock       int     `json:"stock" binding:"min=0"`
	Size        string  `json:"size"`
	ParentID    *uint   `json:"parent_id"`
	ImageURL    string  `json:"image_url"`
	CategoryID  uint    `json:"category_id" binding:"required"`
	BrandID     uint    `json:"brand_id" binding:"required"`

	PCD         string `json:"pcd"`
	OffsetET    string `json:"offset_et"`
	Width       string `json:"width"`
	Bore        string `json:"bore"`
	Finish      string `json:"finish"`
	SpeedRating string `json:"speed_rating"`
	LoadIndex   string `json:"load_index"`
	DOTCode     string `json:"dot_code"`
	PlyRating   string `json:"ply_rating"`

	IsService      bool `json:"is_service"`
	PointsRequired int  `json:"points_required"`
	IsReward       bool `json:"is_reward"`
}

func (h *ProductHandler) List(c *gin.Context) {
	branchID, _ := GetUintFromContext(c, "branchID")

	var results []map[string]interface{}

	if branchID != 0 {
		err := database.DB.Raw(`
			SELECT p.id, p.name, p.description, p.price, p.cost_price, 
				COALESCE(b_stock.quantity, 0) as branch_stock, 
				p.size, p.parent_id, p.image_url, p.category_id, p.brand_id, p.reorder_level,
				p.primary_supplier_id, p.is_service, p.pcd, p.offset_et, p.width, p.bore, p.finish,
				p.speed_rating, p.load_index, p.dot_code, p.ply_rating, p.points_required, p.is_reward,
				p.created_at, p.updated_at,
				c.name as category_name, br.name as brand_name
			FROM products p 
			LEFT JOIN categories c ON p.category_id = c.id
			LEFT JOIN brands br ON p.brand_id = br.id
			LEFT JOIN (
				SELECT product_id, SUM(quantity) as quantity 
				FROM batches 
				WHERE branch_id = ? 
				GROUP BY product_id
			) b_stock ON p.id = b_stock.product_id
			WHERE p.deleted_at IS NULL 
			ORDER BY p.created_at DESC`,
			branchID).
			Scan(&results).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
			return
		}
	} else {
		err := database.DB.Raw(`
			SELECT p.id, p.name, p.description, p.price, p.cost_price, 
				COALESCE(b_stock.quantity, 0) as branch_stock, 
				p.size, p.parent_id, p.image_url, p.category_id, p.brand_id, p.reorder_level,
				p.primary_supplier_id, p.is_service, p.pcd, p.offset_et, p.width, p.bore, p.finish,
				p.speed_rating, p.load_index, p.dot_code, p.ply_rating, p.points_required, p.is_reward,
				p.created_at, p.updated_at,
				c.name as category_name, br.name as brand_name
			FROM products p 
			LEFT JOIN categories c ON p.category_id = c.id
			LEFT JOIN brands br ON p.brand_id = br.id
			LEFT JOIN (
				SELECT product_id, SUM(quantity) as quantity 
				FROM batches 
				GROUP BY product_id
			) b_stock ON p.id = b_stock.product_id
			WHERE p.deleted_at IS NULL 
			ORDER BY p.created_at DESC`).
			Scan(&results).Error
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
			return
		}
	}

	for _, r := range results {
		if catName, ok := r["category_name"].(string); ok && catName != "" {
			r["category"] = map[string]interface{}{"name": catName}
		} else {
			r["category"] = nil
		}

		if brandName, ok := r["brand_name"].(string); ok && brandName != "" {
			r["brand"] = map[string]interface{}{"name": brandName}
		} else {
			r["brand"] = nil
		}

		delete(r, "category_name")
		delete(r, "brand_name")

		if r["branch_stock"] == nil {
			r["branch_stock"] = 0
		} else {
			switch v := r["branch_stock"].(type) {
			case []uint8:
				var stock int
				fmt.Sscanf(string(v), "%d", &stock)
				r["branch_stock"] = stock
			case string:
				var stock int
				fmt.Sscanf(v, "%d", &stock)
				r["branch_stock"] = stock
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"products": results})
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var product models.Product
	branchID, _ := GetUintFromContext(c, "branchID")

	type ProductWithStock struct {
		models.Product
		Stock int `json:"stock"`
	}

	var queryArgs []interface{}
	var stockSubquery string
	if branchID != 0 {
		stockSubquery = "(SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE batches.product_id = products.id AND batches.branch_id = ?)"
		queryArgs = append(queryArgs, branchID)
	} else {
		stockSubquery = "(SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE batches.product_id = products.id)"
	}

	var productWithStock ProductWithStock
	if err := database.DB.Raw(`
		SELECT p.*, `+stockSubquery+` as stock 
		FROM products p 
		WHERE p.id = ? AND p.deleted_at IS NULL`,
		append(queryArgs, id)...).
		Scan(&productWithStock).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	product = productWithStock.Product
	product.Stock = productWithStock.Stock

	database.DB.Preload("Category").Preload("Brand").First(&product, id)
	c.JSON(http.StatusOK, gin.H{"product": product})
}

func (h *ProductHandler) Create(c *gin.Context) {
	var input productInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	var category models.Category
	if err := database.DB.First(&category, input.CategoryID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category not found"})
		return
	}

	var brand models.Brand
	if err := database.DB.First(&brand, input.BrandID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Brand not found"})
		return
	}

	product := models.Product{
		Name:           input.Name,
		Description:    input.Description,
		Price:          input.Price,
		CostPrice:      input.CostPrice,
		Stock:          input.Stock,
		Size:           input.Size,
		ParentID:       input.ParentID,
		ImageURL:       input.ImageURL,
		CategoryID:     input.CategoryID,
		BrandID:        input.BrandID,
		PCD:            input.PCD,
		OffsetET:       input.OffsetET,
		Width:          input.Width,
		Bore:           input.Bore,
		Finish:         input.Finish,
		SpeedRating:    input.SpeedRating,
		LoadIndex:      input.LoadIndex,
		DOTCode:        input.DOTCode,
		PlyRating:      input.PlyRating,
		IsService:      input.IsService,
		PointsRequired: input.PointsRequired,
		IsReward:       input.IsReward,
	}

	bID, _ := GetUintFromContext(c, "branchID")
	userID, _ := GetUintFromContext(c, "userID")

	if bID == 0 {
		bID = 1
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

		if input.Stock > 0 && !input.IsService {
			var warehouse models.Warehouse
			if err := tx.Where("branch_id = ?", bID).First(&warehouse).Error; err != nil {
				return fmt.Errorf("no warehouse found for this branch to store initial stock")
			}

			batch := models.Batch{
				ProductID:   product.ID,
				WarehouseID: warehouse.ID,
				BranchID:    bID,
				BatchNumber: "INITIAL",
				Quantity:    input.Stock,
			}
			if err := tx.Create(&batch).Error; err != nil {
				return err
			}

			var userIDPtr *uint
			if userID != 0 {
				uid := userID
				userIDPtr = &uid
			}

			movement := models.StockMovement{
				ProductID:   product.ID,
				BatchID:     &batch.ID,
				WarehouseID: warehouse.ID,
				BranchID:    bID,
				UserID:      userIDPtr,
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

	database.DB.Preload("Category").Preload("Brand").
		Select("products.*, (SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = products.id AND branch_id = ?) as stock", bID).
		First(&product, product.ID)

	h.LogService.Record(userID, "CREATE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Created product: %s with initial stock %d", product.Name, input.Stock), c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{"message": "Product created", "product": product})
}

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
	product.CostPrice = input.CostPrice
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
	product.Stock = input.Stock
	product.PointsRequired = input.PointsRequired
	product.IsReward = input.IsReward

	bID, _ := GetUintFromContext(c, "branchID")
	userID, _ := GetUintFromContext(c, "userID")

	if bID == 0 {
		bID = 1
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {

		var currentStock int
		tx.Model(&models.Batch{}).
			Where("product_id = ? AND branch_id = ?", product.ID, bID).
			Select("COALESCE(SUM(quantity), 0)").
			Row().Scan(&currentStock)

		if err := tx.Save(&product).Error; err != nil {
			return err
		}

		if err := tx.Model(&product).UpdateColumn("stock", input.Stock).Error; err != nil {
			return err
		}

		if !input.IsService && input.Stock != currentStock {
			diff := input.Stock - currentStock

			var warehouse models.Warehouse
			if err := tx.Where("branch_id = ?", bID).First(&warehouse).Error; err != nil {
				return fmt.Errorf("no warehouse found for this branch to store adjustment")
			}

			batch := models.Batch{
				ProductID:   product.ID,
				WarehouseID: warehouse.ID,
				BranchID:    bID,
				BatchNumber: fmt.Sprintf("ADJ-%s", time.Now().Format("20060102")),
				Quantity:    diff,
			}
			if err := tx.Create(&batch).Error; err != nil {
				return err
			}

			var userIDPtr *uint
			if userID != 0 {
				uid := userID
				userIDPtr = &uid
			}

			movement := models.StockMovement{
				ProductID:   product.ID,
				BatchID:     &batch.ID,
				WarehouseID: warehouse.ID,
				BranchID:    bID,
				UserID:      userIDPtr,
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

	if oldPrice != product.Price {
		h.LogService.Record(userID, "UPDATE_PRICE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Price changed for %s: P%.2f -> P%.2f", product.Name, oldPrice, product.Price), c.ClientIP())
	} else {
		h.LogService.Record(userID, "UPDATE", "Product", strconv.Itoa(int(product.ID)), fmt.Sprintf("Updated details/stock for %s", product.Name), c.ClientIP())
	}

	database.DB.Preload("Category").Preload("Brand").
		Select("products.*, (SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = products.id AND branch_id = ?) as stock", bID).
		First(&product, product.ID)

	c.JSON(http.StatusOK, gin.H{"message": "Product updated", "product": product})
}

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

	userID, _ := GetUintFromContext(c, "userID")
	h.LogService.Record(userID, "DELETE", "Product", strconv.Itoa(int(id)), fmt.Sprintf("Deleted product: %s", product.Name), c.ClientIP())
	c.JSON(http.StatusOK, gin.H{"message": "Product deleted"})
}
