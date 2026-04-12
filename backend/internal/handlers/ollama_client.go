package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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

type GeminiNativeRequest struct {
	Contents []NativeContent `json:"contents"`
	Tools    []NativeTool    `json:"tools,omitempty"`
}

type NativeContent struct {
	Role  string       `json:"role"`
	Parts []NativePart `json:"parts"`
}

type NativePart struct {
	Text             string              `json:"text,omitempty"`
	ThoughtSignature string              `json:"thoughtSignature,omitempty"`
	FunctionCall     *NativeFunctionCall `json:"functionCall,omitempty"`
	FunctionResponse *NativeFunctionResp `json:"functionResponse,omitempty"`
}

type NativeFunctionCall struct {
	Name string                 `json:"name"`
	Args map[string]interface{} `json:"args"`
}

type NativeFunctionResp struct {
	Name     string                 `json:"name"`
	Response map[string]interface{} `json:"response"`
}

type NativeTool struct {
	FunctionDeclarations []NativeFuncDecl `json:"functionDeclarations"`
}

type NativeFuncDecl struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

type GeminiNativeResponse struct {
	Candidates []struct {
		Content struct {
			Parts []NativePart `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
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

// GenerateWithQuestion runs the multi-turn Native Gemini AI agent to execute SQL dynamically
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
3. If the user asks for a CHART, you MUST output EXACTLY ONLY ONE JSON format block below. Combine data into a single chart if multiple items are requested. ABSOLUTELY DO NOT include conversational preamble like "Here is the chart". Just output the raw JSON object! 
Format EXACTLY like this:
{
  "chart_type": "bar",
  "title": "Top Selling Products",
  "labels": ["Real Product Name 1", "Real Product Name 2"],
  "values": [5000, 3000],
  "summary": "Here is the chart you requested."
}
4. If the user asks for a simple LIST or a general question, DO NOT output JSON. Write the answer naturally in plain English based ONLY on the SQL data.`, branchConstraint)

	// In Native Gemini, the system prompt goes in the first user message or a physical system instruction
	// For simplicity, we'll prefix it to the first user message or use it as a standalone user content
	contents := []NativeContent{
		{
			Role: "user",
			Parts: []NativePart{
				{Text: "System Instructions: " + systemPrompt},
				{Text: "User Question: " + prompt},
			},
		},
	}

	tools := []NativeTool{
		{
			FunctionDeclarations: []NativeFuncDecl{
				{
					Name:        "query_database_securely",
					Description: "Run a secure, READ-ONLY MySQL SELECT query to fetch data from the SMSytem database. Remember to filter by branch_id if appropriate.",
					Parameters: map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"sql_query": map[string]interface{}{
								"type":        "STRING",
								"description": "The exact MySQL SELECT statement.",
							},
						},
						"required": []string{"sql_query"},
					},
				},
			},
		},
	}

	apiKey := os.Getenv("GEMINI_API_KEY")

	// Multi-turn loop
	maxTurns := 4
	for turn := 0; turn < maxTurns; turn++ {
		reqBody := GeminiNativeRequest{
			Contents: contents,
			Tools:    tools,
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			return "", err
		}

		client := &http.Client{Timeout: 30 * time.Second}
		// Native generateContent URL - Matching the exact model that worked in your curl
		apiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
		req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-goog-api-key", apiKey)

		fmt.Printf("[Turn %d] Sending request to Native Gemini...\n", turn)
		resp, err := client.Do(req)
		if err != nil {
			return "", fmt.Errorf("failed to connect to Gemini Native: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return "", fmt.Errorf("Gemini Native returned status %d. Error body: %s", resp.StatusCode, string(bodyBytes))
		}

		var aiResp GeminiNativeResponse
		if err := json.NewDecoder(resp.Body).Decode(&aiResp); err != nil {
			resp.Body.Close()
			return "", err
		}
		resp.Body.Close()

		if len(aiResp.Candidates) == 0 {
			return "", fmt.Errorf("no candidates in Gemini response")
		}

		responseContent := aiResp.Candidates[0].Content
		contents = append(contents, NativeContent{
			Role:  "model",
			Parts: responseContent.Parts,
		})

		// Check for Function Call
		var foundToolUse bool
		for _, part := range responseContent.Parts {
			if part.FunctionCall != nil {
				foundToolUse = true
				if part.FunctionCall.Name == "query_database_securely" {
					sqlQuery, ok := part.FunctionCall.Args["sql_query"].(string)
					var resultStr string
					var execErr error
					if !ok {
						resultStr = "Error: sql_query argument missing"
					} else {
						resultStr, execErr = executeSecureSQL(sqlQuery)
						if execErr != nil {
							resultStr = fmt.Sprintf("Error executing SQL: %v", execErr)
						}
					}

					// Append Function Response to contents
					contents = append(contents, NativeContent{
						Role: "user", // In native REST, function results are often sent back as 'user' or 'function' role depending on SDK wrapper logic, but 'user' with functionResponse works in REST v1beta
						Parts: []NativePart{
							{
								FunctionResponse: &NativeFunctionResp{
									Name:     "query_database_securely",
									Response: map[string]interface{}{"result": resultStr},
								},
							},
						},
					})
				}
			}
		}

		if !foundToolUse {
			// No more tool calls, return the last text part
			finalText := ""
			for _, part := range responseContent.Parts {
				if part.Text != "" {
					finalText += part.Text
				}
			}
			return finalText, nil
		}
	}

	return "", fmt.Errorf("max turns reached in AI loop")
}
