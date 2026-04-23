package handlers

import (
	"fmt"
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"strconv"

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
	branchID, _ := GetUintFromContext(c, "branchID")
	userRoleStr, _ := GetStringFromContext(c, "userRole")

	if userRoleStr == "super_admin" {
		branchQuery := c.Query("branch_id")
		if branchQuery == "ALL" {
			branchID = 0
		} else if branchQuery != "" {
			if parsedBranchID, err := strconv.ParseUint(branchQuery, 10, 64); err == nil {
				if parsedBranchID > 0 {
					branchID = uint(parsedBranchID)
				}
			}
		}
	}

	branchScope := newDashboardBranchScope(branchID)

	days := c.DefaultQuery("days", "0")
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

	ordersQuery := branchScope.apply(database.DB.Model(&models.Order{}), branchScope.directBranchColumn())
	completedOrdersQuery := branchScope.apply(database.DB.Model(&models.Order{}).Where("status = ?", "completed"), branchScope.directBranchColumn())
	expensesQuery := branchScope.apply(database.DB.Model(&models.Expense{}), branchScope.directBranchColumn())

	sumCompletedOrderCostOfGoods := func(extraWhere string, args ...interface{}) float64 {
		var total float64

		costQuery := database.DB.Table("order_items").
			Select("COALESCE(SUM(order_items.quantity * COALESCE(products.cost_price, 0)), 0)").
			Joins("JOIN orders ON orders.id = order_items.order_id").
			Joins("JOIN products ON products.id = order_items.product_id").
			Where("orders.status = ?", "completed")

		costQuery = branchScope.apply(costQuery, branchScope.orderJoinBranchColumn())

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
		Order("DATE(created_at) ASC").
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
		Where("DATE(orders.created_at) = CURDATE()").
		Where("orders.status = ?", "completed")

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
		Where("orders.status = ?", "completed").
		Group("COALESCE(categories.name, 'Uncategorized')").
		Order("revenue DESC")

	crQuery = branchScope.apply(crQuery, branchScope.orderJoinBranchColumn())

	crQuery.Scan(&categoryRevenue)

	// Get product revenue for bar/line charts (top 8 products)
	var productRevenue []ProductRevenue
	prQuery := database.DB.Table("order_items").
		Select("products.name as product, COALESCE(SUM(order_items.subtotal), 0) as revenue, COALESCE(SUM(order_items.subtotal) - SUM(order_items.quantity * COALESCE(products.cost_price, 0)), 0) as profit, COALESCE(SUM(order_items.subtotal), 0) as income").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Where("orders.status = ?", "completed").
		Group("products.id, products.name").
		Order("revenue DESC").
		Limit(8)

	prQuery = branchScope.apply(prQuery, branchScope.orderJoinBranchColumn())

	prQuery.Scan(&productRevenue)

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

	// Fix: properly build query with branch filter
	prevOrdersQuery := branchScope.apply(database.DB.Model(&models.Order{}), branchScope.directBranchColumn())
	prevOrdersQuery.Where("created_at BETWEEN " + pmStart + " AND " + pmEnd + " AND status = 'completed'").
		Select("COALESCE(SUM(total_amount), 0)").Scan(&prevSales)
	prevCostOfGoods = sumCompletedOrderCostOfGoods("orders.created_at BETWEEN " + pmStart + " AND " + pmEnd)

	expensesQuery.Where("created_at >= " + cmStart).Select("COALESCE(SUM(amount), 0)").Scan(&currentExpenses)

	// Fix: properly build query with branch filter
	prevExpQuery := branchScope.apply(database.DB.Model(&models.Expense{}), branchScope.directBranchColumn())
	prevExpQuery.Where("created_at BETWEEN " + pmStart + " AND " + pmEnd).
		Select("COALESCE(SUM(amount), 0)").Scan(&prevExpenses)

	calculateChange := func(current, prev float64) string {
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

	c.JSON(http.StatusOK, gin.H{
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
	})
}
