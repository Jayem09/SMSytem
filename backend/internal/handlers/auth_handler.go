package handlers

import (
	"log"
	"net/http"
	"strconv"

	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)


type AuthHandler struct {
	AuthService *services.AuthService
	LogService  *services.LogService
}


func NewAuthHandler(authService *services.AuthService, logService *services.LogService) *AuthHandler {
	return &AuthHandler{AuthService: authService, LogService: logService}
}



func (h *AuthHandler) Register(c *gin.Context) {
	var input services.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	response, err := h.AuthService.Register(input)
	if err != nil {
		log.Printf("[Registration Error] %v", err)
		status := http.StatusInternalServerError
		if err.Error() == "email already registered" {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"token":   response.Token,
		"user":    response.User,
	})
}



func (h *AuthHandler) Login(c *gin.Context) {
	var input services.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Validation failed",
			"details": err.Error(),
		})
		return
	}

	response, err := h.AuthService.Login(input)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	
	h.LogService.Record(response.User.ID, "LOGIN", "System", strconv.Itoa(int(response.User.ID)), "User logged in", c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   response.Token,
		"user":    response.User,
	})
}



func (h *AuthHandler) GetMe(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	user, err := h.AuthService.GetUserByID(userID.(uint))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": user})
}
