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
	branchID, _ := GetUintFromContext(c, "branchID")
	userRole, _ := c.Get("userRole")
	roleStr, _ := userRole.(string)

	var suppliers []models.Supplier
	// Only super_admin sees all suppliers, others see only their branch's linked ones
	if roleStr == "super_admin" {
		if err := database.DB.Order("name ASC").Find(&suppliers).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch suppliers"})
			return
		}
	} else if branchID > 0 {
		if err := database.DB.
			Joins("INNER JOIN branch_suppliers bs ON bs.supplier_id = suppliers.id AND bs.branch_id = ?", branchID).
			Order("name ASC").
			Find(&suppliers).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch suppliers"})
			return
		}
	} else {
		// No branch assigned, return empty
		suppliers = []models.Supplier{}
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

	// Auto-link supplier to creator's branch
	branchID, _ := GetUintFromContext(c, "branchID")
	if branchID > 0 {
		link := models.BranchSupplier{
			BranchID:   branchID,
			SupplierID: supplier.ID,
		}
		database.DB.Create(&link)
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

func (h *SupplierHandler) LinkToBranch(c *gin.Context) {
	supplierID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}
	branchIDParam, err := strconv.ParseUint(c.Param("branchId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid branch ID"})
		return
	}

	var supplier models.Supplier
	if err := database.DB.First(&supplier, supplierID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Supplier not found"})
		return
	}

	var branch models.Branch
	if err := database.DB.First(&branch, branchIDParam).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Branch not found"})
		return
	}

	link := models.BranchSupplier{
		BranchID:   uint(branchIDParam),
		SupplierID: uint(supplierID),
	}

	if err := database.DB.Create(&link).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Supplier is already linked to this branch"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "LINK", "BranchSupplier", fmt.Sprintf("%d-%d", supplierID, branchIDParam), fmt.Sprintf("Linked supplier %s to branch %s", supplier.Name, branch.Name), c.ClientIP())
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Supplier linked to branch"})
}

func (h *SupplierHandler) UnlinkFromBranch(c *gin.Context) {
	supplierID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}
	branchIDParam, err := strconv.ParseUint(c.Param("branchId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid branch ID"})
		return
	}

	result := database.DB.Where("supplier_id = ? AND branch_id = ?", supplierID, branchIDParam).Delete(&models.BranchSupplier{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Link not found"})
		return
	}

	userIDValue, _ := c.Get("userID")
	if userIDValue != nil {
		h.LogService.Record(userIDValue.(uint), "UNLINK", "BranchSupplier", fmt.Sprintf("%d-%d", supplierID, branchIDParam), fmt.Sprintf("Unlinked supplier #%d from branch #%d", supplierID, branchIDParam), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "Supplier unlinked from branch"})
}

func (h *SupplierHandler) GetLinkedBranches(c *gin.Context) {
	supplierID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid supplier ID"})
		return
	}

	var branches []models.Branch
	if err := database.DB.
		Joins("INNER JOIN branch_suppliers bs ON bs.branch_id = branches.id AND bs.supplier_id = ?", supplierID).
		Find(&branches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch linked branches"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"branches": branches})
}
