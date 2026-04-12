package handlers

import (
	"net/http"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type PromoHandler struct {
	EmailService *services.EmailService
}

func NewPromoHandler(emailSvc *services.EmailService) *PromoHandler {
	return &PromoHandler{EmailService: emailSvc}
}

type PromoEmailRequest struct {
	Recipients []Recipient `json:"recipients" binding:"required"`
	Template   string      `json:"template" binding:"required"`
	PromoCode  string      `json:"promo_code" binding:"required"`
	Discount   string      `json:"discount"`
	ValidUntil string      `json:"valid_until"`
	Details    string      `json:"details"`
}

type Recipient struct {
	Email string `json:"email" binding:"required,email"`
	Name  string `json:"name"`
}

func (h *PromoHandler) SendPromoEmail(c *gin.Context) {
	var req PromoEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request: " + err.Error()})
		return
	}

	if len(req.Recipients) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No recipients provided"})
		return
	}

	// Set defaults based on template
	if req.Discount == "" {
		req.Discount = "Buy 4 Get 1 Free"
	}
	if req.ValidUntil == "" {
		req.ValidUntil = "April 30, 2026"
	}

	successCount := 0
	failedCount := 0
	var failedEmails []string

	for _, r := range req.Recipients {
		name := r.Name
		if name == "" {
			name = "Valued Customer"
		}

		err := h.EmailService.SendPromoEmail(r.Email, name, req.PromoCode, req.Discount)
		if err != nil {
			failedCount++
			failedEmails = append(failedEmails, r.Email)
		} else {
			successCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Promo emails sent",
		"success":       successCount,
		"failed":        failedCount,
		"failed_emails": failedEmails,
	})
}
