package handlers

import (
	"net/http"
	"strings"
	"time"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
)

const transactionDateLayout = "2006-01-02"

type TransactionHandler struct{}

func NewTransactionHandler() *TransactionHandler {
	return &TransactionHandler{}
}

type TransactionRow struct {
	Date               string  `json:"date"`
	OrderID            uint    `json:"order_id"`
	ReceiptType        string  `json:"receipt_type"`
	BranchName         string  `json:"branch_name"`
	CustomerName       string  `json:"customer_name"`
	ServiceAdvisorName string  `json:"service_advisor_name"`
	ItemName           string  `json:"item_name"`
	UnitOfMeasure      string  `json:"unit_of_measure"`
	CategoryName       string  `json:"category_name"`
	Quantity           int     `json:"quantity"`
	UnitPrice          float64 `json:"unit_price"`
	Subtotal           float64 `json:"subtotal"`
	PaymentMethod      string  `json:"payment_method"`
	OrderStatus        string  `json:"order_status"`
}

func resolveTransactionDate(dateStr string) (time.Time, error) {
	return time.Parse(transactionDateLayout, dateStr)
}

func (h *TransactionHandler) List(c *gin.Context) {
	branchID, _ := GetUintFromContext(c, "branchID")
	userRole, _ := GetStringFromContext(c, "userRole")

	startStr := strings.TrimSpace(c.Query("start_date"))
	endStr := strings.TrimSpace(c.Query("end_date"))
	search := strings.TrimSpace(c.Query("search"))

	now := time.Now()
	startDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endDate := startDate.Add(24 * time.Hour)

	if startStr != "" {
		if parsed, err := resolveTransactionDate(startStr); err == nil {
			startDate = parsed
		}
	}
	if endStr != "" {
		if parsed, err := resolveTransactionDate(endStr); err == nil {
			// Include the full end day
			endDate = parsed.Add(24 * time.Hour)
		}
	}

	db := database.DB.Model(&models.Order{}).
		Select(`
			orders.created_at,
			orders.id,
			orders.receipt_type,
			branches.name        AS branch_name,
			COALESCE(customers.name, orders.guest_name, 'Walk-in') AS customer_name,
			COALESCE(orders.service_advisor_name, '')              AS service_advisor_name,
			products.name                                          AS item_name,
			COALESCE(products.size, 'pc')                         AS unit_of_measure,
			COALESCE(categories.name, '')                         AS category_name,
			order_items.quantity,
			order_items.unit_price,
			order_items.subtotal,
			orders.payment_method,
			orders.status                                          AS order_status
		`).
		Joins("JOIN order_items ON order_items.order_id = orders.id").
		Joins("JOIN products ON products.id = order_items.product_id").
		Joins("LEFT JOIN branches ON branches.id = orders.branch_id").
		Joins("LEFT JOIN customers ON customers.id = orders.customer_id").
		Joins("LEFT JOIN categories ON categories.id = products.category_id").
		Where("orders.created_at >= ? AND orders.created_at < ?", startDate, endDate).
		Where("orders.status != ?", "cancelled")

	// Scope to branch unless super_admin requesting all
	if userRole != "super_admin" && branchID > 0 {
		db = db.Where("orders.branch_id = ?", branchID)
	} else if userRole == "super_admin" {
		branchQuery := c.Query("branch_id")
		if branchQuery != "" && branchQuery != "ALL" {
			db = db.Where("orders.branch_id = ?", branchQuery)
		}
	}

	if search != "" {
		like := "%" + search + "%"
		db = db.Where(
			"COALESCE(customers.name, orders.guest_name, '') LIKE ? OR products.name LIKE ? OR orders.service_advisor_name LIKE ?",
			like, like, like,
		)
	}

	type rawRow struct {
		CreatedAt          time.Time `gorm:"column:created_at"`
		ID                 uint      `gorm:"column:id"`
		ReceiptType        string    `gorm:"column:receipt_type"`
		BranchName         string    `gorm:"column:branch_name"`
		CustomerName       string    `gorm:"column:customer_name"`
		ServiceAdvisorName string    `gorm:"column:service_advisor_name"`
		ItemName           string    `gorm:"column:item_name"`
		UnitOfMeasure      string    `gorm:"column:unit_of_measure"`
		CategoryName       string    `gorm:"column:category_name"`
		Quantity           int       `gorm:"column:quantity"`
		UnitPrice          float64   `gorm:"column:unit_price"`
		Subtotal           float64   `gorm:"column:subtotal"`
		PaymentMethod      string    `gorm:"column:payment_method"`
		OrderStatus        string    `gorm:"column:order_status"`
	}

	var rows []rawRow
	if err := db.Order("orders.created_at DESC, orders.id DESC").Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	result := make([]TransactionRow, 0, len(rows))
	for _, r := range rows {
		result = append(result, TransactionRow{
			Date:               r.CreatedAt.Format("2006-01-02"),
			OrderID:            r.ID,
			ReceiptType:        r.ReceiptType,
			BranchName:         r.BranchName,
			CustomerName:       r.CustomerName,
			ServiceAdvisorName: r.ServiceAdvisorName,
			ItemName:           r.ItemName,
			UnitOfMeasure:      r.UnitOfMeasure,
			CategoryName:       r.CategoryName,
			Quantity:           r.Quantity,
			UnitPrice:          r.UnitPrice,
			Subtotal:           r.Subtotal,
			PaymentMethod:      r.PaymentMethod,
			OrderStatus:        r.OrderStatus,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"transactions": result,
		"count":        len(result),
	})
}
