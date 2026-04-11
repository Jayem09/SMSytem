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

	type salesSum struct{ Total float64 }
	type orderCount struct{ Count int }
	type productCount struct{ Count int }
	type customerCount struct{ Count int }
	type lowStockCount struct{ Count int }
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

	var todaysSales, monthSales, lastMonthSales, totalSales salesSum
	var todaysOrders, monthOrders, totalOrders orderCount
	var totalProducts productCount
	var totalCustomers customerCount
	var lowStock lowStockCount
	var topProducts []topProduct
	var topCustomers []topCustomer
	var expensesThisMonth, expensesLastMonth salesSum
	var staff []staffInfo

	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'").Scan(&todaysSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND status != 'cancelled'").Scan(&monthSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE YEAR(created_at) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(created_at) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND status != 'cancelled'").Scan(&lastMonthSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) as total FROM orders WHERE status != 'cancelled'").Scan(&totalSales)

	db.Raw("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'").Scan(&todaysOrders)
	db.Raw("SELECT COUNT(*) as count FROM orders WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND status != 'cancelled'").Scan(&monthOrders)
	db.Raw("SELECT COUNT(*) as count FROM orders WHERE status != 'cancelled'").Scan(&totalOrders)

	db.Raw("SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL").Scan(&totalProducts)
	db.Raw("SELECT COUNT(*) as count FROM customers").Scan(&totalCustomers)
	db.Raw("SELECT COUNT(*) as count FROM products WHERE stock <= reorder_level AND deleted_at IS NULL").Scan(&lowStock)

	db.Raw("SELECT p.name as product_name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as total_sales FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY p.id, p.name ORDER BY total_sales DESC LIMIT 5").Scan(&topProducts)

	db.Raw("SELECT COALESCE(c.name, o.guest_name) as customer_name, SUM(o.total_amount - o.discount_amount) as total_sales FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY COALESCE(c.name, o.guest_name) ORDER BY total_sales DESC LIMIT 5").Scan(&topCustomers)

	db.Raw("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())").Scan(&expensesThisMonth)
	db.Raw("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE YEAR(expense_date) = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH)) AND MONTH(expense_date) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))").Scan(&expensesLastMonth)

	db.Raw("SELECT name, email, role, branch_id FROM users WHERE deleted_at IS NULL").Scan(&staff)

	context := fmt.Sprintf(`SALES: Today=₱%.2f, ThisMonth=₱%.2f, LastMonth=₱%.2f, Total=₱%.2f`, todaysSales.Total, monthSales.Total, lastMonthSales.Total, totalSales.Total)
	context += fmt.Sprintf(`\nORDERS: Today=%d, ThisMonth=%d, Total=%d`, todaysOrders.Count, monthOrders.Count, totalOrders.Count)
	context += fmt.Sprintf(`\nEXPENSES: ThisMonth=₱%.2f, LastMonth=₱%.2f`, expensesThisMonth.Total, expensesLastMonth.Total)
	context += fmt.Sprintf(`\nINVENTORY: Products=%d, LowStock=%d`, totalProducts.Count, lowStock.Count)
	context += fmt.Sprintf(`\nCUSTOMERS: Total=%d`, totalCustomers.Count)

	if len(topProducts) > 0 {
		context += "\nTOP PRODUCTS THIS MONTH:"
		for _, p := range topProducts {
			context += fmt.Sprintf("\n- %s: %d sold (₱%.2f)", p.ProductName, p.TotalQty, p.TotalSales)
		}
	}

	if len(topCustomers) > 0 {
		context += "\nTOP CUSTOMERS THIS MONTH:"
		for _, c := range topCustomers {
			context += fmt.Sprintf("\n- %s: ₱%.2f", c.CustomerName, c.TotalSales)
		}
	}

	if len(staff) > 0 {
		context += "\n\nSTAFF (ALL BRANCHES):"
		for _, s := range staff {
			email := s.Email
			if email == "" {
				email = "no email"
			}
			context += fmt.Sprintf("\n- %s | %s | BranchID:%d", s.Name, email, s.BranchID)
		}
	}

	return context
}

func (o *OllamaClient) GenerateWithQuestion(prompt string, businessContext string) (string, error) {
	systemPrompt := `You are the AI assistant for SMSytem - a tire shop Sales Management System.

CRITICAL RULES:
1. ALWAYS use ONLY the data provided in the "DATABASE DATA" section below
2. NEVER use external knowledge or estimates - only the numbers from the database
3. If data is not provided, say "I don't have that data"
4. All money is in PHP (Philippine Pesos) - never use $

DATABASE DATA:
` + businessContext + `

Response format:
- 2-3 sentences max
- Include specific numbers from the data above
- If comparing months, calculate the % change yourself
- Suggest 1 actionable next step`

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

	client := &http.Client{Timeout: 120 * time.Second}
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
