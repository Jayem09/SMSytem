package handlers

import (
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BranchHandler struct {
	LogService *services.LogService
}

func NewBranchHandler(logSvc *services.LogService) *BranchHandler {
	return &BranchHandler{LogService: logSvc}
}


func (h *BranchHandler) List(c *gin.Context) {
	var branches []models.Branch
	if err := database.DB.Find(&branches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch branches"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"branches": branches})
}


func (h *BranchHandler) Create(c *gin.Context) {
	var branch models.Branch
	if err := c.ShouldBindJSON(&branch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
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

	c.JSON(http.StatusCreated, branch)
}


func (h *BranchHandler) Update(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var branch models.Branch
	if err := database.DB.First(&branch, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Branch not found"})
		return
	}

	if err := c.ShouldBindJSON(&branch); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Save(&branch).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update branch"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UPDATE", "Branch", strconv.Itoa(id), "Updated branch details: "+branch.Name, c.ClientIP())
	}

	c.JSON(http.StatusOK, branch)
}
