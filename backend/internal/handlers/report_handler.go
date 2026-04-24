package handlers

import (
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

const dailySummaryDateLayout = "2006-01-02"

type ReportHandler struct{}

func NewReportHandler() *ReportHandler {
	return &ReportHandler{}
}

type AdvisorPerformance struct {
	AdvisorName string `json:"advisor_name"`
	TiresSold   int    `json:"tires_sold"`
}

type CategorySale struct {
	Category   string  `json:"category"`
	TotalSales float64 `json:"total_sales"`
}

type PaymentSummary struct {
	Method string  `json:"method"`
	Total  float64 `json:"total"`
}

type DailySummaryResponse struct {
	Date               string               `json:"date"`
	AdvisorPerformance []AdvisorPerformance `json:"advisor_performance"`
	CategorySales      []CategorySale       `json:"category_sales"`
	PaymentSummary     []PaymentSummary     `json:"payment_summary"`
	AccountReceivables float64              `json:"account_receivables"`
	TotalSales         float64              `json:"total_sales"`
}

func resolveDailySummaryDate(dateStr string) string {
	if dateStr == "" {
		return time.Now().Format(dailySummaryDateLayout)
	}

	if _, err := time.Parse(dailySummaryDateLayout, dateStr); err != nil {
		return time.Now().Format(dailySummaryDateLayout)
	}

	return dateStr
}

func nextDailySummaryDate(dateStr string) string {
	parsedDate, err := time.Parse(dailySummaryDateLayout, dateStr)
	if err != nil {
		return time.Now().Add(24 * time.Hour).Format(dailySummaryDateLayout)
	}

	return parsedDate.Add(24 * time.Hour).Format(dailySummaryDateLayout)
}

func (h *ReportHandler) GetDailySummary(c *gin.Context) {
	dateStr := resolveDailySummaryDate(c.Query("date"))
	startOfDay := dateStr + " 00:00:00"
	endOfDay := nextDailySummaryDate(dateStr) + " 00:00:00"
	branchID, _ := GetUintFromContext(c, "branchID")
	userRole, _ := GetStringFromContext(c, "userRole")
	branchScope := newDashboardBranchScope(branchID)

	if userRole == "super_admin" {
		branchQuery := c.Query("branch_id")
		if branchQuery == "ALL" {
			branchID = 0
		} else if branchQuery != "" {
			if parsedBranchID, err := strconv.ParseUint(branchQuery, 10, 64); err == nil {
				if parsedBranchID > 0 {
					branchID = uint(parsedBranchID)
				}
			}
		}
		branchScope = newDashboardBranchScope(branchID)
	}

	advisors := make([]AdvisorPerformance, 0)
	branchScope.apply(database.DB.Table("orders"), branchScope.orderJoinBranchColumn()).
		Select("COALESCE(NULLIF(TRIM(orders.service_advisor_name), ''), 'Unassigned') as advisor_name, SUM(order_items.quantity) as tires_sold").
		Joins("JOIN order_items ON orders.id = order_items.order_id").
		Joins("JOIN products ON order_items.product_id = products.id").
		Joins("JOIN categories ON products.category_id = categories.id").
		Where("orders.status = 'completed' AND (categories.name LIKE '%TIRE%' OR categories.name LIKE '%MAGS%')").
		Where("orders.created_at >= ? AND orders.created_at < ?", startOfDay, endOfDay).
		Group("COALESCE(NULLIF(TRIM(orders.service_advisor_name), ''), 'Unassigned')").
		Order("tires_sold DESC").
		Scan(&advisors)

	categories := make([]CategorySale, 0)
	branchScope.apply(database.DB.Table("order_items"), branchScope.orderJoinBranchColumn()).
		Select("COALESCE(categories.name, 'Uncategorized') as category, SUM(order_items.subtotal) as total_sales").
		Joins("JOIN products ON order_items.product_id = products.id").
		Joins("LEFT JOIN categories ON products.category_id = categories.id").
		Joins("JOIN orders ON order_items.order_id = orders.id").
		Where("orders.status = 'completed'").
		Where("orders.created_at >= ? AND orders.created_at < ?", startOfDay, endOfDay).
		Group("categories.name").
		Order("total_sales DESC").
		Scan(&categories)

	payments := make([]PaymentSummary, 0)
	branchScope.apply(database.DB.Model(&models.Order{}), branchScope.directBranchColumn()).
		Select("payment_method as method, COALESCE(SUM(amount_paid), 0) as total").
		Where("status = 'completed'").
		Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).
		Group("payment_method").
		Scan(&payments)

	var ar float64
	branchScope.apply(database.DB.Model(&models.Order{}), branchScope.directBranchColumn()).
		Select("COALESCE(SUM(balance_due), 0)").
		Where("balance_due > 0 AND status = 'completed'").
		Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).
		Scan(&ar)

	var totalSales float64
	branchScope.apply(database.DB.Model(&models.Order{}), branchScope.directBranchColumn()).
		Select("COALESCE(SUM(total_amount), 0)").
		Where("status = 'completed'").
		Where("created_at >= ? AND created_at < ?", startOfDay, endOfDay).
		Scan(&totalSales)

	c.JSON(http.StatusOK, DailySummaryResponse{
		Date:               dateStr,
		AdvisorPerformance: advisors,
		CategorySales:      categories,
		PaymentSummary:     payments,
		AccountReceivables: ar,
		TotalSales:         totalSales,
	})
}
