package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type ImportHandler struct{}

func NewImportHandler() *ImportHandler {
	return &ImportHandler{}
}

func (h *ImportHandler) ImportProducts(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	openedFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer openedFile.Close()

	reader := csv.NewReader(openedFile)
	records, err := reader.ReadAll()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse CSV"})
		return
	}

	if len(records) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "CSV is empty or missing header"})
		return
	}

		var createdCount int
	var errorMessages []string

	for i, record := range records {
		if i == 0 {
			continue
		}

		if len(record) < 6 {
			errorMessages = append(errorMessages, fmt.Sprintf("Line %d: insufficient columns", i+1))
			continue
		}

		name := record[0]
		desc := record[1]
		price, _ := strconv.ParseFloat(record[2], 64)
		stock, _ := strconv.Atoi(record[3])
		categoryName := strings.TrimSpace(record[4])
		brandName := strings.TrimSpace(record[5])
		size := ""
		if len(record) > 6 {
			size = record[6]
		}

		var category models.Category
		if err := database.DB.Where("name = ?", categoryName).FirstOrCreate(&category, models.Category{Name: categoryName}).Error; err != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("Line %d: failed to resolve category", i+1))
			continue
		}

		var brand models.Brand
		if err := database.DB.Where("name = ?", brandName).FirstOrCreate(&brand, models.Brand{Name: brandName}).Error; err != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("Line %d: failed to resolve brand", i+1))
			continue
		}

		product := models.Product{
			Name:        name,
			Description: desc,
			Price:       price,
			Stock:       stock,
			CategoryID:  category.ID,
			BrandID:     brand.ID,
			Size:        size,
		}

		if err := database.DB.Create(&product).Error; err != nil {
			errorMessages = append(errorMessages, fmt.Sprintf("Line %d: failed to create product", i+1))
			continue
		}

		createdCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Successfully imported %d products", createdCount),
		"errors":  errorMessages,
		"count":   createdCount,
		"failed":  len(errorMessages),
	})
}
