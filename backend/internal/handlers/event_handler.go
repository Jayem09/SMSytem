package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type EventHandler struct {
	cfg *config.Config
}

func NewEventHandler(cfg *config.Config) *EventHandler {
	return &EventHandler{cfg: cfg}
}

// Stream SSE events to the browser.
// GET /api/events?branch_id=N&token=<jwt>
// EventSource cannot send Authorization headers, so we accept the token
// via query param and verify it here directly.
func (h *EventHandler) Stream(c *gin.Context) {
	// Verify JWT from query param (EventSource workaround)
	tokenStr := c.Query("token")
	if tokenStr == "" {
		// Fallback: try Authorization header (for curl/testing)
		auth := c.GetHeader("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			tokenStr = strings.TrimPrefix(auth, "Bearer ")
		}
	}

	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(h.cfg.JWTSecret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Get branch filter (0 = all branches)
	var branchID uint
	if bid := c.Query("branch_id"); bid != "" {
		if parsed, err := strconv.ParseUint(bid, 10, 64); err == nil {
			branchID = uint(parsed)
		}
	}

	// Register client with broadcaster
	broadcaster := services.GetBroadcaster()
	if broadcaster == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Event service unavailable"})
		return
	}
	client := broadcaster.Register(branchID)
	defer broadcaster.Unregister(client)

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("X-Accel-Buffering", "no")

	// Send initial ping
	c.SSEvent("ping", map[string]interface{}{
		"client_id": client.ID,
		"connected": true,
		"ts":        time.Now().Unix(),
	})
	c.Writer.Flush()

	// Heartbeat ticker (send ping every 25s to keep connection alive)
	heartbeat := time.NewTicker(25 * time.Second)
	defer heartbeat.Stop()

	// Client disconnect channel
	clientGone := c.Request.Context().Done()

	for {
		select {
		case <-clientGone:
			return
		case <-heartbeat.C:
			c.SSEvent("ping", map[string]interface{}{"ts": time.Now().Unix()})
			c.Writer.Flush()
		case event, ok := <-client.Channel:
			if !ok {
				return
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			if _, err := c.Writer.Write([]byte("data: ")); err != nil {
				return
			}
			if _, err := c.Writer.Write(data); err != nil {
				return
			}
			if _, err := c.Writer.Write([]byte("\n\n")); err != nil {
				return
			}
			c.Writer.Flush()
		}
	}
}
