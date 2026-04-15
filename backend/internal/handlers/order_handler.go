package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OrderHandler struct {
	LogService *services.LogService
}

func NewOrderHandler(logSvc *services.LogService) *OrderHandler {
	return &OrderHandler{LogService: logSvc}
}

type orderItemInput struct {
	ProductID uint `json:"product_id" binding:"required"`
	Quantity  int  `json:"quantity" binding:"required,min=1"`
}

type orderInput struct {
	CustomerID         *uint            `json:"customer_id"`
	GuestName          string           `json:"guest_name"`
	GuestPhone         string           `json:"guest_phone"`
	ServiceAdvisorName string           `json:"service_advisor_name"`
	PaymentMethod      string           `json:"payment_method" binding:"required"`
	DiscountAmount     float64          `json:"discount_amount"`
	DiscountType       string           `json:"discount_type"`
	TaxAmount          float64          `json:"tax_amount"`
	IsTaxInclusive     bool             `json:"is_tax_inclusive"`
	Items              []orderItemInput `json:"items" binding:"required,min=1,dive"`
}

type statusInput struct {
	Status string `json:"status" binding:"required,oneof=pending confirmed completed cancelled"`
}

type checkoutInput struct {
	orderInput
	Status             string  `json:"status" binding:"omitempty,oneof=pending completed"`
	ReceiptType        string  `json:"receipt_type" binding:"required,oneof=SI DR"`
	TIN                string  `json:"tin"`
	BusinessAddress    string  `json:"business_address"`
	WithholdingTaxRate float64 `json:"withholding_tax_rate"`
	RewardID           *uint   `json:"reward_id"`     // Product ID being redeemed as reward
	RewardPoints       int     `json:"reward_points"` // Points used for reward redemption
}

func (h *OrderHandler) List(c *gin.Context) {
	branchID, _ := GetUintFromContext(c, "branchID")

	var query *gorm.DB
	// super_admin (branchID=0) sees all orders, not just branch 0
	if branchID == 0 {
		query = database.DB.Preload("Customer").Preload("User").Preload("Items.Product")
	} else {
		query = database.DB.Where("branch_id = ?", branchID).Preload("Customer").Preload("User").Preload("Items.Product")
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	if customerID := c.Query("customer_id"); customerID != "" {
		query = query.Where("customer_id = ?", customerID)
	}

	var orders []models.Order
	if err := query.Order("created_at DESC").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func (h *OrderHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var order models.Order
	if err := database.DB.Preload("Customer").Preload("User").Preload("Items.Product").First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"order": order})
}

func (h *OrderHandler) Create(c *gin.Context) {
	var input checkoutInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	orderStatus := "completed"
	if input.Status != "" {
		orderStatus = input.Status
	}

	userIDValue, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	branchID, _ := GetUintFromContext(c, "branchID")
	userID, _ := GetUintFromContext(c, "userID")

	_ = userIDValue

	if input.CustomerID != nil && *input.CustomerID > 0 {
		var customer models.Customer
		if err := database.DB.First(&customer, *input.CustomerID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Customer not found"})
			return
		}
	}

	var order models.Order
	bID := branchID
	if bID == 0 {
		bID = 1
	}
	order.BranchID = bID
	uID := userID

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var totalAmount float64
		var orderItems []models.OrderItem

		for _, item := range input.Items {
			var product models.Product
			if err := tx.First(&product, item.ProductID).Error; err != nil {
				return errors.New("product ID " + strconv.Itoa(int(item.ProductID)) + " not found")
			}

			if orderStatus == "completed" && !product.IsService {
				var batches []models.Batch
				if err := tx.Model(&models.Batch{}).
					Where("product_id = ? AND branch_id = ? AND quantity > 0", product.ID, order.BranchID).
					Clauses(clause.Locking{Strength: "UPDATE"}).
					Order("expiry_date ASC, created_at ASC").
					Find(&batches).Error; err != nil {
					return fmt.Errorf("failed to lock batches: %v", err)
				}

				var currentStock int
				for _, b := range batches {
					currentStock += b.Quantity
				}

				if currentStock < item.Quantity {
					return errors.New("insufficient stock for " + product.Name + " (available: " + strconv.Itoa(currentStock) + ")")
				}
			}

			subtotal := product.Price * float64(item.Quantity)
			totalAmount += subtotal
			orderItems = append(orderItems, models.OrderItem{
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				UnitPrice: product.Price,
				Subtotal:  subtotal,
			})
		}

		finalTotal := totalAmount
		if input.DiscountType == "percentage" {
			finalTotal -= totalAmount * (input.DiscountAmount / 100)
		} else {
			finalTotal -= input.DiscountAmount
		}
		if !input.IsTaxInclusive {
			finalTotal += input.TaxAmount
		}

		order = models.Order{
			CustomerID:         input.CustomerID,
			GuestName:          input.GuestName,
			GuestPhone:         input.GuestPhone,
			UserID:             uID,
			ServiceAdvisorName: input.ServiceAdvisorName,
			TotalAmount:        finalTotal,
			DiscountAmount:     input.DiscountAmount,
			DiscountType:       input.DiscountType,
			TaxAmount:          input.TaxAmount,
			IsTaxInclusive:     input.IsTaxInclusive,
			Status:             orderStatus,
			PaymentMethod:      input.PaymentMethod,
			Items:              orderItems,
			ReceiptType:        input.ReceiptType,
			TIN:                input.TIN,
			BusinessAddress:    input.BusinessAddress,
			WithholdingTaxRate: input.WithholdingTaxRate,
			BranchID:           order.BranchID,
		}

		if err := tx.Create(&order).Error; err != nil {
			return fmt.Errorf("failed to create order: %v", err)
		}

		// Auto-create customer for walk-in guests
		if order.CustomerID == nil && input.GuestName != "" && input.GuestPhone != "" {
			// Check if customer with this phone already exists
			var existingCustomer models.Customer
			switch err := tx.Where("phone = ?", input.GuestPhone).First(&existingCustomer).Error; err {
			case nil:
				// Use existing customer
				order.CustomerID = &existingCustomer.ID
				if err := tx.Save(&order).Error; err != nil {
					fmt.Printf("Warning: failed to link order to existing customer: %v\n", err)
				}
			case gorm.ErrRecordNotFound:
				// Create new customer
				newCustomer := models.Customer{
					Name:  input.GuestName,
					Phone: input.GuestPhone,
				}
				if err := tx.Create(&newCustomer).Error; err == nil {
					order.CustomerID = &newCustomer.ID
					if err := tx.Save(&order).Error; err != nil {
						fmt.Printf("Warning: failed to link order to customer: %v\n", err)
					}
				}
			default:
				fmt.Printf("Warning: error checking for existing customer: %v\n", err)
			}
		}

		if orderStatus == "completed" {
			for _, item := range orderItems {
				var product models.Product
				if err := tx.First(&product, item.ProductID).Error; err != nil {
					return fmt.Errorf("product not found: %d", item.ProductID)
				}
				if product.IsService {
					continue
				}

				remainingToDeduct := item.Quantity
				var batches []models.Batch
				batchQuery := tx.Where("product_id = ? AND quantity > 0", product.ID)
				if order.BranchID != 0 {
					batchQuery = batchQuery.Where("branch_id = ?", order.BranchID)
				}

				if err := batchQuery.Order("expiry_date ASC, created_at ASC").Find(&batches).Error; err != nil {
					return fmt.Errorf("failed to find available batches for %s", product.Name)
				}

				for i := range batches {
					if remainingToDeduct <= 0 {
						break
					}
					deduct := remainingToDeduct
					if batches[i].Quantity < deduct {
						deduct = batches[i].Quantity
					}

					if err := tx.Model(&batches[i]).Update("quantity", batches[i].Quantity-deduct).Error; err != nil {
						return fmt.Errorf("failed to update batch quantity: %v", err)
					}

					movement := models.StockMovement{
						ProductID:   product.ID,
						BatchID:     &batches[i].ID,
						WarehouseID: batches[i].WarehouseID,
						BranchID:    batches[i].BranchID,
						UserID:      &uID,
						Type:        models.MovementTypeOut,
						Quantity:    -deduct,
						Reference:   fmt.Sprintf("POS Order #%d", order.ID),
					}
					if err := tx.Create(&movement).Error; err != nil {
						return fmt.Errorf("failed to create stock movement: %v", err)
					}
					remainingToDeduct -= deduct
				}

				if remainingToDeduct > 0 {
					return fmt.Errorf("insufficient batch stock for %s during final deduction", product.Name)
				}

				if err := tx.Model(&product).Update("stock", product.Stock-item.Quantity).Error; err != nil {
					return fmt.Errorf("failed to update product stock: %v", err)
				}
			}
		}

		// === LOYALTY POINTS SYSTEM ===
		// Handle reward redemption if customer provided a reward
		if input.CustomerID != nil && *input.CustomerID > 0 && input.RewardID != nil && *input.RewardID > 0 && input.RewardPoints > 0 {
			var customer models.Customer
			if err := tx.First(&customer, *input.CustomerID).Error; err != nil {
				return fmt.Errorf("customer not found: %v", err)
			}

			if customer.LoyaltyPoints < float64(input.RewardPoints) {
				return fmt.Errorf("insufficient loyalty points: have %.2f, need %d", customer.LoyaltyPoints, input.RewardPoints)
			}

			// Get the reward product
			var rewardProduct models.Product
			if err := tx.First(&rewardProduct, *input.RewardID).Error; err != nil {
				return fmt.Errorf("reward product not found: %v", err)
			}

			if !rewardProduct.IsReward || rewardProduct.PointsRequired != input.RewardPoints {
				return fmt.Errorf("invalid reward product or points mismatch")
			}

			// Deduct points from customer
			if err := tx.Model(&customer).Update("loyalty_points", customer.LoyaltyPoints-float64(input.RewardPoints)).Error; err != nil {
				return fmt.Errorf("failed to deduct loyalty points: %v", err)
			}

			// Add reward item to order as FREE (price already 0, so no double discount)
			rewardItem := models.OrderItem{
				OrderID:   order.ID,
				ProductID: rewardProduct.ID,
				Quantity:  1,
				UnitPrice: 0, // Free because points were redeemed
				Subtotal:  0,
			}
			if err := tx.Create(&rewardItem).Error; err != nil {
				return fmt.Errorf("failed to add reward item to order: %v", err)
			}

			// Create loyalty ledger entry for redemption
			ledgerEntry := models.LoyaltyLedger{
				CustomerID:     *input.CustomerID,
				OrderID:        &order.ID,
				PointsRedeemed: float64(input.RewardPoints),
				Remarks:        fmt.Sprintf("Redeemed %d points for free reward: %s (Order #%d)", input.RewardPoints, rewardProduct.Name, order.ID),
			}
			if err := tx.Create(&ledgerEntry).Error; err != nil {
				fmt.Printf("Warning: failed to create loyalty ledger entry: %v\n", err)
			}
		}

		// Handle points earned if order is completed
		if orderStatus == "completed" && input.CustomerID != nil && *input.CustomerID > 0 {
			var customer models.Customer
			if err := tx.First(&customer, *input.CustomerID).Error; err == nil {
				// Calculate points earned: 1 point per ₱200 spent
				pointsEarned := finalTotal / 200.0
				if pointsEarned > 0 {
					if err := tx.Model(&customer).Update("loyalty_points", customer.LoyaltyPoints+pointsEarned).Error; err != nil {
						// Log but don't fail the order
						fmt.Printf("Warning: failed to add loyalty points: %v\n", err)
					}

					// Create loyalty ledger entry for earning
					ledgerEntry := models.LoyaltyLedger{
						CustomerID:   *input.CustomerID,
						OrderID:      &order.ID,
						PointsEarned: pointsEarned,
						Remarks:      fmt.Sprintf("Earned %v points from ₱%.2f purchase on Order #%d", pointsEarned, finalTotal, order.ID),
					}
					if err := tx.Create(&ledgerEntry).Error; err != nil {
						fmt.Printf("Warning: failed to create loyalty ledger entry: %v\n", err)
					}
				}
			}
		}
		// === END LOYALTY POINTS SYSTEM ===

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Customer").Preload("User").Preload("Items.Product").First(&order, order.ID)

	h.LogService.Record(userID, "CREATE", "Order", strconv.Itoa(int(order.ID)), fmt.Sprintf("Checked out POS Order #%d", order.ID), c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{"message": "Order created", "order": order})
}

func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var order models.Order
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	var input statusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	oldStatus := order.Status

	if oldStatus == "pending" && input.Status == "completed" {
		err := database.DB.Transaction(func(tx *gorm.DB) error {

			var items []models.OrderItem
			if err := tx.Where("order_id = ?", id).Find(&items).Error; err != nil {
				return err
			}

			uID, _ := GetUintFromContext(c, "userID")

			for _, item := range items {
				var product models.Product
				if err := tx.First(&product, item.ProductID).Error; err != nil {
					return errors.New("product ID " + strconv.Itoa(int(item.ProductID)) + " not found")
				}

				if !product.IsService {
					var batches []models.Batch
					if err := tx.Model(&models.Batch{}).
						Where("product_id = ? AND branch_id = ? AND quantity > 0", product.ID, order.BranchID).
						Clauses(clause.Locking{Strength: "UPDATE"}).
						Order("expiry_date ASC, created_at ASC").
						Find(&batches).Error; err != nil {
						return fmt.Errorf("failed to lock batches for %s: %v", product.Name, err)
					}

					remainingToDeduct := item.Quantity

					for i := range batches {
						if remainingToDeduct <= 0 {
							break
						}

						deductFromBatch := remainingToDeduct
						if batches[i].Quantity < deductFromBatch {
							deductFromBatch = batches[i].Quantity
						}

						if err := tx.Model(&batches[i]).Update("quantity", batches[i].Quantity-deductFromBatch).Error; err != nil {
							return fmt.Errorf("failed to update batch for %s", product.Name)
						}

						movement := models.StockMovement{
							ProductID:   product.ID,
							BatchID:     &batches[i].ID,
							WarehouseID: batches[i].WarehouseID,
							BranchID:    batches[i].BranchID,
							UserID:      &uID,
							Type:        models.MovementTypeOut,
							Quantity:    -deductFromBatch,
							Reference:   fmt.Sprintf("POS Order #%d (Completed Pending)", order.ID),
						}

						if err := tx.Create(&movement).Error; err != nil {
							return fmt.Errorf("failed to record movement for %s", product.Name)
						}

						remainingToDeduct -= deductFromBatch
					}

					if remainingToDeduct > 0 {
						return fmt.Errorf("insufficient batch stock for %s (need %d more)", product.Name, remainingToDeduct)
					}

					if err := tx.Model(&product).Update("stock", product.Stock-item.Quantity).Error; err != nil {
						return errors.New("failed to update product stock cache for " + product.Name)
					}
				}
			}

			order.Status = input.Status
			return tx.Save(&order).Error
		})

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to complete order", "details": err.Error()})
			return
		}
	} else {

		order.Status = input.Status
		if err := database.DB.Save(&order).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order status"})
			return
		}
	}

	database.DB.Preload("Customer").Preload("User").Preload("Items.Product").First(&order, order.ID)
	userID, _ := GetUintFromContext(c, "userID")
	h.LogService.Record(userID, "UPDATE_STATUS", "Order", strconv.Itoa(int(order.ID)), fmt.Sprintf("Status changed from %s to %s", oldStatus, input.Status), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Order status updated", "order": order})
}

func (h *OrderHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var order models.Order
	if err := database.DB.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	if order.Status == "completed" {
		err = database.DB.Transaction(func(tx *gorm.DB) error {
			var items []models.OrderItem
			if err := tx.Where("order_id = ?", id).Find(&items).Error; err != nil {
				return err
			}

			userID, _ := GetUintFromContext(c, "userID")

			for _, item := range items {
				var product models.Product
				if err := tx.First(&product, item.ProductID).Error; err != nil {
					return errors.New("product not found: " + strconv.Itoa(int(item.ProductID)))
				}

				if !product.IsService {
					if err := tx.Model(&product).Update("stock", gorm.Expr("stock + ?", item.Quantity)).Error; err != nil {
						return fmt.Errorf("failed to restore stock for %s", product.Name)
					}

					movement := models.StockMovement{
						ProductID:   product.ID,
						WarehouseID: 1,
						BranchID:    order.BranchID,
						UserID:      &userID,
						Type:        models.MovementTypeIn,
						Quantity:    item.Quantity,
						Reference:   fmt.Sprintf("Order #%d deleted - stock restored", order.ID),
					}
					if err := tx.Create(&movement).Error; err != nil {
						return fmt.Errorf("failed to record stock movement: %v", err)
					}
				}
			}

			if err := tx.Where("order_id = ?", id).Delete(&models.OrderItem{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&order).Error; err != nil {
				return err
			}
			return nil
		})
	} else {
		err = database.DB.Transaction(func(tx *gorm.DB) error {
			if err := tx.Where("order_id = ?", id).Delete(&models.OrderItem{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&order).Error; err != nil {
				return err
			}
			return nil
		})
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete order: " + err.Error()})
		return
	}

	userID, _ := GetUintFromContext(c, "userID")
	statusMsg := "no change"
	if order.Status == "completed" {
		statusMsg = "restored"
	}
	h.LogService.Record(userID, "DELETE", "Order", strconv.Itoa(int(id)), fmt.Sprintf("Deleted order #%d (stock %s)", id, statusMsg), c.ClientIP())

	c.JSON(http.StatusOK, gin.H{"message": "Order deleted successfully"})
}
