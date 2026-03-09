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

// UserResponse is used to return user data without the hash
type UserResponse struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CreatedAt string `json:"created_at"`
}

// List fetches all registered users
func (h *UserHandler) List(c *gin.Context) {
	var users []models.User
	if err := database.DB.Order("id desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// Mask passwords before sending to frontend
	var response []UserResponse
	for _, u := range users {
		response = append(response, UserResponse{
			ID:        u.ID,
			Name:      u.Name,
			Email:     u.Email,
			Role:      u.Role,
			CreatedAt: u.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, response)
}

// UpdateRole changes a specific user's role (admin or cashier)
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

	// Prevent removing the last admin (basic safety check)
	if user.Role == "admin" && req.Role != "admin" {
		var adminCount int64
		database.DB.Model(&models.User{}).Where("role = ?", "admin").Count(&adminCount)
		if adminCount <= 1 {
			c.JSON(http.StatusConflict, gin.H{"error": "Cannot demote the last admin in the system."})
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

// ResetPassword allows admins to force reset a user's password
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

	// Prevent admin from resetting their own password here (they should use a standard profile update)
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

// Delete permanently removes a user account
func (h *UserHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var user models.User
	if err := database.DB.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Prevent admin self-deletion
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
