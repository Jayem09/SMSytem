package handlers

import (
	"net/http"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type TerminalHandler struct {
	TerminalService *services.TerminalService
}

func NewTerminalHandler(ts *services.TerminalService) *TerminalHandler {
	return &TerminalHandler{TerminalService: ts}
}

type paymentReq struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
}

func (h *TerminalHandler) ProcessPayment(c *gin.Context) {
	var req paymentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid amount"})
		return
	}

	// Trigger terminal processing
	// This will block until terminal responds or times out
	resp, err := h.TerminalService.ProcessPayment(req.Amount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Terminal communication failed", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}
