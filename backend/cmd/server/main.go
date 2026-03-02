package main

import (
	"fmt"
	"log"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/handlers"
	"smsystem-backend/internal/routes"
	"smsystem-backend/internal/services"

	"github.com/gin-contrib/cors"
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

	h := &routes.Handlers{
		Auth:     handlers.NewAuthHandler(authService),
		Category: handlers.NewCategoryHandler(),
		Brand:    handlers.NewBrandHandler(),
		Product:  handlers.NewProductHandler(),
		Customer: handlers.NewCustomerHandler(),
		Order:    handlers.NewOrderHandler(),
	}

	// Setup Gin router
	router := gin.Default()

	// CORS configuration for React dev server
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "http://localhost:1420"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Setup routes
	routes.Setup(router, cfg, h)

	// Start server
	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("Server starting on http://localhost%s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
