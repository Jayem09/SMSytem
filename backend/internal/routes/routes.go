package routes

import (
	"net/http"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/handlers"
	"smsystem-backend/internal/middleware"

	"github.com/gin-gonic/contrib/static"
	"github.com/gin-gonic/gin"
)

type Handlers struct {
	Auth          *handlers.AuthHandler
	Category      *handlers.CategoryHandler
	Brand         *handlers.BrandHandler
	Product       *handlers.ProductHandler
	Customer      *handlers.CustomerHandler
	Order         *handlers.OrderHandler
	Expense       *handlers.ExpenseHandler
	Dashboard     *handlers.DashboardHandler
	Import        *handlers.ImportHandler
	Log           *handlers.LogHandler
	Terminal      *handlers.TerminalHandler
	Supplier      *handlers.SupplierHandler
	PurchaseOrder *handlers.PurchaseOrderHandler
	User          *handlers.UserHandler
	Inventory     *handlers.InventoryHandler
	Settings      *handlers.SettingsHandler
	Report        *handlers.ReportHandler
	Branch        *handlers.BranchHandler
	Transfer      *handlers.TransferHandler
	Search        *handlers.SearchHandler
	System        *handlers.SystemHandler
	Analytics     *handlers.AnalyticsHandler
}

func Setup(router *gin.Engine, cfg *config.Config, h *Handlers) {

	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "SMSystem API is running",
		})
	})

	router.GET("/api/status", h.System.GetStatus)

	auth := router.Group("/api/auth")
	{
		auth.POST("/register", h.Auth.Register)
		auth.POST("/login", h.Auth.Login)
	}

	protected := router.Group("/api")
	protected.Use(middleware.AuthMiddleware(cfg))
	{

		protected.GET("/auth/me", h.Auth.GetMe)

		protected.GET("/dashboard", h.Dashboard.GetStats)
		protected.GET("/analytics", h.Analytics.Query)
		protected.GET("/analytics/revenue", h.Analytics.GetRevenue)
		protected.GET("/search", h.Search.GlobalSearch)

		categories := protected.Group("/categories")
		{
			categories.GET("", h.Category.List)
			categories.GET("/:id", h.Category.GetByID)
		}

		brands := protected.Group("/brands")
		{
			brands.GET("", h.Brand.List)
			brands.GET("/:id", h.Brand.GetByID)
		}

		products := protected.Group("/products")
		{
			products.GET("", h.Product.List)
			products.GET("/:id", h.Product.GetByID)
		}

		customers := protected.Group("/customers")
		{
			customers.GET("", h.Customer.List)
			customers.GET("/crm-stats", h.Customer.GetCRMStats)
			customers.GET("/:id", h.Customer.GetByID)
			customers.POST("", h.Customer.Create)
			customers.PUT("/:id", h.Customer.Update)
		}

		orders := protected.Group("/orders")
		{
			orders.GET("", h.Order.List)
			orders.GET("/:id", h.Order.GetByID)
			orders.POST("", h.Order.Create)
			orders.PATCH("/:id/status", h.Order.UpdateStatus)
		}

		inventory := protected.Group("/inventory")
		{
			inventory.GET("/warehouses", h.Inventory.GetWarehouses)
			inventory.GET("/levels", h.Inventory.GetStockLevels)
			inventory.GET("/logs", h.Inventory.GetMovementLogs)
			inventory.GET("/low-stock", h.Inventory.GetLowStockReport)
			inventory.POST("/generate-pos", h.Inventory.GenerateDraftPOs)
			inventory.GET("/batches", h.Inventory.GetProductBatches)
			inventory.GET("/batches/:id/history", h.Inventory.GetBatchMovementHistory)

		}

		protected.GET("/branches", h.Branch.List)

		transfers := protected.Group("/transfers")
		{
			transfers.GET("", h.Transfer.List)
			transfers.GET("/pending-counts", h.Transfer.GetPendingCounts)
			transfers.POST("", h.Transfer.Create)

			transfers.PUT("/:id/status", h.Transfer.UpdateStatus)
		}

		admin := protected.Group("")
		admin.Use(middleware.RequireRole("admin", "super_admin"))
		{

			admin.POST("/categories", h.Category.Create)
			admin.PUT("/categories/:id", h.Category.Update)
			admin.DELETE("/categories/:id", h.Category.Delete)

			admin.POST("/brands", h.Brand.Create)
			admin.PUT("/brands/:id", h.Brand.Update)
			admin.DELETE("/brands/:id", h.Brand.Delete)

			admin.POST("/products", h.Product.Create)
			admin.PUT("/products/:id", h.Product.Update)
			admin.DELETE("/products/:id", h.Product.Delete)
			admin.POST("/products/import", h.Import.ImportProducts)

			admin.DELETE("/customers/:id", h.Customer.Delete)

			admin.DELETE("/orders/:id", h.Order.Delete)

			admin.GET("/logs", h.Log.List)

			admin.POST("/terminal/payment", h.Terminal.ProcessPayment)

			expenses := admin.Group("/expenses")
			{
				expenses.GET("", h.Expense.List)
				expenses.POST("", h.Expense.Create)
				expenses.PUT("/:id", h.Expense.Update)
				expenses.DELETE("/:id", h.Expense.Delete)
			}

			inventoryAdmin := admin.Group("/inventory")
			{
				inventoryAdmin.POST("/in", h.Inventory.StockIn)
				inventoryAdmin.POST("/out", h.Inventory.StockOut)
				inventoryAdmin.POST("/adjust", h.Inventory.AdjustStock)
			}

			suppliers := admin.Group("/suppliers")
			{
				suppliers.GET("", h.Supplier.List)
				suppliers.GET("/:id", h.Supplier.GetByID)
				suppliers.POST("", h.Supplier.Create)
				suppliers.PUT("/:id", h.Supplier.Update)
				suppliers.DELETE("/:id", h.Supplier.Delete)
			}

			purchaseOrders := admin.Group("/purchase-orders")
			{
				purchaseOrders.GET("", h.PurchaseOrder.List)
				purchaseOrders.GET("/:id", h.PurchaseOrder.GetByID)
				purchaseOrders.POST("", h.PurchaseOrder.Create)
				purchaseOrders.PUT("/:id/receive", h.PurchaseOrder.Receive)
				purchaseOrders.DELETE("/:id", h.PurchaseOrder.Delete)
			}

			users := admin.Group("/users")
			{
				users.GET("", h.User.List)
				users.PUT("/:id/role", h.User.UpdateRole)
				users.PUT("/:id/branch", h.User.UpdateBranch)
				users.PUT("/:id/reset-password", h.User.ResetPassword)
				users.DELETE("/:id", h.User.Delete)
			}

			settings := admin.Group("/settings")
			{
				settings.GET("", h.Settings.GetAll)
				settings.POST("", h.Settings.UpdateBulk)
			}

			reports := admin.Group("/reports")
			{
				reports.GET("/daily-summary", h.Report.GetDailySummary)
			}

			superAdmin := admin.Group("")
			superAdmin.Use(middleware.RequireRole("super_admin"))
			{

				branches := superAdmin.Group("/branches")
				{

					branches.POST("", h.Branch.Create)
					branches.PUT("/:id", h.Branch.Update)
				}
			}
		}
	}

	router.Use(static.Serve("/", static.LocalFile("./public", true)))

	router.NoRoute(func(c *gin.Context) {
		c.File("./public/index.html")
	})
}
