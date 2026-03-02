package routes

import (
	"net/http"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/handlers"
	"smsystem-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Setup configures all API routes.
func Setup(router *gin.Engine, cfg *config.Config, authHandler *handlers.AuthHandler) {
	// Health check
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "SMSystem API is running",
		})
	})

	// Public auth routes
	auth := router.Group("/api/auth")
	{
		auth.POST("/register", authHandler.Register)
		auth.POST("/login", authHandler.Login)
	}

	// Protected routes (require valid JWT)
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg))
	{
		protected.GET("/auth/me", authHandler.GetMe)

		// Dashboard placeholder (any authenticated user)
		protected.GET("/dashboard", func(c *gin.Context) {
			userEmail, _ := c.Get("userEmail")
			userRole, _ := c.Get("userRole")
			c.JSON(http.StatusOK, gin.H{
				"message": "Welcome to the dashboard",
				"email":   userEmail,
				"role":    userRole,
			})
		})

		// Admin-only routes
		admin := protected.Group("/admin")
		admin.Use(middleware.RequireRole("admin"))
		{
			admin.GET("/users", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{
					"message": "Admin users endpoint - coming in Phase 2",
				})
			})
		}
	}
}
