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

type SupplierHandler struct {
	LogService *services.LogService
}

func NewSupplierHandler(logService *services.LogService) *SupplierHandler {
	return &SupplierHandler{LogService: logService}
}

type supplierInput struct {
	Name          string `json:"name" binding:"required,min=2,max=255"`
	ContactPerson string `json:"contact_person" binding:"max=255"`
	Phone         string `json:"phone" binding:"max=50"`
	Email         string `json:"email" binding:"max=255"`
	Address       string `json:"address"`
	Notes         string `json:"notes"`
}


func (h *SupplierHandler) List(c *gin.Context) {
	var suppliers []models.Supplier
	if err := database.DB.Order("name ASC").Find(&suppliers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch suppliers"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"suppliers": suppliers})
}


func (h *SupplierHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}

	var supplier models.Supplier
	if err := database.DB.First(&supplier, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"supplier": supplier})
}


func (h *SupplierHandler) Create(c *gin.Context) {
	var input supplierInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	supplier := models.Supplier{
		Name:          input.Name,
		ContactPerson: input.ContactPerson,
		Phone:         input.Phone,
		Email:         input.Email,
		Address:       input.Address,
		Notes:         input.Notes,
	}

	if err := database.DB.Create(&supplier).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Supplier already exists or creation failed"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "CREATE", "Supplier", strconv.Itoa(int(supplier.ID)), fmt.Sprintf("Created supplier: %s", supplier.Name), c.ClientIP())
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Supplier created", "supplier": supplier})
}


func (h *SupplierHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}

	var supplier models.Supplier
	if err := database.DB.First(&supplier, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
		return
	}

	var input supplierInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	supplier.Name = input.Name
	supplier.ContactPerson = input.ContactPerson
	supplier.Phone = input.Phone
	supplier.Email = input.Email
	supplier.Address = input.Address
	supplier.Notes = input.Notes

	if err := database.DB.Save(&supplier).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update supplier"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UPDATE", "Supplier", strconv.Itoa(int(supplier.ID)), fmt.Sprintf("Updated supplier: %s", supplier.Name), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Supplier updated", "supplier": supplier})
}


func (h *SupplierHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}

	result := database.DB.Delete(&models.Supplier{}, id)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "DELETE", "Supplier", strconv.Itoa(int(id)), fmt.Sprintf("Deleted supplier #%d", id), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Supplier deleted"})
}
