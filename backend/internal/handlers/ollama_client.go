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
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "llama3.2:1b"
	}
	return &OllamaClient{
		BaseURL: baseURL,
		Model:   model,
	}
}

type OllamaOptions struct {
	NumPredict  int     `json:"num_predict,omitempty"`
	NumCtx      int     `json:"num_ctx,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
}

type OllamaRequest struct {
	Model    string         `json:"model"`
	Messages []Message      `json:"messages"`
	Stream   bool           `json:"stream"`
	Options  *OllamaOptions `json:"options,omitempty"`
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
type ContextCacheEntry struct {
	context   string
	timestamp time.Time
}

var contextCache = struct {
	sync.RWMutex
	entries map[uint]ContextCacheEntry
}{
	entries: make(map[uint]ContextCacheEntry),
}

func (o *OllamaClient) GetBusinessContext(branchID uint) string {
	// Check cache first (5 min expiry)
	contextCache.RLock()
	// Default to zero time and empty string if doesn't exist
	entry := contextCache.entries[branchID]
	if time.Since(entry.timestamp) < 5*time.Minute && entry.context != "" {
		defer contextCache.RUnlock()
		return entry.context
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

	// Get all staff/users
	type Staff struct {
		Name  string
		Email string
		Role  string
	}
	var staff []Staff
	db.Raw("SELECT name, email, role FROM users WHERE deleted_at IS NULL").Scan(&staff)

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

	if len(staff) > 0 {
		context += " Staff/Users: "
		for i, s := range staff {
			if i > 0 {
				context += ", "
			}
			context += fmt.Sprintf("%s (%s, %s)", s.Name, s.Email, s.Role)
		}
		context += "."
	}

	// Update cache
	contextCache.Lock()
	contextCache.entries[branchID] = ContextCacheEntry{
		context:   context,
		timestamp: time.Now(),
	}
	contextCache.Unlock()

	return context
}

func (o *OllamaClient) GenerateWithQuestion(prompt string, businessContext string) (string, error) {
	systemPrompt := `You are a tire shop analytics assistant. 

CRITICAL: Only use data provided in the "Data:" section below. NEVER make up or guess data. If the data is not in the context, say "I don't have that information."

IMPORTANT - When to use JSON:
- ONLY respond with JSON when the user asks about specific data like: sales, revenue, products, customers, expenses, orders, profit, trends, charts, analytics, comparisons, rankings, staff, users
- For ALL other questions (greetings, casual chat, opinions, help requests), respond in plain conversational text WITHOUT JSON

Examples of data questions (use JSON):
- "how much did we earn this month"
- "best selling products"
- "show me sales by category"
- "top customers this week"
- "profit vs last month"
- "list all staff"

Examples of non-data questions (plain text):
- "yo" or "hello" or "hi"
- "how are you"
- "thanks"

JSON format for data questions:
{
  "chart_type": "bar|line|pie|metric",
  "title": "Short title",
  "labels": ["label1", "label2"],
  "values": [100, 200],
  "summary": "One sentence"
}

Data: ` + businessContext + `

Remember: 
1. Only use data from the context provided
2. If data is not available, say so
3. JSON only for data questions, plain text for everything else`

	reqBody := OllamaRequest{
		Model: o.Model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: prompt},
		},
		Stream: false,
		Options: &OllamaOptions{
			NumPredict:  200,  // Hard cutoff max generated tokens to prevent running on infinitely
			NumCtx:      1024, // Bind context window tight to save memory + Eval time
			Temperature: 0.1,  // Low temp speeds up argmax sampling and reduces wild guessing
		},
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
