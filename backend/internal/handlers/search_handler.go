package handlers

import (
	"fmt"
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/gin-gonic/gin"
)

type SearchHandler struct{}

func NewSearchHandler() *SearchHandler {
	return &SearchHandler{}
}

type SearchResult struct {
	Type     string      `json:"type"`
	ID       uint        `json:"id"`
	Title    string      `json:"title"`
	Subtitle string      `json:"subtitle"`
	Data     interface{} `json:"data"`
}

func (h *SearchHandler) GlobalSearch(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusOK, gin.H{"results": []SearchResult{}})
		return
	}

	var results []SearchResult
	branchIDVal, _ := c.Get("branchID")
	var branchID uint
	if branchIDVal != nil {
		branchID = branchIDVal.(uint)
	}

	
	var products []models.Product
	database.DB.Where("name LIKE ? AND deleted_at IS NULL", "%"+query+"%").Limit(5).Find(&products)
	for _, p := range products {
		results = append(results, SearchResult{
			Type:     "product",
			ID:       p.ID,
			Title:    p.Name,
			Subtitle: p.Size,
			Data:     p,
		})
	}

	
	var customers []models.Customer
	database.DB.Where("(name LIKE ? OR phone LIKE ?) AND deleted_at IS NULL", "%"+query+"%", "%"+query+"%").Limit(5).Find(&customers)
	for _, cust := range customers {
		results = append(results, SearchResult{
			Type:     "customer",
			ID:       cust.ID,
			Title:    cust.Name,
			Subtitle: cust.Phone,
			Data:     cust,
		})
	}

	
	var orders []models.Order
	orderQuery := database.DB.Where("id = ? OR guest_name LIKE ?", query, "%"+query+"%")
	if branchID != 0 {
		orderQuery = orderQuery.Where("branch_id = ?", branchID)
	}
	orderQuery.Limit(5).Find(&orders)
	for _, o := range orders {
		results = append(results, SearchResult{
			Type:     "order",
			ID:       o.ID,
			Title:    fmt.Sprintf("Order #%d", o.ID),
			Subtitle: o.CreatedAt.Format("2006-01-02"),
			Data:     o,
		})
	}

	c.JSON(http.StatusOK, gin.H{"results": results})
}
