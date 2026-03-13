package handlers

import (
	"fmt"
	"log"
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	LogService *services.LogService
}

func NewUserHandler(logService *services.LogService) *UserHandler {
	return &UserHandler{LogService: logService}
}


type UserResponse struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`
	BranchID   uint   `json:"branch_id"`
	BranchName string `json:"branch_name"`
	CreatedAt  string `json:"created_at"`
}

func (h *UserHandler) List(c *gin.Context) {
	var users []models.User
	query := database.DB.Preload("Branch").Order("id desc")

	isSuperAdmin, _ := c.Get("isSuperAdmin")
	if isSuperAdmin != true {
		branchID, _ := c.Get("branchID")
		query = query.Where("branch_id = ?", branchID)
	}

	if err := query.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	
	var response []UserResponse
	for _, u := range users {
		response = append(response, UserResponse{
			ID:         u.ID,
			Name:       u.Name,
			Email:      u.Email,
			Role:       u.Role,
			BranchID:   u.BranchID,
			BranchName: u.Branch.Name,
			CreatedAt:  u.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, gin.H{"users": response})
}


func (h *UserHandler) GetStaffList(c *gin.Context) {
	var users []models.User
	if err := database.DB.Select("id", "name").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch staff list"})
		return
	}

	var response []map[string]interface{}
	for _, u := range users {
		response = append(response, map[string]interface{}{
			"id":   u.ID,
			"name": u.Name,
		})
	}

	c.JSON(http.StatusOK, gin.H{"staff": response})
}


func (h *UserHandler) UpdateRole(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Role string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Role != "admin" && req.Role != "cashier" && req.Role != "user" && req.Role != "purchasing" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role specified"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	
	if user.Role == "admin" && req.Role != "admin" {
		var adminCount int64
		database.DB.Model(&models.User{}).Where("role = ? AND branch_id = ?", "admin", user.BranchID).Count(&adminCount)
		if adminCount <= 1 {
			c.JSON(http.StatusConflict, gin.H{"error": "Cannot demote the last admin of this branch."})
			return
		}
	}

	
	isSuperAdmin, _ := c.Get("isSuperAdmin")
	if isSuperAdmin != true {
		branchID, _ := c.Get("branchID")
		if user.BranchID != branchID.(uint) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only manage staff within your branch"})
			return
		}
	}

	if err := database.DB.Model(&user).Update("role", req.Role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	currentUserID, _ := c.Get("userID")
	if currentUserID != nil {
		h.LogService.Record(currentUserID.(uint), "UPDATE_ROLE", "User", id, fmt.Sprintf("Changed role for %s to %s", user.Name, req.Role), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "User role updated successfully"})
}


func (h *UserHandler) ResetPassword(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Password string `json:"password" binding:"required,min=6"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	
	currentUserID, exists := c.Get("userID")
	if exists && currentUserID.(uint) == user.ID {
		c.JSON(http.StatusConflict, gin.H{"error": "You should use your profile settings to change your own password."})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash password during reset: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process the new password"})
		return
	}

	if err := database.DB.Model(&user).Update("password", string(hashedPassword)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password in database"})
		return
	}

	if currentUserID != nil {
		h.LogService.Record(currentUserID.(uint), "PASSWORD_RESET", "User", id, fmt.Sprintf("Reset password for user %s", user.Name), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "User password reset successfully"})
}


func (h *UserHandler) UpdateBranch(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		BranchID uint `json:"branch_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	
	isSuperAdmin, _ := c.Get("isSuperAdmin")
	if isSuperAdmin != true {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only Super Admin can reassign staff to different branches"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := database.DB.Model(&user).Update("branch_id", req.BranchID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update branch"})
		return
	}

	currentUserID, _ := c.Get("userID")
	if currentUserID != nil {
		h.LogService.Record(currentUserID.(uint), "UPDATE_BRANCH", "User", id, fmt.Sprintf("Changed branch for %s to #%d", user.Name, req.BranchID), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "User branch updated successfully"})
}


func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	
	isSuperAdmin, _ := c.Get("isSuperAdmin")
	if isSuperAdmin != true {
		branchID, _ := c.Get("branchID")
		if user.BranchID != branchID.(uint) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete staff within your branch"})
			return
		}
	}

	
	currentUserID, exists := c.Get("userID")
	if exists && currentUserID.(uint) == user.ID {
		c.JSON(http.StatusConflict, gin.H{"error": "You cannot delete your own account."})
		return
	}

	if err := database.DB.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	if currentUserID != nil {
		h.LogService.Record(currentUserID.(uint), "DELETE", "User", id, fmt.Sprintf("Deleted user %s", user.Name), c.ClientIP())
	}

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}
