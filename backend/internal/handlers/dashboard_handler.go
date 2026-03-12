package handlers

import (
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct{}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{}
}

type DailySale struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
}

type SA_Performance struct {
	AdvisorName string  `json:"advisor_name"`
	TotalSales  float64 `json:"total_sales"`
	OrderCount  int     `json:"order_count"`
}

type Product_Performance struct {
	ProductName  string  `json:"product_name"`
	CategoryName string  `json:"category_name"`
	TotalQty     int     `json:"total_qty"`
	TotalSales   float64 `json:"total_sales"`
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	branchIDValue, _ := c.Get("branchID")
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	var totalSales float64
	var totalExpenses float64
	var productCount int64
	var orderCount int64
	var customerCount int64

	// Base queries
	ordersQuery := database.DB.Model(&models.Order{})
	expensesQuery := database.DB.Model(&models.Expense{})
	if branchID != 0 {
		ordersQuery = ordersQuery.Where("branch_id = ?", branchID)
		expensesQuery = expensesQuery.Where("branch_id = ?", branchID)
	}

	ordersQuery.Select("SUM(total_amount)").Scan(&totalSales)
	expensesQuery.Select("SUM(amount)").Scan(&totalExpenses)
	database.DB.Model(&models.Product{}).Count(&productCount)
	ordersQuery.Count(&orderCount)
	database.DB.Model(&models.Customer{}).Count(&customerCount)

	var salesTrend []DailySale
	ordersQuery.Select("DATE(created_at) as date, SUM(total_amount) as amount").
		Where("created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&salesTrend)

	var lowStockProducts []models.Product
	// If super admin, low stock is based on global stock. If branch, based on branch stock.
	if branchID == 0 {
		database.DB.Where("stock <= ?", 5).Limit(5).Find(&lowStockProducts)
	} else {
		// Calculate branch-specific low stock
		database.DB.Select("products.*, (SELECT SUM(quantity) FROM batches WHERE product_id = products.id AND branch_id = ?) as stock", branchID).
			Where("(SELECT SUM(quantity) FROM batches WHERE product_id = products.id AND branch_id = ?) <= ?", branchID, 5).
			Limit(5).Find(&lowStockProducts)
	}

	var topAdvisors []SA_Performance
	ordersQuery.Select("service_advisor_name as advisor_name, SUM(total_amount) as total_sales, COUNT(id) as order_count").
		Where("DATE(created_at) = CURDATE() AND service_advisor_name != ''").
		Group("service_advisor_name").
		Order("total_sales DESC").
		Limit(5).
		Scan(&topAdvisors)

	var topProducts []Product_Performance
	topProductsQuery := database.DB.Table("order_items").
		Select("products.name as product_name, categories.name as category_name, SUM(order_items.quantity) as total_qty, SUM(order_items.subtotal) as total_sales").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Joins("LEFT JOIN categories ON categories.id = products.category_id").
		Where("DATE(orders.created_at) = CURDATE()")
	
	if branchID != 0 {
		topProductsQuery = topProductsQuery.Where("orders.branch_id = ?", branchID)
	}

	topProductsQuery.Group("products.id").
		Order("total_qty DESC").
		Limit(5).
		Scan(&topProducts)

	c.JSON(http.StatusOK, gin.H{
		"total_sales":        totalSales,
		"total_expenses":     totalExpenses,
		"net_profit":         totalSales - totalExpenses,
		"product_count":      productCount,
		"order_count":        orderCount,
		"customer_count":     customerCount,
		"sales_trend":        salesTrend,
		"low_stock_products": lowStockProducts,
		"top_advisors_today": topAdvisors,
		"top_products_today": topProducts,
	})
}
