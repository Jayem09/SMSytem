package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
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
		model = "gemma2:2b"
	}
	return &OllamaClient{
		BaseURL: baseURL,
		Model:   model,
	}
}

type ToolFunction struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type Tool struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // This is a JSON string from the AI
}

type ToolCall struct {
	ID       string           `json:"id"`
	Type     string           `json:"type"`
	Function ToolCallFunction `json:"function"`
}

type GroqRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Tools       []Tool    `json:"tools,omitempty"`
	ToolChoice  string    `json:"tool_choice,omitempty"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
}

type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	Name       string     `json:"name,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

type GroqResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

func executeSecureSQL(query string) (string, error) {
	query = strings.TrimSpace(query)
	upperQuery := strings.ToUpper(query)

	if !strings.HasPrefix(upperQuery, "SELECT") {
		return "", fmt.Errorf("security policy violation: only SELECT statements are allowed")
	}

	blockedKeywords := []string{";", "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "REPLACE", "GRANT", "CREATE"}
	for _, kw := range blockedKeywords {
		if strings.Contains(upperQuery, kw) {
			return "", fmt.Errorf("security policy violation: query contains forbidden keyword '%s'", kw)
		}
	}

	db := database.DB
	var results []map[string]interface{}
	if err := db.Raw(query).Scan(&results).Error; err != nil {
		return "", fmt.Errorf("database query error: %v", err)
	}

	if len(results) == 0 {
		return "[]", nil
	}

	bytes, err := json.Marshal(results)
	if err != nil {
		return "", fmt.Errorf("failed to format JSON: %v", err)
	}
	return string(bytes), nil
}

// GetBusinessContext acts as a pass-through to send the branchID to the AI loop securely without needing to refactor external handlers
func (o *OllamaClient) GetBusinessContext(branchID uint) string {
	return fmt.Sprintf("%d", branchID)
}

// GenerateWithQuestion runs the multi-turn AI agent to execute SQL dynamically
func (o *OllamaClient) GenerateWithQuestion(prompt string, branchIDStr string) (string, error) {
	// 2. Build explicit instructions for AI
	systemPrompt := fmt.Sprintf(`You are an AI Data Analyst for SMSytem.
You have direct read-only access to the business MySQL database.
The current user is located in Branch ID: %s. Unless the user specifically asks for global/franchise data, you MUST include 'WHERE branch_id = %s' (or o.branch_id) in your SQL queries to isolate multi-tenant data.

Database Schema Overview:
- orders: id, customer_id, user_id, branch_id, total_amount, discount_amount, status ('completed', 'cancelled', 'pending'), created_at
- order_items: id, order_id, product_id, quantity, unit_price, subtotal
- products: id, name, description, price, stock_quantity, reorder_level
- customers: id, name, phone, email, points, created_at
- users: id, current_branch_id, username, full_name, role
- expenses: id, amount, category, expense_date, branch_id
- stock_transfers: id, source_branch_id, destination_branch_id, status ('pending', 'approved', 'in_transit', 'completed', 'rejected')

IMPORTANT INSTRUCTIONS:
1. When asked for business data, ALWAYS use the 'query_database_securely' tool to fetch it using standard MySQL syntax FIRST. Use LIMIT or GROUP BY for large sets.
2. If the user asks for metrics, charts, or data lists, you MUST output EXACTLY ONLY the JSON format block. ABSOLUTELY DO NOT include conversational preamble like "Here is the chart". Just output the raw JSON object! 
Format EXACTLY like this:
{
  "chart_type": "bar",
  "title": "Top Selling Products",
  "labels": ["Product A", "Product B"],
  "values": [5000, 3000],
  "summary": "Here are the top products you requested."
}`, branchIDStr, branchIDStr)

	messages := []Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: prompt},
	}

	tools := []Tool{
		{
			Type: "function",
			Function: ToolFunction{
				Name:        "query_database_securely",
				Description: "Run a secure, READ-ONLY MySQL SELECT query to fetch data from the SMSytem database. Remember to filter by branch_id if appropriate.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"sql_query": map[string]interface{}{
							"type":        "string",
							"description": "The exact MySQL SELECT statement.",
						},
					},
					"required": []string{"sql_query"},
				},
			},
		},
	}

	apiKey := os.Getenv("GROQ_API_KEY")

	// Multi-turn loop
	maxTurns := 3
	for turn := 0; turn < maxTurns; turn++ {
		reqBody := GroqRequest{
			Model:       "llama-3.3-70b-versatile",
			Messages:    messages,
			Tools:       tools,
			ToolChoice:  "auto",
			Temperature: 0.1,
			MaxTokens:   500,
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			return "", err
		}

		client := &http.Client{Timeout: 15 * time.Second}
		req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonData))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return "", fmt.Errorf("failed to connect to Groq: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return "", fmt.Errorf("Groq returned status %d", resp.StatusCode)
		}

		var groqResp GroqResponse
		if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
			resp.Body.Close()
			return "", err
		}
		resp.Body.Close()

		if len(groqResp.Choices) == 0 {
			return "", fmt.Errorf("no response from AI")
		}

		responseMessage := groqResp.Choices[0].Message
		messages = append(messages, responseMessage)

		// Check if AI wants to use a tool
		if len(responseMessage.ToolCalls) > 0 {
			for _, toolCall := range responseMessage.ToolCalls {
				if toolCall.Function.Name == "query_database_securely" {
					var args map[string]string
					json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
					
					sqlQuery := args["sql_query"]
					queryResult, err := executeSecureSQL(sqlQuery)
					if err != nil {
						queryResult = fmt.Sprintf("Error executing SQL: %v", err)
					}

					messages = append(messages, Message{
						Role:       "tool",
						ToolCallID: toolCall.ID,
						Name:       toolCall.Function.Name,
						Content:    queryResult,
					})
				}
			}
			continue // Send tool output back to Groq
		}

		return responseMessage.Content, nil
	}

	return "", fmt.Errorf("AI loop exhausted")
}
