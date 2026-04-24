package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	CacheService *services.CacheService
}

func NewDashboardHandler(cache *services.CacheService) *DashboardHandler {
	return &DashboardHandler{CacheService: cache}
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
	ctx := c.Request.Context()
	branchIDValue, _ := c.Get("branchID")
	userRole, _ := c.Get("userRole")
	roleStr := ""
	if userRole != nil {
		roleStr = userRole.(string)
	}
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	if roleStr == "super_admin" {
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

	days := c.DefaultQuery("days", "0")

	// Build cache key with branch ID, role, and query params
	cacheKey := services.DashboardStatsKey(branchID, roleStr, c.Request.URL.Query())

	// Try read-through cache first
	if h.CacheService != nil && h.CacheService.Enabled() {
		var cached map[string]interface{}
		found, err := h.CacheService.GetJSON(ctx, cacheKey, &cached)
		if err == nil && found {
			// Cache hit - return immediately
			c.JSON(http.StatusOK, cached)
			return
		}
	}

	var dateFilter string
	if days != "0" {
		dateFilter = fmt.Sprintf("DATE_SUB(NOW(), INTERVAL %s DAY)", days)
	}

	_ = dateFilter // unused for now but kept for future filtering

	var totalSales float64
	var totalCostOfGoods float64
	var totalExpenses float64
	var productCount int64
	var orderCount int64
	var customerCount int64

	ordersQuery := database.DB.Model(&models.Order{})
	completedOrdersQuery := database.DB.Model(&models.Order{}).Where("status = ?", "completed")
	expensesQuery := database.DB.Model(&models.Expense{})
	if branchID != 0 {
		ordersQuery = ordersQuery.Where("branch_id = ?", branchID)
		completedOrdersQuery = completedOrdersQuery.Where("branch_id = ?", branchID)
		expensesQuery = expensesQuery.Where("branch_id = ?", branchID)
	}

	sumCompletedOrderCostOfGoods := func(extraWhere string, args ...interface{}) float64 {
		var total float64

		costQuery := database.DB.Table("order_items").
			Select("COALESCE(SUM(order_items.quantity * COALESCE(products.cost_price, 0)), 0)").
			Joins("JOIN orders ON orders.id = order_items.order_id").
			Joins("JOIN products ON products.id = order_items.product_id").
			Where("orders.status = ?", "completed")

		if branchID != 0 {
			costQuery = costQuery.Where("orders.branch_id = ?", branchID)
		}

		if extraWhere != "" {
			costQuery = costQuery.Where(extraWhere, args...)
		}

		costQuery.Scan(&total)
		return total
	}

	completedOrdersQuery.Select("COALESCE(SUM(total_amount), 0)").Scan(&totalSales)
	totalCostOfGoods = sumCompletedOrderCostOfGoods("")
	expensesQuery.Select("COALESCE(SUM(amount), 0)").Scan(&totalExpenses)
	database.DB.Model(&models.Product{}).Count(&productCount)
	completedOrdersQuery.Count(&orderCount)
	database.DB.Model(&models.Customer{}).Count(&customerCount)

	summary := buildDashboardSummary(totalSales, totalCostOfGoods, totalExpenses)

	var salesTrend []DailySale
	ordersQuery.Select("DATE(created_at) as date, SUM(total_amount) as amount").
		Where("created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").
		Where("status = ?", "completed").
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&salesTrend)

	var lowStockProducts []models.Product
	// Use raw SQL subquery for low stock since GORM doesn't support alias in WHERE
	var lowStockSQL string
	var lowStockArgs []interface{}

	if branchID != 0 {
		lowStockSQL = `SELECT * FROM products WHERE 
			(SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = products.id AND branch_id = ?) <= ? 
			AND deleted_at IS NULL LIMIT 5`
		lowStockArgs = []interface{}{branchID, 5}
	} else {
		lowStockSQL = `SELECT * FROM products WHERE 
			(SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE product_id = products.id) <= ? 
			AND deleted_at IS NULL LIMIT 5`
		lowStockArgs = []interface{}{5}
	}

	database.DB.Raw(lowStockSQL, lowStockArgs...).Find(&lowStockProducts)

	var topAdvisors []SA_Performance
	ordersQuery.Select("service_advisor_name as advisor_name, SUM(total_amount) as total_sales, COUNT(id) as order_count, DATE(created_at) as date").
		Where("DATE(created_at) = CURDATE() AND service_advisor_name != '' AND status = 'completed'").
		Group("DATE(created_at), service_advisor_name").
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
		Group("COALESCE(categories.name, 'Uncategorized')").
		Order("revenue DESC")

	crQuery.Scan(&categoryRevenue)

	fmt.Printf("[DEBUG] Category revenue count: %d\n", len(categoryRevenue))

	// Get product revenue for bar/line charts (top 8 products)
	var productRevenue []ProductRevenue
	prQuery := database.DB.Table("order_items").
		Select("products.name as product, COALESCE(SUM(order_items.subtotal), 0) as revenue, COALESCE(SUM(order_items.subtotal) - SUM(order_items.quantity * COALESCE(products.cost_price, 0)), 0) as profit, COALESCE(SUM(order_items.subtotal), 0) as income").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Group("products.id, products.name").
		Order("revenue DESC").
		Limit(8)

	prQuery.Scan(&productRevenue)

	fmt.Printf("[DEBUG] Product revenue count: %d\n", len(productRevenue))

	// Sales trend - all orders
	database.DB.Model(&models.Order{}).
		Select("DATE(created_at) as date, SUM(total_amount) as amount").
		Where("created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)").
		Group("DATE(created_at)").
		Order("date ASC").
		Scan(&salesTrend)

	fmt.Printf("[DEBUG] Sales trend count: %d\n", len(salesTrend))

	// Also get total sales count for debug
	var totalSalesCount int64
	database.DB.Model(&models.Order{}).Count(&totalSalesCount)
	var completedSalesCount int64
	database.DB.Model(&models.Order{}).Where("status = ?", "completed").Count(&completedSalesCount)
	fmt.Printf("[DEBUG] Total orders: %d, Completed: %d\n", totalSalesCount, completedSalesCount)

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

	// Get product revenue for bar/line charts
	// Already fetched above, no need to refetch
	// (Product revenue is fetched earlier in this function)

	var currentSales, prevSales float64
	var currentCostOfGoods, prevCostOfGoods float64
	var currentExpenses, prevExpenses float64

	cmStart := "DATE_FORMAT(NOW() ,'%Y-%m-01')"

	pmStart := "DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH) ,'%Y-%m-01')"
	pmEnd := "LAST_DAY(DATE_SUB(NOW(), INTERVAL 1 MONTH))"

	ordersQuery.Where("created_at >= " + cmStart + " AND status = 'completed'").Select("COALESCE(SUM(total_amount), 0)").Scan(&currentSales)
	currentCostOfGoods = sumCompletedOrderCostOfGoods("orders.created_at >= " + cmStart)
	database.DB.Model(&models.Order{}).
		Where(func() string {
			if branchID != 0 {
				return "branch_id = ?"
			}
			return "1=1"
		}(), branchID).
		Where("created_at BETWEEN " + pmStart + " AND " + pmEnd + " AND status = 'completed'").
		Select("COALESCE(SUM(total_amount), 0)").Scan(&prevSales)
	prevCostOfGoods = sumCompletedOrderCostOfGoods("orders.created_at BETWEEN " + pmStart + " AND " + pmEnd)

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
		// Debug: just show current vs prev
		fmt.Printf("[DEBUG] Sales - Current: %.2f, Previous: %.2f\n", current, prev)
		if prev == 0 {
			if current > 0 {
				return "NEW"
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

	currentProfit := currentSales - currentCostOfGoods - currentExpenses
	prevProfit := prevSales - prevCostOfGoods - prevExpenses
	profitChange := calculateChange(currentProfit, prevProfit)

	response := gin.H{
		"total_sales":        summary.TotalSales,
		"total_expenses":     summary.TotalExpenses,
		"net_profit":         summary.NetProfit,
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
	}

	// Cache the result with 20s TTL (matches spec recommendation)
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.SetJSON(ctx, cacheKey, response, 20*time.Second); err != nil {
			log.Printf("Warning: failed to cache dashboard stats: %v", err)
		}
	}

	c.JSON(http.StatusOK, response)
}
