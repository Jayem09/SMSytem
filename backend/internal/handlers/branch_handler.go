package handlers

import (
	"log"
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BranchHandler struct {
	LogService   *services.LogService
	CacheService *services.CacheService
}

func NewBranchHandler(logSvc *services.LogService, cacheSvc *services.CacheService) *BranchHandler {
	return &BranchHandler{LogService: logSvc, CacheService: cacheSvc}
}

func (h *BranchHandler) List(c *gin.Context) {
	ctx := c.Request.Context()
	branchID, _ := GetUintFromContext(c, "branchID")
	userRole, _ := c.Get("userRole")
	roleStr := ""
	if userRole != nil {
		roleStr = userRole.(string)
	}

	// Build cache key with branch ID, role, and query params
	cacheKey := services.BuildScopedListKey(services.BranchListPrefix, branchID, roleStr, c.Request.URL.Query())

	// Try read-through cache first (60s TTL)
	if h.CacheService != nil && h.CacheService.Enabled() {
		var cached []map[string]interface{}
		found, err := h.CacheService.GetJSON(ctx, cacheKey, &cached)
		if err == nil && found && len(cached) > 0 {
			c.JSON(http.StatusOK, gin.H{"branches": cached})
			return
		}
	}

	var branches []models.Branch
	if err := database.DB.Find(&branches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch branches"})
		return
	}

	// Convert to map for caching
	var results []map[string]interface{}
	for _, branch := range branches {
		results = append(results, map[string]interface{}{
			"id":         branch.ID,
			"name":       branch.Name,
			"code":       branch.Code,
			"address":   branch.Address,
			"phone":     branch.Phone,
			"email":     branch.Email,
			"is_active": branch.IsActive,
			"created_at": branch.CreatedAt,
			"updated_at": branch.UpdatedAt,
		})
	}

	// Cache the result with 60s TTL
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.SetJSON(ctx, cacheKey, results, 60*time.Second); err != nil {
			log.Printf("Warning: failed to cache branch list: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"branches": results})
}

func (h *BranchHandler) Create(c *gin.Context) {
	var input struct {
		Name     string `json:"name"`
		Code     string `json:"code"`
		Address  string `json:"address"`
		Phone    string `json:"phone"`
		Email    string `json:"email"`
		IsActive bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	branch := models.Branch{
		Name:     input.Name,
		Code:     input.Code,
		Address:  input.Address,
		Phone:    input.Phone,
		Email:    input.Email,
		IsActive: input.IsActive,
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&branch).Error; err != nil {
			return err
		}

		defaultWarehouse := models.Warehouse{
			Name:     "Main Warehouse",
			BranchID: branch.ID,
			Address:  "Default Location",
		}
		if err := tx.Create(&defaultWarehouse).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create branch and warehouse"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "CREATE", "Branch", strconv.Itoa(int(branch.ID)), "Created new branch: "+branch.Name, c.ClientIP())
	}

	// Invalidate branch list cache after successful create
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.InvalidateBranches(c.Request.Context()); err != nil {
			log.Printf("Warning: failed to invalidate branch list cache: %v", err)
		}
	}

	c.JSON(http.StatusCreated, branch)
}

func (h *BranchHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	log.Printf("Branch Update: id=%d", id)
	var branch models.Branch
	if err := database.DB.First(&branch, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Branch not found"})
		return
	}

	var input struct {
		Name     string `json:"name"`
		Code     string `json:"code"`
		Address  string `json:"address"`
		Phone    string `json:"phone"`
		Email    string `json:"email"`
		IsActive bool   `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	log.Printf("Branch Update input:%+v", input)

	branch.Name = input.Name
	branch.Code = input.Code
	branch.Address = input.Address
	branch.Phone = input.Phone
	branch.Email = input.Email
	branch.IsActive = input.IsActive

	if err := database.DB.Save(&branch).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update branch"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UPDATE", "Branch", strconv.Itoa(id), "Updated branch details: "+branch.Name, c.ClientIP())
	}

	// Invalidate branch list cache after successful update
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.InvalidateBranches(c.Request.Context()); err != nil {
			log.Printf("Warning: failed to invalidate branch list cache: %v", err)
		}
	}

	c.JSON(http.StatusOK, branch)
}
