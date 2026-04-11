package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
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

// Cached context - refresh every 5 minutes
var contextCache struct {
	sync.RWMutex
	context   string
	timestamp time.Time
}

func (o *OllamaClient) GetBusinessContext(branchID uint) string {
	// Check cache first (5 min expiry)
	contextCache.RLock()
	if time.Since(contextCache.timestamp) < 5*time.Minute && contextCache.context != "" {
		defer contextCache.RUnlock()
		return contextCache.context
	}
	contextCache.RUnlock()

	db := database.DB

	var totalSales, monthSales, expenses float64
	var products, customers int

	// Essential queries
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) FROM orders WHERE status != 'cancelled'").Scan(&totalSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) FROM orders WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND status != 'cancelled'").Scan(&monthSales)
	db.Raw("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())").Scan(&expenses)
	db.Raw("SELECT COUNT(*) FROM products WHERE deleted_at IS NULL").Scan(&products)
	db.Raw("SELECT COUNT(*) FROM customers").Scan(&customers)

	// Get top products
	type TopProduct struct {
		Name  string
		Total float64
	}
	var topProducts []TopProduct
	db.Raw("SELECT p.name as name, SUM(oi.subtotal) as total FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY p.id, p.name ORDER BY total DESC LIMIT 5").Scan(&topProducts)

	// Get recent customers
	type TopCustomer struct {
		Name  string
		Total float64
	}
	var topCustomers []TopCustomer
	db.Raw("SELECT COALESCE(c.name, o.guest_name) as name, SUM(o.total_amount - o.discount_amount) as total FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.status != 'cancelled' AND YEAR(o.created_at) = YEAR(NOW()) AND MONTH(o.created_at) = MONTH(NOW()) GROUP BY COALESCE(c.name, o.guest_name) ORDER BY total DESC LIMIT 5").Scan(&topCustomers)

	// Build context with real data
	context := fmt.Sprintf("Tire shop this month: Sales ₱%.0f, Total sales ₱%.0f, Expenses ₱%.0f. Products: %d. Customers: %d.", monthSales, totalSales, expenses, products, customers)

	if len(topProducts) > 0 {
		context += " Top products: "
		for i, p := range topProducts {
			if i > 0 {
				context += ", "
			}
			context += fmt.Sprintf("%s ₱%.0f", p.Name, p.Total)
		}
		context += "."
	}

	if len(topCustomers) > 0 {
		context += " Top customers: "
		for i, c := range topCustomers {
			if i > 0 {
				context += ", "
			}
			context += fmt.Sprintf("%s ₱%.0f", c.Name, c.Total)
		}
		context += "."
	}

	// Update cache
	contextCache.Lock()
	contextCache.context = context
	contextCache.timestamp = time.Now()
	contextCache.Unlock()

	return context
}

func (o *OllamaClient) GenerateWithQuestion(prompt string, businessContext string) (string, error) {
	systemPrompt := `You are a tire shop analytics assistant. 

For questions about sales, products, customers, expenses, or any data that can be visualized, you MUST respond with ONLY a JSON object in this exact format (no other text before or after):

{
  "chart_type": "bar|line|pie|metric",
  "title": "Short descriptive title",
  "labels": ["label1", "label2", "label3", ...],
  "values": [number1, number2, number3, ...],
  "summary": "One sentence summary of the data"
}

Chart type rules:
- bar: comparing categories (e.g., monthly sales, top products, sales by category)
- line: trends over time (e.g., daily sales, weekly revenue)
- pie: parts of a whole (e.g., sales by category, payment method breakdown)
- metric: single important number (e.g., total revenue, order count, profit)

For simple greetings or non-data questions, respond in plain conversational text.

Data: ` + businessContext + `

Remember: JSON ONLY for data questions, plain text for everything else.`

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

	client := &http.Client{Timeout: 60 * time.Second}
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
