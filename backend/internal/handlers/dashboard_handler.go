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

func (h *DashboardHandler) GetStats(c *gin.Context) {
	var totalSales float64
	var totalExpenses float64
	var productCount int64
	var orderCount int64
	var customerCount int64

	database.DB.Model(&models.Order{}).Select("SUM(total_amount)").Scan(&totalSales)
	database.DB.Model(&models.Expense{}).Select("SUM(amount)").Scan(&totalExpenses)
	database.DB.Model(&models.Product{}).Count(&productCount)
	database.DB.Model(&models.Order{}).Count(&orderCount)
	database.DB.Model(&models.Customer{}).Count(&customerCount)

	var salesTrend []DailySale
	database.DB.Model(&models.Order{}).
		Select("DATE(created_at) as date, SUM(total_amount) as amount").
		Where("created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&salesTrend)

	var lowStockProducts []models.Product
	database.DB.Where("stock <= ?", 5).Limit(5).Find(&lowStockProducts)

	c.JSON(http.StatusOK, gin.H{
		"total_sales":        totalSales,
		"total_expenses":     totalExpenses,
		"net_profit":         totalSales - totalExpenses,
		"product_count":      productCount,
		"order_count":        orderCount,
		"customer_count":     customerCount,
		"sales_trend":        salesTrend,
		"low_stock_products": lowStockProducts,
	})
}
