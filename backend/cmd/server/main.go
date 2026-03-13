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
	
	cfg := config.Load()
	log.Println("Configuration loaded")

	
	database.Connect(cfg)
	log.Println("Database ready")

	
	authService := services.NewAuthService(cfg)
	logService := services.NewLogService()
	
	terminalService := services.NewTerminalService(true, "COM1")

	h := &routes.Handlers{
		Auth:          handlers.NewAuthHandler(authService, logService),
		Category:      handlers.NewCategoryHandler(logService),
		Brand:         handlers.NewBrandHandler(logService),
		Product:       handlers.NewProductHandler(logService),
		Customer:      handlers.NewCustomerHandler(logService),
		Order:         handlers.NewOrderHandler(logService),
		Expense:       handlers.NewExpenseHandler(logService),
		Dashboard:     handlers.NewDashboardHandler(),
		Import:        handlers.NewImportHandler(),
		Log:           handlers.NewLogHandler(),
		Terminal:      handlers.NewTerminalHandler(terminalService),
		Supplier:      handlers.NewSupplierHandler(logService),
		PurchaseOrder: handlers.NewPurchaseOrderHandler(logService),
		User:          handlers.NewUserHandler(logService),
		Inventory:     handlers.NewInventoryHandler(logService),
		Settings:      handlers.NewSettingsHandler(logService),
		Report:        handlers.NewReportHandler(),
		Branch:        handlers.NewBranchHandler(logService),
		Transfer:      handlers.NewTransferHandler(logService),
	}

	
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	
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

	
	routes.Setup(router, cfg, h)

	
	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Server starting on http://localhost%s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
