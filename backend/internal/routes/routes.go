package routes

import (
	"net/http"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/handlers"
	"smsystem-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Handlers holds all handler instances.
type Handlers struct {
	Auth     *handlers.AuthHandler
	Category *handlers.CategoryHandler
	Brand    *handlers.BrandHandler
	Product  *handlers.ProductHandler
	Customer *handlers.CustomerHandler
	Order    *handlers.OrderHandler
}

// Setup configures all API routes.
func Setup(router *gin.Engine, cfg *config.Config, h *Handlers) {
	// Health check
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "SMSystem API is running",
		})
	})

	// ─── Public auth routes ───
	auth := router.Group("/api/auth")
	{
		auth.POST("/register", h.Auth.Register)
		auth.POST("/login", h.Auth.Login)
	}

	// ─── Protected routes (require valid JWT) ───
	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg))
	{
		// Auth
		protected.GET("/auth/me", h.Auth.GetMe)

		// Dashboard
		protected.GET("/dashboard", func(c *gin.Context) {
			userEmail, _ := c.Get("userEmail")
			userRole, _ := c.Get("userRole")
			c.JSON(http.StatusOK, gin.H{
				"message": "Welcome to the dashboard",
				"email":   userEmail,
				"role":    userRole,
			})
		})

		// ─── Categories ───
		categories := protected.Group("/categories")
		{
			categories.GET("", h.Category.List)
			categories.GET("/:id", h.Category.GetByID)
		}

		// ─── Brands ───
		brands := protected.Group("/brands")
		{
			brands.GET("", h.Brand.List)
			brands.GET("/:id", h.Brand.GetByID)
		}

		// ─── Products ───
		products := protected.Group("/products")
		{
			products.GET("", h.Product.List)
			products.GET("/:id", h.Product.GetByID)
		}

		// ─── Customers ───
		customers := protected.Group("/customers")
		{
			customers.GET("", h.Customer.List)
			customers.GET("/:id", h.Customer.GetByID)
			customers.POST("", h.Customer.Create)
			customers.PUT("/:id", h.Customer.Update)
		}

		// ─── Orders ───
		orders := protected.Group("/orders")
		{
			orders.GET("", h.Order.List)
			orders.GET("/:id", h.Order.GetByID)
			orders.POST("", h.Order.Create)
		}

		// ─── Admin-only routes ───
		admin := protected.Group("")
		admin.Use(middleware.RequireRole("admin"))
		{
			// Category CUD
			admin.POST("/categories", h.Category.Create)
			admin.PUT("/categories/:id", h.Category.Update)
			admin.DELETE("/categories/:id", h.Category.Delete)

			// Brand CUD
			admin.POST("/brands", h.Brand.Create)
			admin.PUT("/brands/:id", h.Brand.Update)
			admin.DELETE("/brands/:id", h.Brand.Delete)

			// Product CUD
			admin.POST("/products", h.Product.Create)
			admin.PUT("/products/:id", h.Product.Update)
			admin.DELETE("/products/:id", h.Product.Delete)

			// Customer delete
			admin.DELETE("/customers/:id", h.Customer.Delete)

			// Order management
			admin.PUT("/orders/:id/status", h.Order.UpdateStatus)
			admin.DELETE("/orders/:id", h.Order.Delete)
		}
	}
}
