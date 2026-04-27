package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"smsystem-backend/internal/database"
	"time"

	"github.com/gin-gonic/gin"
)

const offtakeDateLayout = "2006-01-02"

var offtakeNow = time.Now

type OfftakeReportRow struct {
	OrderID        uint    `json:"order_id"`
	InvoiceNo      string  `json:"invoice_no"`
	InvoiceDate    string  `json:"invoice_date"`
	CustomerName   string  `json:"customer_name"`
	BranchName     string  `json:"branch_name"`
	ServiceAdvisor string  `json:"service_advisor"`
	PaymentStatus  string  `json:"payment_status"`
	TotalAmount    float64 `json:"total_amount"`
	AmountPaid     float64 `json:"amount_paid"`
	BalanceDue     float64 `json:"balance_due"`
	ItemSummary    string  `json:"item_summary"`
	QuantityTotal  int     `json:"quantity_total"`
}

type offtakeItemPart struct {
	Name     string
	Quantity int
}

type offtakeRawRow struct {
	OrderID        uint      `gorm:"column:order_id"`
	ReceiptType    string    `gorm:"column:receipt_type"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	CustomerName   string    `gorm:"column:customer_name"`
	BranchName     string    `gorm:"column:branch_name"`
	ServiceAdvisor string    `gorm:"column:service_advisor"`
	PaymentStatus  string    `gorm:"column:payment_status"`
	TotalAmount    float64   `gorm:"column:total_amount"`
	AmountPaid     float64   `gorm:"column:amount_paid"`
	BalanceDue     float64   `gorm:"column:balance_due"`
	QuantityTotal  int       `gorm:"column:quantity_total"`
	ItemSummary    string    `gorm:"column:item_summary"`
}

func resolveOfftakeDateRange(startStr, endStr string, loc *time.Location) (time.Time, time.Time) {
	if loc == nil {
		loc = time.Local
	}

	now := offtakeNow().In(loc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	end := start.Add(24 * time.Hour)

	if parsedStart, err := time.ParseInLocation(offtakeDateLayout, strings.TrimSpace(startStr), loc); err == nil {
		start = parsedStart
	}

	if parsedEnd, err := time.ParseInLocation(offtakeDateLayout, strings.TrimSpace(endStr), loc); err == nil {
		end = parsedEnd.Add(24 * time.Hour)
	}

	if !end.After(start) {
		end = start.Add(24 * time.Hour)
	}

	return start, end
}

func normalizeOfftakeBranchID(userRole string, contextBranchID uint, branchQuery string) uint {
	if userRole != "super_admin" {
		return contextBranchID
	}

	trimmed := strings.TrimSpace(branchQuery)
	if trimmed == "" || strings.EqualFold(trimmed, "ALL") {
		return 0
	}

	parsed, err := strconv.ParseUint(trimmed, 10, 64)
	if err != nil {
		return contextBranchID
	}

	return uint(parsed)
}

func buildOfftakeInvoiceLabel(receiptType string, orderID uint) string {
	receipt := strings.TrimSpace(receiptType)
	if receipt == "" {
		receipt = "SI"
	}

	return fmt.Sprintf("%s-%05d", receipt, orderID)
}

func buildOfftakeItemSummary(parts []offtakeItemPart) string {
	fragments := make([]string, 0, len(parts))
	for _, part := range parts {
		name := strings.TrimSpace(part.Name)
		if name == "" {
			continue
		}

		fragments = append(fragments, fmt.Sprintf("%s x%d", name, part.Quantity))
	}

	return strings.Join(fragments, ", ")
}

func buildOfftakeRows(raw []offtakeRawRow) []OfftakeReportRow {
	rows := make([]OfftakeReportRow, 0, len(raw))
	for _, row := range raw {
		rows = append(rows, OfftakeReportRow{
			OrderID:        row.OrderID,
			InvoiceNo:      buildOfftakeInvoiceLabel(row.ReceiptType, row.OrderID),
			InvoiceDate:    row.CreatedAt.Format(offtakeDateLayout),
			CustomerName:   row.CustomerName,
			BranchName:     row.BranchName,
			ServiceAdvisor: row.ServiceAdvisor,
			PaymentStatus:  row.PaymentStatus,
			TotalAmount:    row.TotalAmount,
			AmountPaid:     row.AmountPaid,
			BalanceDue:     row.BalanceDue,
			ItemSummary:    row.ItemSummary,
			QuantityTotal:  row.QuantityTotal,
		})
	}

	return rows
}

func (h *ReportHandler) GetOfftake(c *gin.Context) {
	branchID, _ := GetUintFromContext(c, "branchID")
	userRole, _ := GetStringFromContext(c, "userRole")
	startDate, endDate := resolveOfftakeDateRange(c.Query("start_date"), c.Query("end_date"), time.Local)
	branchScope := newDashboardBranchScope(normalizeOfftakeBranchID(userRole, branchID, c.Query("branch_id")))

	query := database.DB.Table("orders").
		Select(`
			orders.id AS order_id,
			orders.receipt_type,
			orders.created_at,
			COALESCE(customers.name, orders.guest_name, 'Walk-in') AS customer_name,
			COALESCE(branches.name, '') AS branch_name,
			COALESCE(NULLIF(TRIM(orders.service_advisor_name), ''), 'Unassigned') AS service_advisor,
			orders.payment_status,
			orders.total_amount,
			orders.amount_paid,
			orders.balance_due,
			COALESCE(SUM(order_items.quantity), 0) AS quantity_total,
			COALESCE(GROUP_CONCAT(CONCAT(products.name, ' x', order_items.quantity) ORDER BY order_items.id SEPARATOR ', '), '') AS item_summary
		`).
		Joins("JOIN order_items ON order_items.order_id = orders.id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Joins("LEFT JOIN customers ON customers.id = orders.customer_id").
		Joins("LEFT JOIN branches ON branches.id = orders.branch_id").
		Where("orders.created_at >= ? AND orders.created_at < ?", startDate, endDate).
		Where("orders.status != ?", "cancelled")

	query = branchScope.apply(query, branchScope.orderJoinBranchColumn())

	if customerID := strings.TrimSpace(c.Query("customer_id")); customerID != "" {
		query = query.Where("orders.customer_id = ?", customerID)
	} else if customer := strings.TrimSpace(c.Query("customer")); customer != "" {
		query = query.Where("COALESCE(customers.name, orders.guest_name, '') LIKE ?", "%"+customer+"%")
	}

	if invoiceNo := strings.TrimSpace(c.Query("invoice_no")); invoiceNo != "" {
		query = query.Where("CONCAT(COALESCE(NULLIF(TRIM(orders.receipt_type), ''), 'SI'), '-', LPAD(orders.id, 5, '0')) LIKE ?", "%"+invoiceNo+"%")
	}

	if itemName := strings.TrimSpace(c.Query("item_name")); itemName != "" {
		query = query.Where("products.name LIKE ?", "%"+itemName+"%")
	}

	if paymentStatus := strings.TrimSpace(c.Query("payment_status")); paymentStatus != "" && !strings.EqualFold(paymentStatus, "all") {
		query = query.Where("orders.payment_status = ?", paymentStatus)
	}

	if serviceAdvisor := strings.TrimSpace(c.Query("service_advisor")); serviceAdvisor != "" {
		query = query.Where("orders.service_advisor_name LIKE ?", "%"+serviceAdvisor+"%")
	}

	query = query.Group(`
		orders.id,
		orders.receipt_type,
		orders.created_at,
		customers.name,
		orders.guest_name,
		branches.name,
		orders.service_advisor_name,
		orders.payment_status,
		orders.total_amount,
		orders.amount_paid,
		orders.balance_due
	`)

	var raw []offtakeRawRow
	if err := query.Order("orders.created_at DESC, orders.id DESC").Scan(&raw).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch offtake report"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"rows":  buildOfftakeRows(raw),
		"total": len(raw),
	})
}
