package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
)

type EmailService struct {
	APIKey    string
	FromEmail string
	FromName  string
	AdminBcc  string
}

func NewEmailService() *EmailService {
	return &EmailService{
		APIKey:    os.Getenv("BREVO_API_KEY"),
		FromEmail: getEmailEnv("BREVO_FROM_EMAIL", "johndinglasan12@gmail.com"),
		FromName:  getEmailEnv("BREVO_FROM_NAME", "SMSystem"),
		AdminBcc:  os.Getenv("ADMIN_BCC_EMAIL"),
	}
}

func getEmailEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type brevoContact struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type brevoPayload struct {
	Sender      brevoContact   `json:"sender"`
	To          []brevoContact `json:"to"`
	Bcc         []brevoContact `json:"bcc,omitempty"`
	Subject     string         `json:"subject"`
	HTMLContent string         `json:"htmlContent"`
}

func (e *EmailService) Send(toEmail, toName, subject, htmlContent string) error {
	if e.APIKey == "" {
		log.Printf("[EMAIL] BREVO_API_KEY not set, skipping email to %s | Subject: %s", toEmail, subject)
		return nil
	}

	if toEmail == "" {
		return nil
	}

	payload := brevoPayload{
		Sender:      brevoContact{Email: e.FromEmail, Name: e.FromName},
		To:          []brevoContact{{Email: toEmail, Name: toName}},
		Subject:     subject,
		HTMLContent: htmlContent,
	}

	if e.AdminBcc != "" && e.AdminBcc != toEmail {
		payload.Bcc = []brevoContact{{Email: e.AdminBcc}}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.brevo.com/v3/smtp/email", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("api-key", e.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("[EMAIL] ERROR sending to %s: %v", toEmail, err)
		return fmt.Errorf("brevo API request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		log.Printf("[EMAIL] ERROR Brevo returned %d to %s: %s", resp.StatusCode, toEmail, string(respBody))
		return fmt.Errorf("brevo returned status %d: %s", resp.StatusCode, string(respBody))
	}

	log.Printf("[EMAIL] OK sent to %s | Subject: %s", toEmail, subject)
	return nil
}

// Status display helpers
func statusLabel(status string) string {
	labels := map[string]string{
		"pending":    "Pending Approval",
		"approved":   "Approved",
		"in_transit": "Shipped / In Transit",
		"completed":  "Received & Completed",
		"rejected":   "Rejected",
		"cancelled":  "Cancelled",
	}
	if label, ok := labels[status]; ok {
		return label
	}
	return strings.Title(status)
}

func statusColor(status string) string {
	colors := map[string]string{
		"pending":    "#f59e0b",
		"approved":   "#3b82f6",
		"in_transit": "#8b5cf6",
		"completed":  "#10b981",
		"rejected":   "#ef4444",
		"cancelled":  "#6b7280",
	}
	if color, ok := colors[status]; ok {
		return color
	}
	return "#4f46e5"
}

// adjustColor returns a second gradient color for the header
func adjustColor(hex string) string {
	gradients := map[string]string{
		"#f59e0b": "#d97706",
		"#3b82f6": "#2563eb",
		"#8b5cf6": "#7c3aed",
		"#10b981": "#059669",
		"#ef4444": "#dc2626",
		"#6b7280": "#4b5563",
		"#4f46e5": "#4338ca",
	}
	if g, ok := gradients[hex]; ok {
		return g
	}
	return hex
}

func statusEmoji(status string) string {
	emojis := map[string]string{
		"pending":    "⏳",
		"approved":   "✅",
		"in_transit": "🚚",
		"completed":  "📦",
		"rejected":   "❌",
		"cancelled":  "🚫",
	}
	if emoji, ok := emojis[status]; ok {
		return emoji
	}
	return "📋"
}

func statusActionMessage(status, recipientType string) string {
	if recipientType == "source" {
		switch status {
		case "approved":
			return "Your transfer request has been approved. Please prepare the items for shipment and click <strong>Ship</strong> when ready."
		case "in_transit":
			return "The items have been shipped and are now in transit to the destination branch."
		case "completed":
			return "The destination branch has confirmed receipt of all items. This transfer is now complete."
		case "rejected":
			return "This transfer request has been rejected. Please review and create a new request if needed."
		case "cancelled":
			return "This transfer has been cancelled. No stock was moved."
		default:
			return "The transfer status has been updated."
		}
	}
	switch status {
	case "in_transit":
		return "A shipment is on its way to your branch. Please prepare to receive and verify the items, then click <strong>Receive</strong> to confirm."
	case "completed":
		return "You have confirmed receipt of all items. This transfer is now complete."
	default:
		return "The transfer status has been updated."
	}
}

func (e *EmailService) SendTransferNotification(toEmail, branchName, refNumber, status, fromBranch, toBranch string) error {
	if toEmail == "" {
		log.Printf("[EMAIL] No email address for branch %s, skipping notification", branchName)
		return nil
	}

	log.Printf("[EMAIL] Sending transfer notification to %s (ref: %s, status: %s)", toEmail, refNumber, status)

	recipientType := "source"
	if branchName == toBranch {
		recipientType = "destination"
	}

	emoji := statusEmoji(status)
	label := statusLabel(status)
	color := statusColor(status)
	actionMsg := statusActionMessage(status, recipientType)

	subject := fmt.Sprintf("%s [%s] Transfer %s — %s", emoji, branchName, refNumber, label)

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#ffffff;">
  <table width="100%%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <tr><td style="border-top:4px solid %s;padding-top:32px;">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:2px;font-weight:600;">SMSystem</p>
          <h1 style="margin:0 0 24px;font-size:22px;color:#111827;font-weight:700;">%s %s</h1>
        </td></tr>

        <tr><td style="padding-bottom:24px;">
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">%s</p>
        </td></tr>

        <tr><td style="padding:20px;background:#f9fafb;border-radius:8px;">
          <table width="100%%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;width:100px;">Reference</td>
              <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;font-family:monospace;">%s</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;">From</td>
              <td style="padding:6px 0;color:#111827;font-size:13px;">%s</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;">To</td>
              <td style="padding:6px 0;color:#111827;font-size:13px;">%s</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:13px;">Status</td>
              <td style="padding:6px 0;"><span style="display:inline-block;background:%s;color:#fff;padding:2px 10px;border-radius:10px;font-size:12px;font-weight:600;">%s</span></td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding-top:32px;border-top:1px solid #e5e7eb;margin-top:24px;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated notification from SMSystem.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
		color, emoji, label,
		actionMsg,
		refNumber, fromBranch, toBranch, color, label,
	)

	err := e.Send(toEmail, "Branch Manager", subject, html)
	if err != nil {
		log.Printf("[EMAIL] FAILED to send transfer notification to %s for %s: %v", toEmail, refNumber, err)
		return nil
	}

	return nil
}
