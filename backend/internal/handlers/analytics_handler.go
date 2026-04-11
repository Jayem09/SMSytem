package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"smsystem-backend/internal/database"
	"strings"

	"github.com/gin-gonic/gin"
)

type AnalyticsHandler struct{}

// AIResponse represents structured JSON response from Ollama
type AIResponse struct {
	Answer      string      `json:"answer"`
	ChartType   string      `json:"chart_type"`
	Data        interface{} `json:"data"`
	Explanation string      `json:"explanation"`
	Suggestions string      `json:"suggestions"`
}

func NewAnalyticsHandler() *AnalyticsHandler {
	return &AnalyticsHandler{}
}

type QueryResult struct {
	Query       string      `json:"query"`
	Answer      string      `json:"answer"`
	Data        interface{} `json:"data,omitempty"`
	ChartType   string      `json:"chart_type,omitempty"`
	Explanation string      `json:"explanation,omitempty"`
	Suggestions string      `json:"suggestions,omitempty"`
}

type QueryPattern struct {
	Regex  *regexp.Regexp
	Parser func(question string, branchID uint, db interface{}) *QueryResult
}

type RevenueResult struct {
	Total float64 `json:"total"`
}

type OrderCountResult struct {
	Count int `json:"count"`
}

type BestSeller struct {
	ProductName string  `json:"product_name"`
	TotalQty    int     `json:"total_qty"`
	TotalSales  float64 `json:"total_sales"`
}

type LowStockItem struct {
	ProductName  string `json:"product_name"`
	CurrentStock int    `json:"current_stock"`
	ReorderLevel int    `json:"reorder_level"`
}

type SlowMover struct {
	ProductName string `json:"product_name"`
	TotalQty    int    `json:"total_qty"`
}

type TopCustomer struct {
	CustomerName string  `json:"customer_name"`
	TotalSales   float64 `json:"total_sales"`
	OrderCount   int     `json:"order_count"`
}

type ExpensesResult struct {
	Total float64 `json:"total"`
}

type ProfitResult struct {
	Revenue  float64 `json:"revenue"`
	Expenses float64 `json:"expenses"`
	Profit   float64 `json:"profit"`
}

type SalesBreakdown struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

type ServiceAdvisor struct {
	AdvisorName string  `json:"advisor_name"`
	TotalSales  float64 `json:"total_sales"`
	OrderCount  int     `json:"order_count"`
}

func (h *AnalyticsHandler) Query(c *gin.Context) {
	branchIDValue, _ := c.Get("branchID")
	userRole, _ := c.Get("userRole")
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	log.Printf("Analytics Query received: role=%s branchID=%d", userRole, branchID)

	if userRole == "super_admin" {
		branchQuery := c.Query("branch_id")
		if branchQuery == "ALL" {
			branchID = 0
		} else if branchQuery != "" {
			var bID uint
			if _, err := fmt.Sscanf(branchQuery, "%d", &bID); err == nil {
				branchID = bID
			}
		}
	}

	question := c.Query("q")
	// Fallback to JSON body if GET 'q' param is not provided
	if question == "" {
		var payload struct {
			Q string `json:"q"`
		}
		if err := c.ShouldBindJSON(&payload); err == nil {
			question = payload.Q
		}
	}
	if question == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Question is required"})
		return
	}

	mode := c.DefaultQuery("mode", "fast") // "fast" = regex, "ai" = ollama

	result := h.processQuery(question, branchID, mode)
	c.JSON(http.StatusOK, result)
}

func (h *AnalyticsHandler) processQuery(question string, branchID uint, mode string) *QueryResult {
	question = strings.ToLower(question)

	// In "ai" mode, ALWAYS use Ollama - skip regex matching
	if mode == "ai" {
		ollama := NewOllamaClient()
		ctx := ollama.GetBusinessContext(branchID)
		resp, err := ollama.GenerateWithQuestion(question, ctx)

		if err != nil {
			log.Printf("AI error: %v", err)
			return &QueryResult{
				Query:  question,
				Answer: "AI error: " + err.Error(),
			}
		}

		// Try to parse as JSON chart response
		var chartResp struct {
			ChartType string    `json:"chart_type"`
			Title     string    `json:"title"`
			Labels    []string  `json:"labels"`
			Values    []float64 `json:"values"`
			Summary   string    `json:"summary"`
		}

		if json.Unmarshal([]byte(resp), &chartResp) == nil && chartResp.ChartType != "" {
			// Convert to chart data format
			chartData := make([]map[string]interface{}, len(chartResp.Labels))
			for i, label := range chartResp.Labels {
				chartData[i] = map[string]interface{}{
					"name":  label,
					"value": chartResp.Values[i],
				}
			}
			return &QueryResult{
				Query:     question,
				Answer:    chartResp.Summary,
				Data:      chartData,
				ChartType: chartResp.ChartType,
			}
		}

		// Not JSON - return as plain text
		return &QueryResult{
			Query:  question,
			Answer: resp,
		}
	}

	// Fast mode: use regex patterns
	patterns := h.getQueryPatterns()
	for _, pattern := range patterns {
		matches := pattern.Regex.FindStringSubmatch(question)
		if len(matches) > 1 {
			return pattern.Parser(question, branchID, nil)
		}
	}

	answer := h.fallbackQuery(question)

	return &QueryResult{
		Query:  question,
		Answer: answer,
	}
}

func (h *AnalyticsHandler) getQueryPatterns() []QueryPattern {
	return []QueryPattern{
		// === REVENUE & SALES ===
		{
			Regex: regexp.MustCompile(`(?i)(how much|what is|total|amount).*(earn|revenue|sales|income)(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'`
				switch period {
				case "today":
					query += " AND DATE(created_at) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(created_at) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				if err := db.Raw(query).Scan(&result).Error; err != nil {
					return &QueryResult{Query: question, Answer: fmt.Sprintf("Error: %v", err)}
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total revenue: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)^revenue(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?$`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'`
				switch period {
				case "today":
					query += " AND DATE(created_at) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(created_at) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				if err := db.Raw(query).Scan(&result).Error; err != nil {
					return &QueryResult{Query: question, Answer: fmt.Sprintf("Error: %v", err)}
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Revenue: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)^sales(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?$`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'`
				switch period {
				case "today":
					query += " AND DATE(created_at) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(created_at) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				if err := db.Raw(query).Scan(&result).Error; err != nil {
					return &QueryResult{Query: question, Answer: fmt.Sprintf("Error: %v", err)}
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Sales: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)^orders?\s+(this\s+month|last\s+month|today|this\s+week)$`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'`
				switch period {
				case "today":
					query += " AND DATE(created_at) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(created_at) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result OrderCountResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total orders: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === EXPENSES ===
		{
			Regex: regexp.MustCompile(`(?i)(how many|total|number of|order count).*(order|orders|transaction|transactions)(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'`
				switch period {
				case "today":
					query += " AND DATE(created_at) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(created_at) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}

				var result OrderCountResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total orders: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === EXPENSES ===
		{
			Regex: regexp.MustCompile(`(?i)(how much|total|amount).*(expense|expenses|cost|costs|spending)(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1`
				switch period {
				case "today":
					query += " AND DATE(expense_date) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(expense_date) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(expense_date) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(expense_date) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result ExpensesResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total expenses: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(how many|number of).*(order|sale).*(pending|completed|cancelled|confirmed)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				status := "pending"
				if strings.Contains(question, "completed") || strings.Contains(question, "done") {
					status = "completed"
				} else if strings.Contains(question, "cancelled") {
					status = "cancelled"
				} else if strings.Contains(question, "confirmed") {
					status = "confirmed"
				}
				query := fmt.Sprintf(`SELECT COUNT(*) as count FROM orders WHERE status = '%s'`, status)
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result OrderCountResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("%s orders: %d", status, result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(new\s+)?(order|sale).*(today|this\s+day|this\s+week)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result OrderCountResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("New orders today: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(average\s+)?(order|transaction)\s*(value|amount|size)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(AVG(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Average order value: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === PRODUCTS ===
		{
			Regex: regexp.MustCompile(`(?i)(best|top|selling|most\s+popular).*(product|item)(\s+this\s+month|\s+last\s+month)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT p.name as product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_sales FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled'`
				switch period {
				case "month":
					query += " AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(o.created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(o.created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				case "today":
					query += " AND DATE(o.created_at) = CURDATE()"
				default:
					query += " AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW())"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY p.id, p.name ORDER BY total_sales DESC LIMIT 10`
				var results []BestSeller
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "No sales data found."}
				}
				answer := "Top Selling Products:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d sold (₱%.2f)\n", i+1, r.ProductName, r.TotalQty, r.TotalSales)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(most|top)\s+(sold|selling)\s*(product|item)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT p.name as product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_sales FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY p.id, p.name ORDER BY total_qty DESC LIMIT 5`
				var results []BestSeller
				db.Raw(query).Scan(&results)
				answer := "Most Sold Product:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d units\n", i+1, r.ProductName, r.TotalQty)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(low|out|stock|inventory)\s*(stock|items|products)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				var query string
				if branchID > 0 {
					query = `SELECT p.name as product_name, p.stock as current_stock, p.reorder_level FROM products p WHERE p.deleted_at IS NULL AND p.is_service = FALSE AND p.stock <= p.reorder_level ORDER BY p.stock ASC`
				} else {
					query = `SELECT name as product_name, stock as current_stock, reorder_level FROM products WHERE deleted_at IS NULL AND is_service = FALSE AND stock <= reorder_level ORDER BY stock ASC`
				}
				var results []LowStockItem
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "All products are well-stocked!"}
				}
				answer := "Low Stock Items (need reorder):\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d remaining (reorder at %d)\n", i+1, r.ProductName, r.CurrentStock, r.ReorderLevel)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "alert"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(worst|least|slow|moving).*(product|item)(\s+this\s+month|\s+last\s+month)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT p.name as product_name, COALESCE(SUM(oi.quantity), 0) as total_qty FROM products p LEFT JOIN order_items oi ON p.id = oi.product_id LEFT JOIN orders o ON oi.order_id = o.id AND o.status != 'cancelled'`
				switch period {
				case "month":
					query += " AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(o.created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(o.created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				default:
					query += " AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW())"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY p.id, p.name ORDER BY total_qty ASC LIMIT 10`
				var results []SlowMover
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "No slow-moving products found."}
				}
				answer := "Slow Moving Products:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d sold\n", i+1, r.ProductName, r.TotalQty)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(out\s+of\s+stock|no\s+stock|zero\s+stock)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT name as product_name, stock as current_stock, reorder_level FROM products WHERE deleted_at IS NULL AND is_service = FALSE AND stock = 0 ORDER BY name ASC`
				var results []LowStockItem
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "No out-of-stock items!"}
				}
				answer := "OUT OF STOCK Items:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s\n", i+1, r.ProductName)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "alert"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(how many|total).*(product|item|sku).*(in\s+stock|available)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND is_service = FALSE AND stock > 0`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Products in stock: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(total|how many).*(product|item|sku)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total products: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === SERVICE ADVISORS ===
		{
			Regex: regexp.MustCompile(`(?i)(top|best|who|which).*((service|sa)\s*(advisor|mechanic|tech)|(advisor|mechanic|tech).*(top|best))`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(service_advisor_name, 'Walk-in') as advisor_name, SUM(total_amount - discount_amount) as total_sales, COUNT(*) as order_count FROM orders WHERE status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY service_advisor_name ORDER BY total_sales DESC LIMIT 1`
				var result ServiceAdvisor
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Top Service Advisor: %s with ₱%.2f in sales (%d orders)", result.AdvisorName, result.TotalSales, result.OrderCount), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)((service|sa)\s*(advisor|mechanic|tech)|(advisor|mechanic|tech)).*(performance|sales)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(service_advisor_name, 'Walk-in') as advisor_name, SUM(total_amount - discount_amount) as total_sales, COUNT(*) as order_count FROM orders WHERE status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY service_advisor_name ORDER BY total_sales DESC LIMIT 10`
				var results []ServiceAdvisor
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "No service advisor data found."}
				}
				answer := "Service Advisor Performance:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f (%d orders)\n", i+1, r.AdvisorName, r.TotalSales, r.OrderCount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(service\s+advisor|mechanic|technician).*(count|number|total)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(DISTINCT service_advisor_name) as count FROM orders WHERE service_advisor_name IS NOT NULL AND service_advisor_name != ''`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Active service advisors: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(walk-in|without\s+advisor|cash\s+customer)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count, COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND (service_advisor_name IS NULL OR service_advisor_name = '')`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result struct {
					Count int
					Total float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Walk-in sales: %d orders, ₱%.2f", result.Count, result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === CUSTOMERS ===
		{
			Regex: regexp.MustCompile(`(?i)(customer|client).*(most|top|best)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(c.name, o.guest_name) as customer_name, SUM(o.total_amount - o.discount_amount) as total_sales, COUNT(o.id) as order_count FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY COALESCE(c.name, o.guest_name) ORDER BY total_sales DESC LIMIT 10`
				var results []TopCustomer
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "No customer data found."}
				}
				answer := "Top Customers:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f (%d orders)\n", i+1, r.CustomerName, r.TotalSales, r.OrderCount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(new\s+customer|new\s+client)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = CURDATE()`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("New customers today: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(total|how many).*(customer|client)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM customers`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total customers: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(frequent|loyal|returning|repeat).*(customer|client)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(c.name, o.guest_name) as customer_name, COUNT(o.id) as order_count FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled' GROUP BY COALESCE(c.name, o.guest_name) HAVING order_count > 1 ORDER BY order_count DESC LIMIT 10`
				var results []struct {
					CustomerName string
					OrderCount   int
				}
				db.Raw(query).Scan(&results)
				answer := "Frequent Customers:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d visits\n", i+1, r.CustomerName, r.OrderCount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(repeat|customers?\s+with\s+more\s+than\s+one\s+order|returning\s+customers?)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM (SELECT customer_id FROM orders WHERE status != 'cancelled' AND customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*) > 1) as repeat_customers`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Repeat customers: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(customer|client).*(last|recent).*(order|purchase|visit)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(c.name, o.guest_name) as customer_name, MAX(o.created_at) as last_order FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled' GROUP BY COALESCE(c.name, o.guest_name) ORDER BY last_order DESC LIMIT 10`
				var results []struct {
					CustomerName string
					LastOrder    string
				}
				db.Raw(query).Scan(&results)
				answer := "Recent Customer Orders:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - Last: %s\n", i+1, r.CustomerName, r.LastOrder)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "table"}
			},
		},
		// === EXPENSES ===
		{
			Regex: regexp.MustCompile(`(?i)^(total\s+)?(expenses?|costs?|spending)(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?$`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				query := `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE 1=1`
				switch period {
				case "today":
					query += " AND DATE(expense_date) = CURDATE()"
				case "week":
					query += " AND YEARWEEK(expense_date) = YEARWEEK(NOW())"
				case "month":
					query += " AND YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())"
				case "last_month":
					query += " AND YEAR(expense_date) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(expense_date) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result ExpensesResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total expenses: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(highest|biggest|largest)\s+(expense|cost|spending)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT description, amount, expense_date FROM expenses ORDER BY amount DESC LIMIT 5`
				var results []struct {
					Description string
					Amount      float64
					Date        string
				}
				db.Raw(query).Scan(&results)
				answer := "Largest Expenses:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f\n", i+1, r.Description, r.Amount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(expense|cost)\s*(by|category|breakdown)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT category, SUM(amount) as total FROM expenses WHERE 1=1`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY category ORDER BY total DESC`
				var results []struct {
					Category string
					Total    float64
				}
				db.Raw(query).Scan(&results)
				answer := "Expenses by Category:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f\n", i+1, r.Category, r.Total)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "pie"}
			},
		},
		// === PROFIT & LOSS ===
		{
			Regex: regexp.MustCompile(`(?i)(profit|gain|loss)(\s+this\s+month|\s+last\s+month|\s+today|\s+this\s+week)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				period := h.parsePeriod(question)
				revenueQuery := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as revenue FROM orders WHERE status != 'cancelled'`
				expenseQuery := `SELECT COALESCE(SUM(amount), 0) as expenses FROM expenses WHERE 1=1`
				var dateCond string
				switch period {
				case "today":
					dateCond = " AND DATE(created_at) = CURDATE()"
				case "week":
					dateCond = " AND YEARWEEK(created_at) = YEARWEEK(NOW())"
				case "month":
					dateCond = " AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())"
				case "last_month":
					dateCond = " AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))"
				}
				revenueQuery += dateCond
				expenseQuery += strings.Replace(dateCond, "created_at", "expense_date", 1)
				if branchID > 0 {
					revenueQuery += fmt.Sprintf(" AND branch_id = %d", branchID)
					expenseQuery += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var rev RevenueResult
				var exp ExpensesResult
				db.Raw(revenueQuery).Scan(&rev)
				db.Raw(expenseQuery).Scan(&exp)
				profit := rev.Total - exp.Total
				profitType := "profit"
				if profit < 0 {
					profitType = "loss"
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Revenue: ₱%.2f | Expenses: ₱%.2f | Net %s: ₱%.2f", rev.Total, exp.Total, profitType, profit), Data: ProfitResult{Revenue: rev.Total, Expenses: exp.Total, Profit: profit}, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(net\s+income|net\s+profit|bottom\s+line)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				revenueQuery := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as revenue FROM orders WHERE status != 'cancelled'`
				expenseQuery := `SELECT COALESCE(SUM(amount), 0) as expenses FROM expenses WHERE 1=1`
				if branchID > 0 {
					revenueQuery += fmt.Sprintf(" AND branch_id = %d", branchID)
					expenseQuery += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var rev RevenueResult
				var exp ExpensesResult
				db.Raw(revenueQuery).Scan(&rev)
				db.Raw(expenseQuery).Scan(&exp)
				netIncome := rev.Total - exp.Total
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Net Income: ₱%.2f", netIncome), Data: netIncome, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(gross\s+profit|margin)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(SUM(oi.subtotal), 0) as revenue, COALESCE(SUM(oi.quantity * p.cost_price), 0) as cost FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				var result struct {
					Revenue float64
					Cost    float64
				}
				db.Raw(query).Scan(&result)
				grossProfit := result.Revenue - result.Cost
				margin := 0.0
				if result.Revenue > 0 {
					margin = (grossProfit / result.Revenue) * 100
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Gross Profit: ₱%.2f (Margin: %.1f%%)", grossProfit, margin), Data: result, ChartType: "metric"}
			},
		},
		// === CATEGORIES & BRANDS ===
		{
			Regex: regexp.MustCompile(`(?i)(sales|order)\s*(by|per)\s*(category|brand)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				var query string
				if strings.Contains(question, "category") {
					query = `SELECT c.name as label, SUM(oi.subtotal) as value FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id JOIN categories c ON p.category_id = c.id WHERE o.status != 'cancelled'`
				} else {
					query = `SELECT b.name as label, SUM(oi.subtotal) as value FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id JOIN brands b ON p.brand_id = b.id WHERE o.status != 'cancelled'`
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY label ORDER BY value DESC`
				var results []SalesBreakdown
				db.Raw(query).Scan(&results)
				if len(results) == 0 {
					return &QueryResult{Query: question, Answer: "No sales data found."}
				}
				answer := "Sales by " + h.getBreakdownLabel(question) + ":\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f\n", i+1, r.Label, r.Value)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "pie"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(top|best|most)\s+(selling)?\s*(category|brand)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				var query string
				if strings.Contains(question, "brand") {
					query = `SELECT b.name as label, SUM(oi.subtotal) as value FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id JOIN brands b ON p.brand_id = b.id WHERE o.status != 'cancelled'`
				} else {
					query = `SELECT c.name as label, SUM(oi.subtotal) as value FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id JOIN categories c ON p.category_id = c.id WHERE o.status != 'cancelled'`
				}
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY label ORDER BY value DESC LIMIT 5`
				var results []SalesBreakdown
				db.Raw(query).Scan(&results)
				answer := "Top Categories/Brands:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f\n", i+1, r.Label, r.Value)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		// === DISCOUNTS ===
		{
			Regex: regexp.MustCompile(`(?i)(total\s+)?discount`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(SUM(discount_amount), 0) as total, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND discount_amount > 0`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result struct {
					Total float64
					Count int
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total discounts given: ₱%.2f (%d orders)", result.Total, result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(average|avg)\s+discount`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(AVG(discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND discount_amount > 0`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Average discount: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === PAYMENT METHODS ===
		{
			Regex: regexp.MustCompile(`(?i)(payment|paid\s+by).*(cash|card|gcash|maya|check|online)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				method := "cash"
				if strings.Contains(question, "card") {
					method = "card"
				} else if strings.Contains(question, "gcash") {
					method = "gcash"
				} else if strings.Contains(question, "maya") {
					method = "maya"
				}
				query := fmt.Sprintf(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'cancelled' AND payment_method LIKE '%%%s%%'`, method)
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result struct {
					Count int
					Total float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("%s payments: %d orders, ₱%.2f", method, result.Count, result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === TIME-BASED ===
		{
			Regex: regexp.MustCompile(`(?i)(daily|sales\s+today|every\s+day)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT DATE(created_at) as date, SUM(total_amount - discount_amount) as amount FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY DATE(created_at) ORDER BY date DESC`
				var results []struct {
					Date   string
					Amount float64
				}
				db.Raw(query).Scan(&results)
				answer := "Daily Sales (Last 7 Days):\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f\n", i+1, r.Date, r.Amount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "line"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(weekly|per\s+week)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT YEARWEEK(created_at) as week, SUM(total_amount - discount_amount) as amount FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(NOW(), INTERVAL 4 WEEK)`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY YEARWEEK(created_at) ORDER BY week DESC`
				var results []struct {
					Week   string
					Amount float64
				}
				db.Raw(query).Scan(&results)
				answer := "Weekly Sales:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. Week %s - ₱%.2f\n", i+1, r.Week, r.Amount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(monthly|per\s+month)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(total_amount - discount_amount) as amount FROM orders WHERE status != 'cancelled' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC`
				var results []struct {
					Month  string
					Amount float64
				}
				db.Raw(query).Scan(&results)
				answer := "Monthly Sales:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - ₱%.2f\n", i+1, r.Month, r.Amount)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(compare|comparison|vs\.?|versus).*(last\s+month|previous\s+month|month\s+over\s+month)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				thisMonth := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as amount FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW())`
				lastMonth := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as amount FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))`
				if branchID > 0 {
					thisMonth += fmt.Sprintf(" AND branch_id = %d", branchID)
					lastMonth += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var thisRes, lastRes struct{ Amount float64 }
				db.Raw(thisMonth).Scan(&thisRes)
				db.Raw(lastMonth).Scan(&lastRes)
				change := 0.0
				if lastRes.Amount > 0 {
					change = ((thisRes.Amount - lastRes.Amount) / lastRes.Amount) * 100
				}
				direction := "increase"
				if change < 0 {
					direction = "decrease"
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("This Month: ₱%.2f | Last Month: ₱%.2f | %s: %.1f%%", thisRes.Amount, lastRes.Amount, direction, change), Data: struct {
					This   float64
					Last   float64
					Change float64
				}{thisRes.Amount, lastRes.Amount, change}, ChartType: "metric"}
			},
		},
		// === INVENTORY VALUE ===
		{
			Regex: regexp.MustCompile(`(?i)(inventory\s+value|stock\s+value|worth)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(SUM(stock * cost_price), 0) as total FROM products WHERE deleted_at IS NULL AND is_service = FALSE`
				var result struct{ Total float64 }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Inventory value: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === ORDER STATUS ===
		{
			Regex: regexp.MustCompile(`(?i)(order\s+status|pending\s+order|unfinished\s+order)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status IN ('pending', 'confirmed', 'processing')`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				query += ` GROUP BY status`
				var results []struct {
					Status string
					Count  int
					Total  float64
				}
				db.Raw(query).Scan(&results)
				answer := "Pending Orders:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d orders (₱%.2f)\n", i+1, r.Status, r.Count, r.Total)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(completed\s+order|finished\s+order|delivered\s+order)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = 'completed'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result struct {
					Count int
					Total float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Completed orders: %d (₱%.2f)", result.Count, result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === SUPPLIERS ===
		{
			Regex: regexp.MustCompile(`(?i)(total|how many)\s+(supplier|vendor)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM suppliers`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total suppliers: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === TRANSACTIONS ===
		{
			Regex: regexp.MustCompile(`(?i)(total\s+)?(transaction|transaction\s+count)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Total transactions: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === TAX ===
		{
			Regex: regexp.MustCompile(`(?i)(total\s+)?tax\s*(collected|collected)?`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(SUM(tax_amount), 0) as total, COALESCE(SUM(total_amount), 0) as sales FROM orders WHERE status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result struct {
					Total float64
					Sales float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Tax collected: ₱%.2f (from ₱%.2f in sales)", result.Total, result.Sales), Data: result, ChartType: "metric"}
			},
		},
		// === HOURLY SALES ===
		{
			Regex: regexp.MustCompile(`(?i)(busy|peak)\s*(hour|time)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT HOUR(created_at) as hour, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE() GROUP BY HOUR(created_at) ORDER BY count DESC LIMIT 1`
				var result struct {
					Hour  int
					Count int
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Busiest hour today: %d:00 (%d orders)", result.Hour, result.Count), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(slow|quiet)\s*(hour|time)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT HOUR(created_at) as hour, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE() GROUP BY HOUR(created_at) ORDER BY count ASC LIMIT 1`
				var result struct {
					Hour  int
					Count int
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Slowest hour today: %d:00 (%d orders)", result.Hour, result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === PURCHASE ORDERS ===
		{
			Regex: regexp.MustCompile(`(?i)(pending\s+)?(purchase\s+order|po)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count, COALESCE(SUM(total_cost), 0) as total FROM purchase_orders WHERE status = 'pending'`
				var result struct {
					Count int
					Total float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Pending purchase orders: %d (₱%.2f)", result.Count, result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === SUMMARY STATS ===
		{
			Regex: regexp.MustCompile(`(?i)(quick\s+summary|overview|at\s+a\s+glance|today\'?s\s+summary)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				salesQ := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()`
				ordersQ := `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled' AND DATE(created_at) = CURDATE()`
				expenseQ := `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE DATE(expense_date) = CURDATE()`
				lowStockQ := `SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL AND stock <= reorder_level`
				if branchID > 0 {
					salesQ += fmt.Sprintf(" AND branch_id = %d", branchID)
					ordersQ += fmt.Sprintf(" AND branch_id = %d", branchID)
					expenseQ += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var sales, expense RevenueResult
				var orders, lowStock struct{ Count int }
				db.Raw(salesQ).Scan(&sales)
				db.Raw(ordersQ).Scan(&orders)
				db.Raw(expenseQ).Scan(&expense)
				db.Raw(lowStockQ).Scan(&lowStock)
				answer := fmt.Sprintf("TODAY'S SUMMARY:\n\nSales: ₱%.2f\nOrders: %d\nExpenses: ₱%.2f\nNet: ₱%.2f\nLow Stock Items: %d", sales.Total, orders.Count, expense.Total, sales.Total-expense.Total, lowStock.Count)
				return &QueryResult{Query: question, Answer: answer, Data: struct {
					Sales, Expense, Net float64
					Orders, LowStock    int
				}{sales.Total, expense.Total, sales.Total - expense.Total, orders.Count, lowStock.Count}, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(show\s+me\s+everything|full\s+report|complete\s+report)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				sales := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'`
				orders := `SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'`
				expense := `SELECT COALESCE(SUM(amount), 0) as total FROM expenses`
				products := `SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL`
				customers := `SELECT COUNT(*) as count FROM customers`
				if branchID > 0 {
					sales += fmt.Sprintf(" AND branch_id = %d", branchID)
					orders += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var salesR, expenseR RevenueResult
				var ordersR, productsR, customersR struct{ Count int }
				db.Raw(sales).Scan(&salesR)
				db.Raw(orders).Scan(&ordersR)
				db.Raw(expense).Scan(&expenseR)
				db.Raw(products).Scan(&productsR)
				db.Raw(customers).Scan(&customersR)
				answer := fmt.Sprintf("COMPLETE REPORT:\n\nTotal Sales: ₱%.2f\nTotal Orders: %d\nTotal Expenses: ₱%.2f\nNet Profit: ₱%.2f\nProducts: %d\nCustomers: %d", salesR.Total, ordersR.Count, expenseR.Total, salesR.Total-expenseR.Total, productsR.Count, customersR.Count)
				return &QueryResult{Query: question, Answer: answer, Data: struct {
					Sales, Expense, Net         float64
					Orders, Products, Customers int
				}{salesR.Total, expenseR.Total, salesR.Total - expenseR.Total, ordersR.Count, productsR.Count, customersR.Count}, ChartType: "metric"}
			},
		},
		// === SERVICES ===
		{
			Regex: regexp.MustCompile(`(?i)(total\s+)?(service|services).*(sold|performed)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(*) as count, COALESCE(SUM(o.total_amount), 0) as total FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled' AND p.is_service = TRUE`
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				var result struct {
					Count int
					Total float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Services performed: %d (₱%.2f)", result.Count, result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(top\s+)?(service|services).*(selling|popular|performed)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT p.name, SUM(oi.quantity) as qty, SUM(oi.subtotal) as total FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled' AND p.is_service = TRUE`
				if branchID > 0 {
					query += fmt.Sprintf(" AND o.branch_id = %d", branchID)
				}
				query += ` GROUP BY p.id, p.name ORDER BY total DESC LIMIT 5`
				var results []struct {
					Name  string
					Qty   int
					Total float64
				}
				db.Raw(query).Scan(&results)
				answer := "Top Services:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %dx (₱%.2f)\n", i+1, r.Name, r.Qty, r.Total)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		// === COMPARISON ===
		{
			Regex: regexp.MustCompile(`(?i)(this\s+year|this\s+year\'?s?|ytd|year\s+to\s+date)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(NOW())`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Year-to-date sales: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		{
			Regex: regexp.MustCompile(`(?i)(last\s+year|previous\s+year|yesterday)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				var result RevenueResult
				if strings.Contains(question, "yesterday") {
					query := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`
					if branchID > 0 {
						query += fmt.Sprintf(" AND branch_id = %d", branchID)
					}
					db.Raw(query).Scan(&result)
					return &QueryResult{Query: question, Answer: fmt.Sprintf("Yesterday's sales: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
				} else {
					query := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 YEAR))`
					if branchID > 0 {
						query += fmt.Sprintf(" AND branch_id = %d", branchID)
					}
					db.Raw(query).Scan(&result)
					return &QueryResult{Query: question, Answer: fmt.Sprintf("Last year's sales: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
				}
			},
		},
		// === AOV (Average Order Value) ===
		{
			Regex: regexp.MustCompile(`(?i)(average\s+order|average\s+transaction|aov)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(AVG(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'`
				if branchID > 0 {
					query += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var result RevenueResult
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Average order value: ₱%.2f", result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === FIRST TIME vs RETURNING ===
		{
			Regex: regexp.MustCompile(`(?i)(first\s+time|customer\s+first\s+purchase)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COUNT(DISTINCT customer_id) as count FROM orders WHERE status != 'cancelled' AND customer_id IS NOT NULL GROUP BY customer_id HAVING COUNT(*) = 1`
				var result struct{ Count int }
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("First-time customers: %d", result.Count), Data: result, ChartType: "metric"}
			},
		},
		// === BEST DAY OF WEEK ===
		{
			Regex: regexp.MustCompile(`(?i)(best\s+day|busiest\s+day|most\s+sales)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT DAYNAME(created_at) as day, SUM(total_amount - discount_amount) as total FROM orders WHERE status != 'cancelled' GROUP BY DAYNAME(created_at) ORDER BY total DESC LIMIT 1`
				var result struct {
					Day   string
					Total float64
				}
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Best day of week: %s (₱%.2f)", result.Day, result.Total), Data: result, ChartType: "metric"}
			},
		},
		// === YoY COMPARISON ===
		{
			Regex: regexp.MustCompile(`(?i)(year\s+over\s+year|yoy|vs\.?\s+last\s+year)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				thisYear := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(NOW())`
				lastYear := `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 YEAR))`
				if branchID > 0 {
					thisYear += fmt.Sprintf(" AND branch_id = %d", branchID)
					lastYear += fmt.Sprintf(" AND branch_id = %d", branchID)
				}
				var thisR, lastR RevenueResult
				db.Raw(thisYear).Scan(&thisR)
				db.Raw(lastYear).Scan(&lastR)
				change := 0.0
				if lastR.Total > 0 {
					change = ((thisR.Total - lastR.Total) / lastR.Total) * 100
				}
				return &QueryResult{Query: question, Answer: fmt.Sprintf("This Year: ₱%.2f | Last Year: ₱%.2f | Change: %.1f%%", thisR.Total, lastR.Total, change), Data: struct{ This, Last, Change float64 }{thisR.Total, lastR.Total, change}, ChartType: "metric"}
			},
		},
		// === PRODUCTS BY CATEGORY ===
		{
			Regex: regexp.MustCompile(`(?i)(how many|total).*(product|item).*(in|per).*(category|brand)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				var query string
				if strings.Contains(question, "brand") {
					query = `SELECT b.name as label, COUNT(p.id) as count FROM brands b LEFT JOIN products p ON b.id = p.brand_id AND p.deleted_at IS NULL GROUP BY b.id, b.name ORDER BY count DESC`
				} else {
					query = `SELECT c.name as label, COUNT(p.id) as count FROM categories c LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL GROUP BY c.id, c.name ORDER BY count DESC`
				}
				var results []struct {
					Label string
					Count int
				}
				db.Raw(query).Scan(&results)
				answer := "Products by Category/Brand:\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s - %d products\n", i+1, r.Label, r.Count)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
		// === MOST VALUABLE CUSTOMER ===
		{
			Regex: regexp.MustCompile(`(?i)(most\s+valuable|best)\s+(customer|client|mvpc|mvp)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT COALESCE(c.name, o.guest_name) as customer_name, SUM(o.total_amount - o.discount_amount) as total_sales, COUNT(o.id) as order_count FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled' GROUP BY COALESCE(c.name, o.guest_name) ORDER BY total_sales DESC LIMIT 1`
				var result TopCustomer
				db.Raw(query).Scan(&result)
				return &QueryResult{Query: question, Answer: fmt.Sprintf("Most Valuable Customer: %s with ₱%.2f in total purchases (%d orders)", result.CustomerName, result.TotalSales, result.OrderCount), Data: result, ChartType: "metric"}
			},
		},
		// === STOCK MOVEMENT ===
		{
			Regex: regexp.MustCompile(`(?i)(stock\s+movement|inventory\s+change)`),
			Parser: func(question string, branchID uint, _ interface{}) *QueryResult {
				db := database.DB
				query := `SELECT type, SUM(quantity) as total FROM stock_movements WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY type`
				var results []struct {
					Type  string
					Total int
				}
				db.Raw(query).Scan(&results)
				answer := "Stock Movement (Last 7 Days):\n"
				for i, r := range results {
					answer += fmt.Sprintf("%d. %s: %d units\n", i+1, r.Type, r.Total)
				}
				return &QueryResult{Query: question, Answer: answer, Data: results, ChartType: "bar"}
			},
		},
	}
}

func (h *AnalyticsHandler) parsePeriod(question string) string {
	question = strings.ToLower(question)
	if strings.Contains(question, "today") {
		return "today"
	} else if strings.Contains(question, "this week") {
		return "week"
	} else if strings.Contains(question, "last month") {
		return "last_month"
	} else if strings.Contains(question, "this month") {
		return "month"
	}
	return "all"
}

func (h *AnalyticsHandler) getBreakdownLabel(question string) string {
	question = strings.ToLower(question)
	if strings.Contains(question, "category") {
		return "Category"
	} else if strings.Contains(question, "brand") {
		return "Brand"
	}
	return "Customer"
}

func (h *AnalyticsHandler) fallbackQuery(question string) string {
	keywords := map[string]string{
		"stock":    "Try: 'low stock items' or 'out of stock'",
		"order":    "Try: 'orders this month' or 'how many orders today?'",
		"orders":   "Try: 'orders this month' or 'how many orders today?'",
		"customer": "Try: 'top customers' or 'who are our best customers'",
		"product":  "Try: 'best selling products' or 'top selling products'",
		"sale":     "Try: 'revenue this month' or 'sales today'",
		"revenue":  "Try: 'revenue this month' or 'how much did we earn this month?'",
		"profit":   "Try: 'profit this month' or 'net income'",
		"expense":  "Try: 'expenses this month' or 'total expenses'",
		"category": "Try: 'sales by category' or 'top categories'",
		"brand":    "Try: 'sales by brand' or 'top brands'",
		"advisor":  "Try: 'service advisor performance' or 'top advisor'",
	}

	questionLower := strings.ToLower(question)
	for key, response := range keywords {
		if strings.Contains(questionLower, key) {
			return response
		}
	}

	return `I couldn't understand that. Try these:
• Revenue: "revenue this month", "sales today", "how much did we earn this month?"
• Orders: "orders this month", "how many orders today?", "order count"
• Profit: "profit this month", "net income"
• Products: "best selling products", "low stock items"
• Customers: "top customers", "who are our best customers"
• Reports: "daily summary", "expenses this month", "sales by category"`
}

func (h *AnalyticsHandler) GetRevenue(c *gin.Context) {
	branchIDValue, _ := c.Get("branchID")
	var branchID uint
	if branchIDValue != nil {
		branchID = branchIDValue.(uint)
	}

	period := c.DefaultQuery("period", "today")

	var query string

	switch period {
	case "today":
		query = `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total 
				 FROM orders 
				 WHERE DATE(created_at) = CURDATE() 
				 AND status != 'cancelled'`
	case "week":
		query = `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total 
				 FROM orders 
				 WHERE YEARWEEK(created_at) = YEARWEEK(NOW()) 
				 AND status != 'cancelled'`
	case "month":
		query = `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total 
				 FROM orders 
				 WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) 
				 AND status != 'cancelled'`
	default:
		query = `SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total 
				 FROM orders WHERE status != 'cancelled'`
	}

	if branchID > 0 {
		query += fmt.Sprintf(" AND branch_id = %d", branchID)
	}

	db := database.DB
	var result RevenueResult

	if err := db.Raw(query).Scan(&result).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"period":  period,
		"revenue": result.Total,
	})
}
