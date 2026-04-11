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
		Model:   "qwen2.5:0.5b",
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

	// FAST - only run 5 essential queries
	db := database.DB

	var totalSales, monthSales, expenses float64
	var products, customers int

	// Just 5 queries instead of 19 - WAY faster
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) FROM orders WHERE status != 'cancelled'").Scan(&totalSales)
	db.Raw("SELECT COALESCE(SUM(total_amount - discount_amount), 0) FROM orders WHERE YEAR(created_at) = YEAR(NOW()) AND MONTH(created_at) = MONTH(NOW()) AND status != 'cancelled'").Scan(&monthSales)
	db.Raw("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())").Scan(&expenses)
	db.Raw("SELECT COUNT(*) FROM products WHERE deleted_at IS NULL").Scan(&products)
	db.Raw("SELECT COUNT(*) FROM customers").Scan(&customers)

	// Build simple context string
	context := fmt.Sprintf("Tire shop sales: ₱%.0f this month, ₱%.0f total. Expenses: ₱%.0f. Products: %d. Customers: %d.", monthSales, totalSales, expenses, products, customers)

	// Update cache
	contextCache.Lock()
	contextCache.context = context
	contextCache.timestamp = time.Now()
	contextCache.Unlock()

	return context
}

func (o *OllamaClient) GenerateWithQuestion(prompt string, businessContext string) (string, error) {
	systemPrompt := `You are a helpful assistant for a tire shop. Reply in English only. Keep it short.
Data: ` + businessContext + `
Respond in JSON: {"answer":"your answer","chart_type":"none","explanation":"","suggestions":""}`

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
