package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
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
	return cases.Title(language.English).String(status)
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

// SendPromoEmail sends a promotional email for tire sales with a minimalist premium design
func (e *EmailService) SendPromoEmail(toEmail, toName, promoCode, subjectLine, discount, template, validUntil, details string) error {
	if e.APIKey == "" {
		log.Printf("[EMAIL] BREVO_API_KEY not set, skipping promo email to %s", toEmail)
		return nil
	}

	if toEmail == "" {
		return nil
	}

	// Minimalist accent colors
	accentColor := "#4f46e5" // Indigo (Default)
	switch template {
	case "discount":
		accentColor = "#d97706" // Amber
	case "seasonal":
		accentColor = "#059669" // Emerald
	}

	if discount == "" {
		discount = "Special Offer"
	}
	if validUntil == "" {
		validUntil = "End of the month"
	}

	subject := subjectLine
	if subject == "" {
		subject = fmt.Sprintf("Exclusive Offer: %s", discount)
	}

	// Note: Logo should be on a stable public URL
	logoURL := "https://smstyredepot.com/logo.png"

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#ffffff;color:#111827;">
  <table width="100%%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="100%%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <!-- Top Accent Line -->
          <tr><td height="4" style="background-color:%s;"></td></tr>
          
          <!-- Logo & Header -->
          <tr>
            <td style="padding:48px 40px 10px;text-align:center;">
              <img src="%s" alt="SMSystem Logo" style="height:52px;margin-bottom:24px;display:inline-block;">
              <p style="margin:0;font-size:11px;font-weight:700;color:%s;text-transform:uppercase;letter-spacing:0.3em;">SMSystem Premium</p>
            </td>
          </tr>
          
          <!-- Hero Text -->
          <tr>
            <td style="padding:0 40px 56px;text-align:center;">
              <h1 style="margin:0;font-size:36px;font-weight:900;letter-spacing:0.02em;line-height:1.1;color:#1e293b;text-transform:uppercase;">%s</h1>
              <p style="margin:24px 0 0;font-size:16px;color:#64748b;line-height:1.6;font-weight:400;max-width:440px;margin-left:auto;margin-right:auto;">Experience high-performance handling and durability with our exclusive seasonal selections.</p>
            </td>
          </tr>

          <!-- Featured Selection -->
          <tr>
            <td style="padding:0 30px 48px;">
                <p style="margin:0 10px 20px;font-size:12px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.2em;text-align:center;">Curated Selections</p>
                <table width="100%%" cellpadding="0" cellspacing="0" style="table-layout: fixed;">
                    <tr>
                        <td width="33.33%%" align="center" style="padding:8px;">
                            <div style="background-color:#ffffff; border:1px solid #f1f5f9; border-radius:16px; padding:12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                                <img src="https://smstyredepot.com/api/products/566/image" style="width:100%%; height:200px; object-fit:contain; display:block; border-radius:8px;">
                                <p style="margin:16px 0 0;font-size:9px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.15em;">Performance</p>
                            </div>
                        </td>
                        <td width="33.33%%" align="center" style="padding:8px;">
                            <div style="background-color:#ffffff; border:1px solid #f1f5f9; border-radius:16px; padding:12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                                <img src="https://smstyredepot.com/api/products/703/image" style="width:100%%; height:200px; object-fit:contain; display:block; border-radius:8px;">
                                <p style="margin:16px 0 0;font-size:9px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.15em;">Rugged</p>
                            </div>
                        </td>
                        <td width="33.33%%" align="center" style="padding:8px;">
                            <div style="background-color:#ffffff; border:1px solid #f1f5f9; border-radius:16px; padding:12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                                <img src="https://smstyredepot.com/api/products/721/image" style="width:100%%; height:200px; object-fit:contain; display:block; border-radius:8px;">
                                <p style="margin:16px 0 0;font-size:9px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.15em;">All-Season</p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
          </tr>

          <!-- Custom Details Section -->
          %s
          
          <!-- Promo Code Card -->
          <tr>
            <td style="padding:0 40px 56px;">
              <div style="background-color:#111827; border-radius:20px; padding:48px 32px; text-align:center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
                <p style="margin:0;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3em;">Exclusive Redemption Code</p>
                <p style="margin:20px 0;font-size:42px;font-weight:900;color:#ffffff;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:0.2em;">%s</p>
                <div style="display:inline-block;padding:8px 20px;background-color:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:1000px;margin-top:12px;">
                  <p style="margin:0;font-size:12px;color:#94a3b8;font-weight:500;">Valid until %s</p>
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Shop Button -->
          <tr>
            <td style="padding:0 40px 64px;text-align:center;">
              <a href="https://smstyredepot.com" style="display:inline-block;background-color:#111827;color:#ffffff;padding:20px 56px;border-radius:12px;font-size:14px;font-weight:800;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Visit Collection</a>
              <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;font-weight:500;">Premium Delivery Included over ₱5,000</p>
            </td>
          </tr>

          <!-- Trust Badges Row -->
          <tr>
            <td style="padding:0 40px 48px;text-align:center;border-bottom:1px solid #f1f5f9;">
              <table width="100%%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33.33%%" align="center">
                    <p style="margin:0;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;">🛡️ Certified</p>
                  </td>
                  <td width="33.33%%" align="center">
                    <p style="margin:0;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;">🏅 Official</p>
                  </td>
                  <td width="33.33%%" align="center">
                    <p style="margin:0;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;">🚀 Quick Install</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:56px 40px;background-color:#ffffff;text-align:center;">
              <p style="margin:0;font-size:14px;font-weight:900;color:#1e293b;text-transform:uppercase;letter-spacing:0.2em;">SMSystem Tire Depot</p>
              <p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.6;">W5V3+79P, J.M Katigbak St.<br/>Lipa City, 4217 Batangas</p>
              
              <!-- Social & Contact Links -->
              <div style="margin:32px 0;">
                <a href="https://www.facebook.com/SMSTyreDepotLipa.Official" style="display:inline-block;margin:0 16px;text-decoration:none;color:#1e293b;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">Facebook</a>
                <span style="color:#e2e8f0;">•</span>
                <p style="display:inline-block;margin:0 16px;color:#1e293b;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">0917-706-0025</p>
                <span style="color:#e2e8f0;">•</span>
                <a href="https://smstyredepot.com" style="display:inline-block;margin:0 16px;text-decoration:none;color:#1e293b;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">Website</a>
              </div>

              <div style="margin:40px 0 0;padding-top:32px;border-top:1px solid #f1f5f9;">
                <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;font-weight:400;">
                  This is an automated message intended for %s.<br/>
                  Manage your preferences or unsubscribe at any time.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
		accentColor, logoURL, accentColor, discount, e.detailsSection(details), promoCode, validUntil, toEmail)

	err := e.Send(toEmail, toName, subject, html)
	if err != nil {
		log.Printf("[EMAIL] FAILED to send promo email to %s: %v", toEmail, err)
		return err
	}

	log.Printf("[EMAIL] Promo email sent to %s with code %s", toEmail, promoCode)
	return nil
}

func (e *EmailService) detailsSection(details string) string {
	if details == "" {
		return ""
	}
	return fmt.Sprintf(`<tr>
            <td style="padding:0 40px 48px;">
              <div style="background-color:#fdfdfd; border-left:3px solid #d97706; padding:20px 24px;">
                <p style="margin:0;font-size:14px;font-style:italic;color:#475569;line-height:1.7;">"%s"</p>
              </div>
            </td>
          </tr>`, details)
}
