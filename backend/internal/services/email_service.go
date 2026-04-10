package services

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

type EmailService struct {
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	FromEmail    string
	FromName     string
	AdminBcc     string
}

func NewEmailService() *EmailService {
	return &EmailService{
		SMTPHost:     getEmailEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEmailEnv("SMTP_PORT", "587"),
		SMTPUser:     os.Getenv("SMTP_USER"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		FromEmail:    getEmailEnv("SMTP_FROM_EMAIL", ""),
		FromName:     getEmailEnv("SMTP_FROM_NAME", "SMSystem"),
		AdminBcc:     os.Getenv("ADMIN_BCC_EMAIL"),
	}
}

func getEmailEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (e *EmailService) Send(toEmail, toName, subject, htmlContent string) error {
	if e.SMTPUser == "" || e.SMTPPassword == "" {
		log.Printf("[EMAIL] SMTP credentials not set, skipping email to %s | Subject: %s", toEmail, subject)
		return nil
	}

	if toEmail == "" {
		return nil
	}

	// Build recipient list
	recipients := []string{toEmail}
	if e.AdminBcc != "" && e.AdminBcc != toEmail {
		recipients = append(recipients, e.AdminBcc)
	}

	// Determine from email
	fromEmail := e.FromEmail
	if fromEmail == "" {
		fromEmail = e.SMTPUser
	}

	// Build email headers and body
	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: %s <%s>\r\n", e.FromName, fromEmail))
	msg.WriteString(fmt.Sprintf("To: %s <%s>\r\n", toName, toEmail))
	if e.AdminBcc != "" && e.AdminBcc != toEmail {
		msg.WriteString(fmt.Sprintf("Bcc: %s\r\n", e.AdminBcc))
	}
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlContent)

	// Connect to SMTP server with TLS
	auth := smtp.PlainAuth("", e.SMTPUser, e.SMTPPassword, e.SMTPHost)
	addr := e.SMTPHost + ":" + e.SMTPPort

	// Use TLS for port 587 (STARTTLS)
	tlsConfig := &tls.Config{
		ServerName: e.SMTPHost,
	}

	conn, err := smtp.Dial(addr)
	if err != nil {
		log.Printf("[EMAIL] ERROR connecting to SMTP %s: %v", addr, err)
		return fmt.Errorf("failed to connect to SMTP: %w", err)
	}
	defer conn.Close()

	// STARTTLS
	if err = conn.StartTLS(tlsConfig); err != nil {
		log.Printf("[EMAIL] ERROR STARTTLS: %v", err)
		return fmt.Errorf("STARTTLS failed: %w", err)
	}

	// Authenticate
	if err = conn.Auth(auth); err != nil {
		log.Printf("[EMAIL] ERROR auth as %s: %v", e.SMTPUser, err)
		return fmt.Errorf("SMTP auth failed: %w", err)
	}

	// Set sender
	if err = conn.Mail(fromEmail); err != nil {
		return fmt.Errorf("MAIL FROM failed: %w", err)
	}

	// Set recipients
	for _, rcpt := range recipients {
		if err = conn.Rcpt(rcpt); err != nil {
			log.Printf("[EMAIL] ERROR adding recipient %s: %v", rcpt, err)
		}
	}

	// Send body
	w, err := conn.Data()
	if err != nil {
		return fmt.Errorf("DATA failed: %w", err)
	}

	_, err = w.Write([]byte(msg.String()))
	if err != nil {
		return fmt.Errorf("write failed: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("close failed: %w", err)
	}

	conn.Quit()

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

	subject := fmt.Sprintf("%s [%s] Transfer %s - %s", emoji, branchName, refNumber, label)

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #4f46e5 0%%, #7c3aed 100%%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">%s Stock Transfer Update</h1>
      <p style="color: #c7d2fe; margin: 8px 0 0 0; font-size: 14px;">Reference: %s</p>
    </div>
    <div style="background: #ffffff; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; background-color: %s; color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">%s %s</span>
      </div>
      <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">%s</p>
      <table style="width: 100%%; border-collapse: collapse; margin: 0 0 24px 0;">
        <tr>
          <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151; width: 40%%;">Reference</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827; font-family: monospace;">%s</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">From Branch</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827;">%s</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">To Branch</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb; color: #111827;">%s</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Status</td>
          <td style="padding: 12px 16px; border: 1px solid #e5e7eb;"><span style="color: %s; font-weight: 600;">%s</span></td>
        </tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">This is an automated notification from SMSystem.</p>
    </div>
  </div>
</body>
</html>`,
		emoji, refNumber, color, emoji, label, actionMsg,
		refNumber, fromBranch, toBranch, color, label,
	)

	err := e.Send(toEmail, "Branch Manager", subject, html)
	if err != nil {
		log.Printf("[EMAIL] FAILED to send transfer notification to %s for %s: %v", toEmail, refNumber, err)
		return nil
	}

	return nil
}
