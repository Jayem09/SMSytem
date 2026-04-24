package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/middleware"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type SystemHandler struct {
	BackupService *services.BackupService
	CacheService  *services.CacheService
}

func NewSystemHandler(backupSvc *services.BackupService, cacheSvc *services.CacheService) *SystemHandler {
	return &SystemHandler{BackupService: backupSvc, CacheService: cacheSvc}
}

type SystemMetrics struct {
	Uptime            string  `json:"uptime"`
	CPUUsage          float64 `json:"cpu_usage"`
	MemoryUsage       float64 `json:"memory_usage"`
	MemoryTotal       float64 `json:"memory_total"`
	DiskUsage         float64 `json:"disk_usage"`
	DiskTotal         float64 `json:"disk_total"`
	DBConnections     int     `json:"db_connections"`
	DBMaxConnections  int     `json:"db_max_connections"`
	APIRequestsPerMin int     `json:"api_requests_per_min"`
	APIAvgResponseMs  int     `json:"api_avg_response_ms"`
	APIErrorRate      float64 `json:"api_error_rate"`
	OrdersToday       int     `json:"orders_today"`
	OrdersTotal       int     `json:"orders_total"`
	ActiveSessions    int     `json:"active_sessions"`
	LastBackup        string  `json:"last_backup"`
	Status            string  `json:"status"`
}

// statusCacheResult holds the cached system status response
type statusCacheResult struct {
	Maintenance bool   `json:"maintenance"`
	MinVersion  string `json:"min_version"`
	Message    string `json:"message"`
}

func (h *SystemHandler) GetStatus(c *gin.Context) {
	ctx := c.Request.Context()
	cacheKey := services.SystemStatusKey()

	// Try cache first (read-through pattern)
	if h.CacheService != nil && h.CacheService.Enabled() {
		var cached statusCacheResult
		found, err := h.CacheService.GetJSON(ctx, cacheKey, &cached)
		if err == nil && found {
			// Cache hit - return immediately
			c.JSON(http.StatusOK, gin.H{
				"maintenance": cached.Maintenance,
				"min_version": cached.MinVersion,
				"message":    cached.Message,
			})
			return
		}
	}

	// Cache miss - run existing DB logic
	var maintenanceMode models.Setting
	var minAppVersion models.Setting

	database.DB.Where("`key` = ?", "maintenance_mode").First(&maintenanceMode)
	database.DB.Where("`key` = ?", "min_app_version").First(&minAppVersion)

	isMaintenance := maintenanceMode.Value == "true"
	minVersion := minAppVersion.Value
	if minVersion == "" {
		minVersion = "0.0.0"
	}

	result := statusCacheResult{
		Maintenance: isMaintenance,
		MinVersion:  minVersion,
		Message:    "System status retrieved successfully",
	}

	// Cache result with 20s TTL (matches spec TTL range for system status)
	if h.CacheService != nil && h.CacheService.Enabled() {
		if err := h.CacheService.SetJSON(ctx, cacheKey, result, 20*time.Second); err != nil {
			log.Printf("Warning: failed to cache system status: %v", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"maintenance": isMaintenance,
		"min_version": minVersion,
		"message":     "System status retrieved successfully",
	})
}

func (h *SystemHandler) GetMetrics(c *gin.Context) {
	apiMetrics := middleware.GetGlobalMetrics().GetSnapshot()

	metrics := SystemMetrics{
		Uptime:            getUptime(),
		CPUUsage:          getCPUUsage(),
		MemoryUsage:       getMemoryUsage(),
		MemoryTotal:       getMemoryTotal(),
		DiskUsage:         getDiskUsage(),
		DiskTotal:         getDiskTotal(),
		DBConnections:     getDBConnections(),
		DBMaxConnections:  100,
		APIRequestsPerMin: int(apiMetrics.RequestsPerMin),
		APIAvgResponseMs:  int(apiMetrics.AvgResponseMs),
		APIErrorRate:      apiMetrics.ErrorRate,
		OrdersToday:       getOrdersToday(),
		OrdersTotal:       getOrdersTotal(),
		ActiveSessions:    0,
		LastBackup:        getLastBackup(),
		Status:            determineStatus(getCPUUsage(), getMemoryUsage(), getDiskUsage(), float64(getDBConnections())),
	}

	c.JSON(http.StatusOK, gin.H{"metrics": metrics, "api_metrics": apiMetrics})
}

func (h *SystemHandler) GetBackups(c *gin.Context) {
	var backups []models.Backup
	database.DB.Order("created_at DESC").Limit(50).Find(&backups)

	if backups == nil {
		backups = []models.Backup{}
	}

	c.JSON(http.StatusOK, gin.H{"backups": backups})
}

func (h *SystemHandler) CreateBackup(c *gin.Context) {
	if h.BackupService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Backup service is not configured"})
		return
	}

	backup, err := h.BackupService.CreateBackup()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Backup failed: %v", err)})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Backup created successfully", "backup": backup})
}

func (h *SystemHandler) RestoreBackup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}
	if h.BackupService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Backup service is not configured"})
		return
	}

	if err := h.BackupService.RestoreBackup(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Restore failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup restored successfully"})
}

func (h *SystemHandler) DeleteBackup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}
	if h.BackupService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Backup service is not configured"})
		return
	}

	if err := h.BackupService.DeleteBackup(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Delete failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Backup deleted"})
}

func (h *SystemHandler) DownloadBackup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup ID"})
		return
	}
	if h.BackupService == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Backup service is not configured"})
		return
	}

	backup, err := h.BackupService.GetBackup(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Backup not found"})
		return
	}

	backupPath := h.BackupService.GetBackupPath() + "/" + backup.Filename
	c.FileAttachment(backupPath, backup.Filename)
}

func getUptime() string {
	if runtime.GOOS == "linux" {
		cmd := exec.Command("uptime", "-p")
		out, _ := cmd.Output()
		if len(out) > 0 {
			return string(out[:len(out)-1])
		}
	}
	return "Unknown"
}

func getCPUUsage() float64 {
	// Get idle from field 8: %Cpu(s):  x us,  x sy,  x ni, 81.8 id, ...
	cmd := exec.Command("sh", "-c", "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}'")
	out, err := cmd.CombinedOutput()
	if err == nil && len(out) > 0 {
		trimmed := strings.TrimSpace(string(out))
		usage, err := strconv.ParseFloat(trimmed, 64)
		if err == nil {
			return usage
		}
	}
	return 0
}

func getMemoryUsage() float64 {
	// free -m: total used free shared buff/cache available
	// Calculate: (used / total) * 100
	cmd := exec.Command("sh", "-c", "free -m | grep Mem | awk '{if ($2 > 0) print ($3/$2) * 100; else print 0}'")
	out, err := cmd.CombinedOutput()
	if err == nil && len(out) > 0 {
		trimmed := strings.TrimSpace(string(out))
		usage, err := strconv.ParseFloat(trimmed, 64)
		if err == nil {
			return usage
		}
	}
	return 0
}

func getMemoryTotal() float64 {
	// free -m returns total in MB
	cmd := exec.Command("sh", "-c", "free -m | grep Mem | awk '{print $2}'")
	out, _ := cmd.Output()
	if len(out) > 0 {
		total, _ := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
		return total / 1024 // Convert MB to GB
	}
	return 0
}

func getDiskUsage() float64 {
	cmd := exec.Command("sh", "-c", "df -h / | tail -1 | awk '{print $5}' | sed 's/%//'")
	out, _ := cmd.Output()
	if len(out) > 0 {
		usage, _ := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
		return usage
	}
	return 0
}

func getDiskTotal() float64 {
	cmd := exec.Command("sh", "-c", "df -h / | tail -1 | awk '{print $2}'")
	out, _ := cmd.Output()
	if len(out) > 0 {
		output := strings.TrimSpace(string(out))
		var total float64
		for i, c := range output {
			if c >= '0' && c <= '9' {
				num := string(output[i:])
				for j := range num {
					if num[j] < '0' || num[j] > '9' {
						num = num[:j]
						break
					}
				}
				total, _ = strconv.ParseFloat(num, 64)
				break
			}
		}
		return total
	}
	return 0
}

func getDBConnections() int {
	var count int64
	database.DB.Model(&models.User{}).Count(&count)
	return int(count)
}

func getOrdersToday() int {
	var count int64
	today := time.Now().Format("2006-01-02")
	database.DB.Model(&models.Order{}).Where("DATE(created_at) = ?", today).Count(&count)
	return int(count)
}

func getOrdersTotal() int {
	var count int64
	database.DB.Model(&models.Order{}).Count(&count)
	return int(count)
}

func getLastBackup() string {
	var backup models.Backup
	result := database.DB.Order("created_at DESC").First(&backup)
	if result.Error != nil || backup.ID == 0 {
		return "Never"
	}
	return backup.CreatedAt.Format("2006-01-02 15:04")
}

func determineStatus(cpu, mem, disk, dbConn float64) string {
	if cpu > 90 || mem > 95 || disk > 95 {
		return "critical"
	}
	if cpu > 70 || mem > 85 || disk > 80 || dbConn > 80 {
		return "warning"
	}
	return "healthy"
}
