package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/handlers"
	"smsystem-backend/internal/middleware"
	"smsystem-backend/internal/routes"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

var allowedOrigins = []string{
	"http://localhost:3000",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://168.144.46.137:5173",
	"tauri://",
	"tauri://localhost",
	"http://localhost",
}

func isOriginAllowed(origin string) bool {
	for _, allowed := range allowedOrigins {
		if origin == allowed {
			return true
		}
	}
	return false
}

func main() {
	cfg := config.Load()
	config.MustValidate(cfg)
	log.Println("Configuration loaded")

	database.Connect(cfg)
	log.Println("Database ready")

	services.InitBroadcaster()
	log.Println("Event broadcaster ready")

	authService := services.NewAuthService(cfg)
	logService := services.NewLogService()
	backupService := services.NewBackupService(cfg)
	emailService := services.NewEmailService()

	// Initialize backup scheduler if enabled
	if cfg.AutoBackupEnabled {
		backupScheduler := services.NewBackupScheduler(cfg, backupService)
		backupScheduler.Start()
		log.Printf("Auto-backup scheduler enabled: %s (retention: %d, compress: %v)",
			cfg.AutoBackupCron, cfg.BackupRetention, cfg.BackupCompress)
	}

	terminalService := services.NewTerminalService(cfg.TerminalSimulation, cfg.TerminalPort)

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
		Transfer:      handlers.NewTransferHandler(logService, emailService),
		Search:        handlers.NewSearchHandler(),
		System:        handlers.NewSystemHandler(backupService),
		Transaction:   handlers.NewTransactionHandler(),
		Analytics:     handlers.NewAnalyticsHandler(),
		Promo:         handlers.NewPromoHandler(emailService),
		Event:         handlers.NewEventHandler(cfg),
		Email:         emailService,
	}

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	router.Use(gin.Recovery())
	router.Use(middleware.MetricsMiddleware())

	router.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin != "" && isOriginAllowed(origin) {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	routes.Setup(router, cfg, h)

	// Show ALL routes
	router.GET("/api/listroutes", func(c *gin.Context) {
		var routes []string
		for _, r := range router.Routes() {
			routes = append(routes, r.Path+" ("+r.Method+")")
		}
		c.JSON(200, gin.H{"all_routes": routes})
	})

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	srv := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	go func() {
		log.Printf("Server starting on http://localhost%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	logService.Shutdown()

	log.Println("Server exited properly")
}
