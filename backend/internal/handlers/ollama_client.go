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

	var todaysSales, monthSales, lastMonthSales, totalSales salesSum
	var todaysOrders, monthOrders, totalOrders orderCount
	var totalProducts productCount
	var totalCustomers customerCount
	var lowStock lowStockCount
	var topProducts []topProduct
	var topCustomers []topCustomer
	var expensesThisMonth, expensesLastMonth salesSum

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

	return context
}

func (o *OllamaClient) GenerateWithQuestion(prompt string, businessContext string) (string, error) {
	systemPrompt := `You are the AI assistant for SMSytem - a Sales Management System for a tire shop business with 8 branches.

BUSINESS CONTEXT:
- You have access to REAL data from the SMS database
- The business sells tires, batteries, oil, and provides services (tire rotation, alignment, balancing)
- 8 branches: Main (San Jose), Balintawak, Lipa, Malvar, Tanauan, Sto. Tomas, Batangas, Tagbilaran
- They track: orders, customers, products (tires, batteries, oil, services), inventory, expenses, suppliers
- Key terms: service advisor (SA), walk-in customer, loyalty points, RFID membership, purchase orders

WHAT YOU KNOW FROM THE DATABASE:
` + businessContext + `

RULES:
1. ONLY use the data provided above - NEVER make up numbers
2. If you don't have data for something, say "I don't have that data"
3. Keep answers brief - 2-4 sentences max
4. Use bullet points for lists
5. Always be actionable - suggest next steps

EXAMPLE RESPONSES:
- If sales are low: "Sales are down X% from last month. Consider running a promotion on slow-moving items."
- If inventory is low: "X items need reorder. Priority: brake pads, batteries, and fast-moving tire sizes."
- If customers are up: "Great month! X new customers. Top referrers were..."

Answer the user's question based on the REAL data above.`

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
