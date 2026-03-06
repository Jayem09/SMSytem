package main

import (
	"fmt"
	"log"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/handlers"
	"smsystem-backend/internal/routes"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load configuration
	cfg := config.Load()
	log.Println("Configuration loaded")

	// Connect to database
	database.Connect(cfg)
	log.Println("Database ready")

	// Initialize services and handlers
	authService := services.NewAuthService(cfg)
	logService := services.NewLogService()
	// Initialize terminal service in Simulation Mode (true) for now.
	terminalService := services.NewTerminalService(true, "COM1")

	h := &routes.Handlers{
		Auth:          handlers.NewAuthHandler(authService),
		Category:      handlers.NewCategoryHandler(),
		Brand:         handlers.NewBrandHandler(),
		Product:       handlers.NewProductHandler(logService),
		Customer:      handlers.NewCustomerHandler(),
		Order:         handlers.NewOrderHandler(logService),
		Expense:       handlers.NewExpenseHandler(),
		Dashboard:     handlers.NewDashboardHandler(),
		Import:        handlers.NewImportHandler(),
		Log:           handlers.NewLogHandler(),
		Terminal:      handlers.NewTerminalHandler(terminalService),
		Supplier:      handlers.NewSupplierHandler(),
		PurchaseOrder: handlers.NewPurchaseOrderHandler(),
		User:          handlers.NewUserHandler(),
	}

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	// CORS configuration
	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Setup routes
	routes.Setup(router, cfg, h)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Server starting on http://localhost%s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
