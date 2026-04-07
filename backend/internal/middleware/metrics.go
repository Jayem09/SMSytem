package middleware

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type Metrics struct {
	mu              sync.RWMutex
	requests        []RequestMetric
	errors          int
	totalRequests   int
	startTime       time.Time
	minResponseTime float64
	maxResponseTime float64
}

type RequestMetric struct {
	Path      string
	Method    string
	Status    int
	Duration  time.Duration
	Timestamp time.Time
}

var globalMetrics = &Metrics{
	startTime:       time.Now(),
	minResponseTime: math.MaxFloat64,
	requests:        make([]RequestMetric, 0),
}

func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		status := c.Writer.Status()

		metric := RequestMetric{
			Path:      c.FullPath(),
			Method:    c.Request.Method,
			Status:    status,
			Duration:  duration,
			Timestamp: time.Now(),
		}

		globalMetrics.RecordRequest(metric, status >= 400)
	}
}

func (m *Metrics) RecordRequest(req RequestMetric, isError bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.totalRequests++
	if isError {
		m.errors++
	}

	// Keep last 1000 requests
	m.requests = append(m.requests, req)
	if len(m.requests) > 1000 {
		m.requests = m.requests[1:]
	}

	// Update min/max
	if req.Duration.Seconds() < m.minResponseTime {
		m.minResponseTime = req.Duration.Seconds() * 1000
	}
	if req.Duration.Seconds() > m.maxResponseTime {
		m.maxResponseTime = req.Duration.Seconds() * 1000
	}
}

type MetricsSnapshot struct {
	TotalRequests  int            `json:"total_requests"`
	ErrorCount     int            `json:"error_count"`
	ErrorRate      float64        `json:"error_rate"`
	Uptime         string         `json:"uptime"`
	RequestsPerMin float64        `json:"requests_per_min"`
	AvgResponseMs  float64        `json:"avg_response_ms"`
	P50ResponseMs  float64        `json:"p50_response_ms"`
	P95ResponseMs  float64        `json:"p95_response_ms"`
	P99ResponseMs  float64        `json:"p99_response_ms"`
	MinResponseMs  float64        `json:"min_response_ms"`
	MaxResponseMs  float64        `json:"max_response_ms"`
	StatusCodes    map[string]int `json:"status_codes"`
}

func (m *Metrics) GetSnapshot() MetricsSnapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var totalDuration float64
	durations := make([]float64, len(m.requests))
	statusCodes := make(map[string]int)

	for i, req := range m.requests {
		ms := req.Duration.Seconds() * 1000
		durations[i] = ms
		totalDuration += ms
		statusCodes[getStatusCategory(req.Status)]++
	}

	var avg, p50, p95, p99 float64
	if len(durations) > 0 {
		avg = totalDuration / float64(len(durations))

		// Sort for percentiles
		sorted := make([]float64, len(durations))
		copy(sorted, durations)
		for i := 0; i < len(sorted)-1; i++ {
			for j := i + 1; j < len(sorted); j++ {
				if sorted[i] > sorted[j] {
					sorted[i], sorted[j] = sorted[j], sorted[i]
				}
			}
		}

		p50 = sorted[len(sorted)/2]
		p95 = sorted[int(float64(len(sorted))*0.95)]
		p99 = sorted[int(float64(len(sorted))*0.99)]
	}

	// Calculate requests per minute
	uptimeMinutes := time.Since(m.startTime).Minutes()
	var rpm float64
	if uptimeMinutes > 0 {
		rpm = float64(m.totalRequests) / uptimeMinutes
	}

	uptime := time.Since(m.startTime)
	uptimeStr := uptime.Round(time.Second).String()
	if uptime.Hours() >= 24 {
		uptimeStr = fmt.Sprintf("%dd %s", int(uptime.Hours()/24), (uptime % (24 * time.Hour)).Round(time.Second).String())
	}

	minMs := m.minResponseTime
	if minMs == math.MaxFloat64 {
		minMs = 0
	}

	return MetricsSnapshot{
		TotalRequests:  m.totalRequests,
		ErrorCount:     m.errors,
		ErrorRate:      float64(m.errors) / float64(m.totalRequests) * 100,
		Uptime:         uptimeStr,
		RequestsPerMin: math.Round(rpm*10) / 10,
		AvgResponseMs:  math.Round(avg*10) / 10,
		P50ResponseMs:  math.Round(p50*10) / 10,
		P95ResponseMs:  math.Round(p95*10) / 10,
		P99ResponseMs:  math.Round(p99*10) / 10,
		MinResponseMs:  math.Round(minMs*10) / 10,
		MaxResponseMs:  math.Round(m.maxResponseTime*10) / 10,
		StatusCodes:    statusCodes,
	}
}

func getStatusCategory(status int) string {
	switch {
	case status >= 500:
		return "5xx"
	case status >= 400:
		return "4xx"
	case status >= 300:
		return "3xx"
	case status >= 200:
		return "2xx"
	default:
		return "other"
	}
}

func GetGlobalMetrics() *Metrics {
	return globalMetrics
}

// ResetMetrics resets all metrics (for testing)
func ResetMetrics() {
	globalMetrics = &Metrics{
		startTime:       time.Now(),
		minResponseTime: math.MaxFloat64,
		requests:        make([]RequestMetric, 0),
	}
}
