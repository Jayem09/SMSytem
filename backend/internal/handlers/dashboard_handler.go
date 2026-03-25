package handlers

import (
	"fmt"
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

type ProductRevenue struct {
	Product string  `json:"product"`
	Revenue float64 `json:"revenue"`
	Profit  float64 `json:"profit"`
	Income  float64 `json:"income"`
}

type ProductProfit struct {
	ProductName string  `json:"product_name"`
	Percentage  float64 `json:"percentage"`
}

type CategoryRevenue struct {
	Category string  `json:"category"`
	Revenue  float64 `json:"revenue"`
	Income   float64 `json:"income"`
}

type CategoryProfit struct {
	CategoryName string  `json:"category_name"`
	Percentage   float64 `json:"percentage"`
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	branchIDValue, _ := c.Get("branchID")
	userRole, _ := c.Get("userRole")
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	if userRole == "super_admin" {
		branchQuery := c.Query("branch_id")
		if branchQuery == "ALL" {
			branchID = 0
		} else if branchQuery != "" {
			var bID uint
			fmt.Sscanf(branchQuery, "%d", &bID)
			if bID > 0 {
				branchID = bID
			}
		}
	}

	var totalSales float64
	var totalExpenses float64
	var productCount int64
	var orderCount int64
	var customerCount int64

	ordersQuery := database.DB.Model(&models.Order{})
	expensesQuery := database.DB.Model(&models.Expense{})
	if branchID != 0 {
		ordersQuery = ordersQuery.Where("branch_id = ?", branchID)
		expensesQuery = expensesQuery.Where("branch_id = ?", branchID)
	}

	ordersQuery.Select("COALESCE(SUM(total_amount), 0)").Scan(&totalSales)
	expensesQuery.Select("COALESCE(SUM(amount), 0)").Scan(&totalExpenses)
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
	stockSubquery := "(SELECT COALESCE(SUM(batches.quantity), 0) FROM batches WHERE batches.product_id = products.id"
	var queryArgs []interface{}
	if branchID != 0 {
		stockSubquery += " AND batches.branch_id = ?"
		queryArgs = append(queryArgs, branchID)
	}
	stockSubquery += ") as stock"

	whereArgs := append([]interface{}{}, queryArgs...)
	whereArgs = append(whereArgs, 5)

	database.DB.Select("products.*, "+stockSubquery, queryArgs...).
		Where(stockSubquery+" <= ?", whereArgs...).
		Limit(5).Find(&lowStockProducts)

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

	topProductsQuery.Group("products.id, products.name, categories.name").
		Order("total_qty DESC").
		Limit(5).
		Scan(&topProducts)

	// Get category revenue for pie chart
	var categoryRevenue []CategoryRevenue
	crQuery := database.DB.Table("order_items").
		Select("COALESCE(categories.name, 'Uncategorized') as category, COALESCE(SUM(order_items.subtotal), 0) as revenue, COALESCE(SUM(order_items.subtotal), 0) as income").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Joins("LEFT JOIN categories ON categories.id = products.category_id").
		Group("categories.id, categories.name").
		Order("revenue DESC")

	if branchID != 0 {
		crQuery = crQuery.Where("orders.branch_id = ?", branchID)
	}
	crQuery.Scan(&categoryRevenue)

	// Calculate revenue percentages for pie chart (by category)
	var totalCategoryRevenue float64
	for _, c := range categoryRevenue {
		totalCategoryRevenue += c.Revenue
	}
	var categoryProfits []CategoryProfit
	if totalCategoryRevenue > 0 {
		for _, c := range categoryRevenue {
			percentage := (c.Revenue / totalCategoryRevenue) * 100
			if percentage > 0 {
				categoryProfits = append(categoryProfits, CategoryProfit{
					CategoryName: c.Category,
					Percentage:   percentage,
				})
			}
		}
	}

	// Get product revenue for bar/line charts (top 8 products)
	// revenue = total sales, profit = sales - (cost × qty), income = total sales
	var productRevenue []ProductRevenue
	prQuery := database.DB.Table("order_items").
		Select("products.name as product, COALESCE(SUM(order_items.subtotal), 0) as revenue, COALESCE(SUM(order_items.subtotal) - SUM(order_items.quantity * COALESCE(products.cost_price, 0)), 0) as profit, COALESCE(SUM(order_items.subtotal), 0) as income").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Group("products.id, products.name").
		Order("revenue DESC").
		Limit(8)

	if branchID != 0 {
		prQuery = prQuery.Where("orders.branch_id = ?", branchID)
	}
	prQuery.Scan(&productRevenue)

	var currentSales, prevSales float64
	var currentExpenses, prevExpenses float64

	cmStart := "DATE_FORMAT(NOW() ,'%Y-%m-01')"

	pmStart := "DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH) ,'%Y-%m-01')"
	pmEnd := "LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH))"

	ordersQuery.Where("created_at >= " + cmStart).Select("COALESCE(SUM(total_amount), 0)").Scan(&currentSales)
	database.DB.Model(&models.Order{}).
		Where(func() string {
			if branchID != 0 {
				return "branch_id = ?"
			}
			return "1=1"
		}(), branchID).
		Where("created_at BETWEEN " + pmStart + " AND " + pmEnd).
		Select("COALESCE(SUM(total_amount), 0)").Scan(&prevSales)

	expensesQuery.Where("created_at >= " + cmStart).Select("COALESCE(SUM(amount), 0)").Scan(&currentExpenses)

	database.DB.Model(&models.Expense{}).
		Where(func() string {
			if branchID != 0 {
				return "branch_id = ?"
			}
			return "1=1"
		}(), branchID).
		Where("created_at BETWEEN " + pmStart + " AND " + pmEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&prevExpenses)

	calculateChange := func(current, prev float64) string {
		if prev == 0 {
			if current > 0 {
				return "+100%"
			}
			return "0%"
		}
		change := ((current - prev) / prev) * 100
		if change >= 0 {
			return fmt.Sprintf("+%.1f%%", change)
		}
		return fmt.Sprintf("%.1f%%", change)
	}

	salesChange := calculateChange(currentSales, prevSales)
	expensesChange := calculateChange(currentExpenses, prevExpenses)

	currentProfit := currentSales - currentExpenses
	prevProfit := prevSales - prevExpenses
	profitChange := calculateChange(currentProfit, prevProfit)

	c.JSON(http.StatusOK, gin.H{
		"total_sales":        totalSales,
		"total_expenses":     totalExpenses,
		"net_profit":         totalSales - totalExpenses,
		"sales_change":       salesChange,
		"expenses_change":    expensesChange,
		"profit_change":      profitChange,
		"product_count":      productCount,
		"order_count":        orderCount,
		"customer_count":     customerCount,
		"sales_trend":        salesTrend,
		"low_stock_products": lowStockProducts,
		"top_advisors_today": topAdvisors,
		"top_products_today": topProducts,
		"category_profits":   categoryProfits,
		"product_revenue":    productRevenue,
	})
}
