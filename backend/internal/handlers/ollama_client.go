package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"smsystem-backend/internal/database"
)

type OllamaClient struct {
	BaseURL string
	Model   string
}

func NewOllamaClient() *OllamaClient {
	baseURL := os.Getenv("OLLAMA_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	return &OllamaClient{
		BaseURL: baseURL,
		Model:   "llama3.2:1b",
	}
}

type OllamaRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type OllamaResponse struct {
	Message Message `json:"message"`
	Done    bool    `json:"done"`
}

func (o *OllamaClient) GetBusinessContext(branchID uint) string {
	db := database.DB

	// === STRUCTS ===
	type salesSum struct{ Total float64 }
	type branchSales struct {
		BranchID   uint
		BranchName string
		Total      float64
	}
	type branchOrderCount struct {
		BranchID uint
		Count    int
	}
	type categorySummary struct {
		CategoryName string
		Count        int
		Stock        int
	}
	type brandSummary struct {
		BrandName string
		Count     int
		Stock     int
	}
	type lowStockItem struct {
		ProductName string
		SKU         string
		Stock       int
		Reorder     int
		Category    string
		Brand       string
	}
	type topProduct struct {
		ProductName string
		TotalQty    int
		TotalSales  float64
	}
	type topCustomer struct {
		CustomerName string
		TotalSales   float64
	}
	type staffInfo struct {
		Name     string
		Email    string
		Role     string
		BranchID uint
	}
	type productByCategory struct {
		Category string
		Product  string
		Stock    int
		Price    float64
	}

	// === QUERIES ===
	var todaysSales, monthSales, lastMonthSales, totalSales, expensesThisMonth, expensesLastMonth salesSum
	var totalProducts, totalCustomers, lowStockCount int

	// Overall metrics
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'").Scan(&todaysSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND status != 'cancelled'").Scan(&monthSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND status != 'cancelled'").Scan(&lastMonthSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'").Scan(&totalSales)
	db.Raw("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())").Scan(&expensesThisMonth)
	db.Raw("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(expense_date) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(expense_date) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))").Scan(&expensesLastMonth)
	db.Raw("SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL").Scan(&totalProducts)
	db.Raw("SELECT COUNT(*) as count FROM customers").Scan(&totalCustomers)
	db.Raw("SELECT COUNT(*) as count FROM products WHERE stock <= reorder_level AND deleted_at IS NULL").Scan(&lowStockCount)

	// Branch breakdown - SALES THIS MONTH
	var branchSalesThisMonth []branchSales
	db.Raw("SELECT b.id as branch_id, b.name as branch_name, COALESCE(SUM(o.total_amount - o.discount_amount), 0) as total FROM branches b LEFT JOIN orders o ON b.id = o.branch_id AND o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY b.id, b.name ORDER BY total DESC").Scan(&branchSalesThisMonth)

	// Branch breakdown - TOTAL SALES
	var branchSalesTotal []branchSales
	db.Raw("SELECT b.id as branch_id, b.name as branch_name, COALESCE(SUM(o.total_amount - o.discount_amount), 0) as total FROM branches b LEFT JOIN orders o ON b.id = o.branch_id AND o.status != 'cancelled' GROUP BY b.id, b.name ORDER BY total DESC").Scan(&branchSalesTotal)

	// Branch breakdown - ORDER COUNT THIS MONTH
	var branchOrders []branchOrderCount
	db.Raw("SELECT branch_id, COUNT(*) as count FROM orders WHERE status != 'cancelled' AND YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) GROUP BY branch_id").Scan(&branchOrders)

	// Note: Products are CENTRAL inventory (shared across all branches), not per-branch
	// Low stock is calculated from the shared inventory
	var totalLowStock int
	db.Raw("SELECT COUNT(*) as count FROM products WHERE stock <= reorder_level AND deleted_at IS NULL").Scan(&totalLowStock)

	// Product categories
	var categories []categorySummary
	db.Raw("SELECT c.name as category_name, COUNT(p.id) as count, COALESCE(SUM(p.stock), 0) as stock FROM categories c LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL GROUP BY c.id, c.name ORDER BY count DESC").Scan(&categories)

	// Product brands
	var brands []brandSummary
	db.Raw("SELECT br.name as brand_name, COUNT(p.id) as count, COALESCE(SUM(p.stock), 0) as stock FROM brands br LEFT JOIN products p ON br.id = p.brand_id AND p.deleted_at IS NULL GROUP BY br.id, br.name ORDER BY count DESC").Scan(&brands)

	// Low stock items
	var lowStockItems []lowStockItem
	db.Raw("SELECT p.name as product_name, p.sku, p.stock, p.reorder_level as reorder, c.name as category, br.name as brand FROM products p LEFT JOIN categories c ON p.category_id = c.id LEFT JOIN brands br ON p.brand_id = br.id WHERE p.stock <= p.reorder_level AND p.deleted_at IS NULL ORDER BY p.stock ASC").Scan(&lowStockItems)

	// Top products this month
	var topProducts []topProduct
	db.Raw("SELECT p.name as product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_sales FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY p.id, p.name ORDER BY total_sales DESC LIMIT 10").Scan(&topProducts)

	// Top customers this month
	var topCustomers []topCustomer
	db.Raw("SELECT COALESCE(c.name, o.guest_name) as customer_name, SUM(o.total_amount - o.discount_amount) as total_sales FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY COALESCE(c.name, o.guest_name) ORDER BY total_sales DESC LIMIT 5").Scan(&topCustomers)

	// Staff
	var staff []staffInfo
	db.Raw("SELECT name, email, role, branch_id FROM users WHERE deleted_at IS NULL ORDER BY branch_id, name").Scan(&staff)

	// === BUILD CONTEXT STRING ===
	context := "=== SMSytem - TIRE SHOP MANAGEMENT SYSTEM ===\n"
	context += fmt.Sprintf("OVERALL SALES: Today=₱%.2f, ThisMonth=₱%.2f, LastMonth=₱%.2f, Total=₱%.2f\n", todaysSales.Total, monthSales.Total, lastMonthSales.Total, totalSales.Total)
	context += fmt.Sprintf("EXPENSES: ThisMonth=₱%.2f, LastMonth=₱%.2f\n", expensesThisMonth.Total, expensesLastMonth.Total)
	context += fmt.Sprintf("INVENTORY: %d Products, %d LowStock\n", totalProducts, lowStockCount)
	context += fmt.Sprintf("CUSTOMERS: %d Total\n\n", totalCustomers)

	// Branch breakdown
	if len(branchSalesThisMonth) > 0 {
		context += "=== BRANCHES (SALES THIS MONTH) ===\n"
		for _, b := range branchSalesThisMonth {
			orders := 0
			for _, o := range branchOrders {
				if o.BranchID == b.BranchID {
					orders = o.Count
					break
				}
			}
			// Products are central inventory (shared), show total low stock
			context += fmt.Sprintf("BranchID:%d %s: ₱%.2f (%d orders, %d low stock items)\n", b.BranchID, b.BranchName, b.Total, orders, totalLowStock)
		}
	}

	if len(branchSalesTotal) > 0 {
		context += "=== BRANCHES (TOTAL SALES) ===\n"
		for _, b := range branchSalesTotal {
			context += fmt.Sprintf("BranchID:%d %s: ₱%.2f\n", b.BranchID, b.BranchName, b.Total)
		}
	}

	// Product categories
	if len(categories) > 0 {
		context += "=== PRODUCT CATEGORIES ===\n"
		for _, c := range categories {
			context += fmt.Sprintf("%s: %d products, %d stock\n", c.CategoryName, c.Count, c.Stock)
		}
	}

	// Product brands
	if len(brands) > 0 {
		context += "=== PRODUCT BRANDS ===\n"
		for _, b := range brands {
			context += fmt.Sprintf("%s: %d products, %d stock\n", b.BrandName, b.Count, b.Stock)
		}
	}

	// Low stock items
	if len(lowStockItems) > 0 {
		context += "=== LOW STOCK ITEMS (need reorder) ===\n"
		for _, l := range lowStockItems {
			context += fmt.Sprintf("- %s (SKU:%s) Stock:%d Reorder:%d | %s | %s\n", l.ProductName, l.SKU, l.Stock, l.Reorder, l.Category, l.Brand)
		}
	}

	// Top products
	if len(topProducts) > 0 {
		context += "=== TOP PRODUCTS THIS MONTH ===\n"
		for _, p := range topProducts {
			context += fmt.Sprintf("%s: %d sold (₱%.2f)\n", p.ProductName, p.TotalQty, p.TotalSales)
		}
	}

	// Top customers
	if len(topCustomers) > 0 {
		context += "=== TOP CUSTOMERS THIS MONTH ===\n"
		for _, c := range topCustomers {
			context += fmt.Sprintf("%s: ₱%.2f\n", c.CustomerName, c.TotalSales)
		}
	}

	// Staff
	if len(staff) > 0 {
		context += "=== STAFF (by branch) ===\n"
		for _, s := range staff {
			email := s.Email
			if email == "" {
				email = "no email"
			}
			context += fmt.Sprintf("- %s | %s | BranchID:%d\n", s.Name, s.Role, s.BranchID)
		}
	}

	return context
}

func (o *OllamaClient) GenerateWithQuestion(prompt string, businessContext string) (string, error) {
	systemPrompt := `You are a helpful AI assistant for SMSytem, a tire shop with 8 branches.

ROLE: You help the owner answer business questions about sales, inventory, customers, and staff.

IMPORTANT:
- You MUST respond in valid JSON format
- Use the data provided below to answer questions
- If the question asks about something not in the data, check if there's related data you can use
- Be helpful and provide actual insights, not "no data available"

DATABASE DATA:
` + businessContext + `

RESPONSE FORMAT (always valid JSON):
{
  "answer": "Your helpful answer based on the data above",
  "chart_type": "bar|pie|line|metric|alert|none",
  "data": [{"name": "Label", "value": 123}],
  "explanation": "What this data means for the business",
  "suggestions": "One actionable suggestion"
}`

	reqBody := OllamaRequest{
		Model: o.Model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: prompt},
		},
		Stream: false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(o.BaseURL+"/api/chat", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to connect to Ollama: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Ollama returned status %d", resp.StatusCode)
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return "", err
	}

	return ollamaResp.Message.Content, nil
}
