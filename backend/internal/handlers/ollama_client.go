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

type AIRequest struct {
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

type AIResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

func executeSecureSQL(query string) (string, error) {
	fmt.Printf("\n==============================\n")
	fmt.Printf("[AI SQL TOOL] Incoming Query: %s\n", query)
	
	query = strings.TrimSpace(query)
	query = strings.TrimSuffix(query, ";")
	upperQuery := strings.ToUpper(query)

	if !strings.HasPrefix(upperQuery, "SELECT") {
		fmt.Printf("[AI SQL TOOL] BLOCKED: Not a SELECT statement\n")
		return "", fmt.Errorf("security policy violation: only SELECT statements are allowed")
	}

	if strings.Contains(upperQuery, ";") {
		fmt.Printf("[AI SQL TOOL] BLOCKED: Multiple statements detected (;)\n")
		return "", fmt.Errorf("security policy violation: multiple statements detected")
	}

	blockedKeywords := []string{" DROP ", " DELETE ", " UPDATE ", " INSERT ", " ALTER ", " TRUNCATE ", " REPLACE ", " GRANT ", " CREATE "}
	for _, kw := range blockedKeywords {
		if strings.Contains(" "+upperQuery+" ", kw) { // Add padding to check complete words safely
			fmt.Printf("[AI SQL TOOL] BLOCKED: Forbidden keyword %s\n", kw)
			return "", fmt.Errorf("security policy violation: query contains forbidden keyword '%s'", strings.TrimSpace(kw))
		}
	}

	db := database.DB
	var results []map[string]interface{}
	if err := db.Raw(query).Scan(&results).Error; err != nil {
		fmt.Printf("[AI SQL TOOL] ERROR: %v\n", err)
		return "", fmt.Errorf("database query error: %v", err)
	}

	fmt.Printf("[AI SQL TOOL] SUCCESS: Retrieved %d rows\n", len(results))
	fmt.Printf("==============================\n\n")

	if len(results) == 0 {
		return fmt.Sprintf("[] (Notice: 0 rows found for query: %s)", query), nil
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
	var branchConstraint string
	if branchIDStr == "0" {
		branchConstraint = "The current user is a SUPER ADMIN viewing ALL FRANCHISE DATA globally. DO NOT filter any tables by branch_id. Fetch all data globally unless they ask for a specific branch."
	} else {
		branchConstraint = fmt.Sprintf("The current user is located in Branch ID: %s. For tables that support branches, you MUST include 'WHERE branch_id = %s' (or similar) in your SQL queries to isolate multi-tenant data.", branchIDStr, branchIDStr)
	}

	systemPrompt := fmt.Sprintf(`You are an AI Data Analyst for SMSytem.
You have direct read-only access to the business MySQL database.
%s

EXACT Database Schema:
- orders: id, customer_id, user_id, branch_id, total_amount, discount_amount, status, created_at
- order_items: id, order_id, product_id, quantity, unit_price, subtotal
- products (GLOBAL, no branch_id): id, name, price, cost_price, stock, category_id, brand_id, reorder_level
- customers (GLOBAL, no branch_id): id, name, email, phone, loyalty_points, created_at
- users: id, name, email, role, branch_id
- expenses: id, amount, category, expense_date, branch_id
- stock_transfers: id, source_branch_id, destination_branch_id, status

FORMATTING RULES:
1. ALWAYS use the 'query_database_securely' tool first. Do not guess or hallucinate. Use ONLY the EXACT columns provided above. Examples:
- To find products out of stock: SELECT name, stock FROM products WHERE stock = 0
- To find branch pending transfers: SELECT count(*) FROM stock_transfers WHERE status = 'pending'
2. If the tool returns empty data '[]' or 0, YOU MUST NOT INVENT DATA. Simply report: 'The database returned no records.' Do not use placeholder names like 'John Doe'.
3. If the user asks for a CHART, you MUST output EXACTLY ONLY the JSON format block below. Do this EVEN IF the values are 0! ABSOLUTELY DO NOT include conversational preamble like "Here is the chart". Just output the raw JSON object! 
Format EXACTLY like this:
{
  "chart_type": "bar",
  "title": "Top Selling Products",
  "labels": ["Real Product Name 1", "Real Product Name 2"],
  "values": [5000, 3000],
  "summary": "Here is the chart you requested."
}
4. If the user asks for a simple LIST or a general question, DO NOT output JSON. Write the answer naturally in plain English based ONLY on the SQL data.`, branchConstraint)

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

	apiKey := os.Getenv("GEMINI_API_KEY")

	// Multi-turn loop
	maxTurns := 3
	for turn := 0; turn < maxTurns; turn++ {
		reqBody := AIRequest{
			Model:       "gemini-1.5-flash",
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
		// Using Gemini's OpenAI-compatible endpoint
		req, err := http.NewRequest("POST", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", bytes.NewBuffer(jsonData))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return "", fmt.Errorf("failed to connect to Gemini: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return "", fmt.Errorf("Gemini returned status %d", resp.StatusCode)
		}

		var aiResp AIResponse
		if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
			resp.Body.Close()
			return "", err
		}
		resp.Body.Close()

		if len(aiResp.Choices) == 0 {
			return "", fmt.Errorf("no response from AI")
		}

		responseMessage := aiResp.Choices[0].Message
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
