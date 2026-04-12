package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
	"smsystem-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TransferHandler struct {
	LogService   *services.LogService
	EmailService *services.EmailService
}

func NewTransferHandler(logSvc *services.LogService, emailSvc *services.EmailService) *TransferHandler {
	return &TransferHandler{LogService: logSvc, EmailService: emailSvc}
}

type transferItemInput struct {
	ProductID uint `json:"product_id" binding:"required"`
	Quantity  int  `json:"quantity" binding:"required,min=1"`
}

type createTransferInput struct {
	SourceBranchID      uint                `json:"source_branch_id" binding:"required"`
	DestinationBranchID uint                `json:"destination_branch_id" binding:"required"`
	Notes               string              `json:"notes"`
	Items               []transferItemInput `json:"items" binding:"required,min=1,dive"`
}

type updateTransferStatusInput struct {
	Status string `json:"status" binding:"required,oneof=approved in_transit completed rejected cancelled"`
}

func (h *TransferHandler) List(c *gin.Context) {
	userRole, _ := c.Get("userRole")
	branchIDValue, _ := c.Get("branchID")
	selectedBranchStr := c.Query("branch_id")

	userRoleStr := ""
	if r, ok := userRole.(string); ok {
		userRoleStr = strings.ToLower(r)
	}

	var branchID uint
	if branchIDValue != nil {
		switch v := branchIDValue.(type) {
		case uint:
			branchID = v
		case float64:
			branchID = uint(v)
		case string:
			vid, _ := strconv.ParseUint(v, 10, 64)
			branchID = uint(vid)
		}
	}

	query := database.DB.Model(&models.StockTransfer{}).
		Preload("SourceBranch").Preload("DestinationBranch").
		Preload("RequestedByUser").Preload("Items.Product")

	var effectiveQuery *gorm.DB
	if userRoleStr == "super_admin" {
		if selectedBranchStr != "" && selectedBranchStr != "ALL" {
			bID, _ := strconv.ParseUint(selectedBranchStr, 10, 64)
			effectiveQuery = query.Where("source_branch_id = ? OR destination_branch_id = ?", uint(bID), uint(bID))
		} else {
			effectiveQuery = query
		}
	} else if branchID > 0 {
		effectiveQuery = query.Where("source_branch_id = ? OR destination_branch_id = ?", branchID, branchID)
	} else {
		effectiveQuery = query
	}

	var transfers []models.StockTransfer
	if err := effectiveQuery.Order("created_at DESC").Find(&transfers).Error; err != nil {
		log.Printf("TRANSFER LIST ERROR: Role=%s, BranchID=%v, Error=%v", userRoleStr, branchIDValue, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch stock transfers"})
		return
	}

	log.Printf("TRANSFER LIST SUCCESS: User=%s, BranchID=%v, Found=%d", userRoleStr, branchID, len(transfers))

	c.JSON(http.StatusOK, gin.H{
		"transfers": transfers,
	})
}

func (h *TransferHandler) GetPendingCounts(c *gin.Context) {
	branchIDValue, _ := c.Get("branchID")
	userRole, _ := c.Get("userRole")

	var incomingCount int64
	var receivingCount int64

	userRoleStr := ""
	if r, ok := userRole.(string); ok {
		userRoleStr = strings.ToLower(r)
	}

	var branchID uint
	if branchIDValue != nil {
		switch v := branchIDValue.(type) {
		case uint:
			branchID = v
		case float64:
			branchID = uint(v)
		case string:
			u64, _ := strconv.ParseUint(v, 10, 64)
			branchID = uint(u64)
		}
	}

	if userRoleStr == "super_admin" {

		database.DB.Model(&models.StockTransfer{}).Where("source_branch_id = ? AND status IN ?", branchID, []string{models.TransferStatusPending, models.TransferStatusApproved}).Count(&incomingCount)

		database.DB.Model(&models.StockTransfer{}).Where("destination_branch_id = ? AND status = ?", branchID, models.TransferStatusInTransit).Count(&receivingCount)
	}

	log.Printf("PENDING COUNTS DEBUG: BranchID=%v, Role=%v, RoleStr=%s, Incoming=%d, Receiving=%d", branchIDValue, userRole, userRoleStr, incomingCount, receivingCount)

	c.JSON(http.StatusOK, gin.H{
		"incoming_pending": int(incomingCount),
		"incoming_shipped": int(receivingCount),
		"total_actionable": int(incomingCount + receivingCount),
	})
}

func (h *TransferHandler) Create(c *gin.Context) {
	var input createTransferInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": err.Error()})
		return
	}

	if input.SourceBranchID == input.DestinationBranchID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Source and destination branch cannot be the same"})
		return
	}

	userIDValue, _ := c.Get("userID")
	branchIDValue, _ := c.Get("branchID")

	var userID uint
	if userIDValue != nil {
		switch v := userIDValue.(type) {
		case uint:
			userID = v
		case float64:
			userID = uint(v)
		case string:
			u64, _ := strconv.ParseUint(v, 10, 64)
			userID = uint(u64)
		}
	}

	var branchID uint
	if branchIDValue != nil {
		switch v := branchIDValue.(type) {
		case uint:
			branchID = v
		case float64:
			branchID = uint(v)
		case string:
			u64, _ := strconv.ParseUint(v, 10, 64)
			branchID = uint(u64)
		}
	}

	log.Printf("TRANSFER CREATE: UserID=%v, UserBranchID=%v, TargetSource=%v, TargetDest=%v", userID, branchID, input.SourceBranchID, input.DestinationBranchID)

	var transfer models.StockTransfer

	err := database.DB.Transaction(func(tx *gorm.DB) error {

		refNumber := fmt.Sprintf("TRF-%d", time.Now().Unix())

		transfer = models.StockTransfer{
			ReferenceNumber:     refNumber,
			SourceBranchID:      input.SourceBranchID,
			DestinationBranchID: input.DestinationBranchID,
			RequestedByUserID:   userID,
			Status:              models.TransferStatusPending,
			Notes:               input.Notes,
		}

		if err := tx.Create(&transfer).Error; err != nil {
			return err
		}

		for _, item := range input.Items {
			tItem := models.StockTransferItem{
				StockTransferID: transfer.ID,
				ProductID:       item.ProductID,
				Quantity:        item.Quantity,
			}
			if err := tx.Create(&tItem).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transfer request"})
		return
	}

	h.LogService.Record(userID, "CREATE", "StockTransfer", strconv.Itoa(int(transfer.ID)), fmt.Sprintf("Created stock transfer %s", transfer.ReferenceNumber), c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{"message": "Transfer request created", "transfer": transfer})
}

func (h *TransferHandler) UpdateStatus(c *gin.Context) {
	idParam := c.Param("id")
	var transfer models.StockTransfer

	// Try to find by numeric ID first
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err == nil {
		if err := database.DB.Preload("Items").First(&transfer, id).Error; err != nil {
			// If numeric ID fails, try reference number
			if err := database.DB.Preload("Items").Where("reference_number = ?", idParam).First(&transfer).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Transfer not found"})
				return
			}
		}
	} else {
		// Not a number, try as reference number
		if err := database.DB.Preload("Items").Where("reference_number = ?", idParam).First(&transfer).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Transfer not found"})
			return
		}
	}

	var input updateTransferStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed"})
		return
	}

	userIDValue, _ := c.Get("userID")
	branchIDValue, _ := c.Get("branchID")
	userRoleValue, _ := c.Get("userRole")

	var userID uint
	if userIDValue != nil {
		switch v := userIDValue.(type) {
		case uint:
			userID = v
		case float64:
			userID = uint(v)
		case string:
			u64, _ := strconv.ParseUint(v, 10, 64)
			userID = uint(u64)
		}
	}

	var userBranchID uint
	if branchIDValue != nil {
		switch v := branchIDValue.(type) {
		case uint:
			userBranchID = v
		case float64:
			userBranchID = uint(v)
		case string:
			u64, _ := strconv.ParseUint(v, 10, 64)
			userBranchID = uint(u64)
		}
	}

	userRole := ""
	if r, ok := userRoleValue.(string); ok {
		userRole = strings.ToLower(r)
	}

	oldStatus := transfer.Status
	newStatus := input.Status

	log.Printf("TRANSFER UPDATE: ID=%d, Ref=%s, UserID=%d, BranchID=%d, Role=%s, %s -> %s",
		transfer.ID, transfer.ReferenceNumber, userID, userBranchID, userRole, oldStatus, newStatus)

	if oldStatus == newStatus {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status is already " + newStatus})
		return
	}

	// Validate status transition path
	validTransitions := map[string][]string{
		models.TransferStatusPending:   {models.TransferStatusApproved, models.TransferStatusRejected, models.TransferStatusCancelled},
		models.TransferStatusApproved:  {models.TransferStatusInTransit, models.TransferStatusCancelled},
		models.TransferStatusInTransit: {models.TransferStatusCompleted},
		models.TransferStatusCompleted: {},
		models.TransferStatusRejected:  {},
		models.TransferStatusCancelled: {},
	}

	allowedNext, exists := validTransitions[oldStatus]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unknown current status: " + oldStatus})
		return
	}

	isValidTransition := false
	for _, allowed := range allowedNext {
		if allowed == newStatus {
			isValidTransition = true
			break
		}
	}
	if !isValidTransition {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Cannot change status from '%s' to '%s'", oldStatus, newStatus)})
		return
	}

	// Permission checks (super_admin bypasses all)
	if userRole != "super_admin" {
		// APPROVE: Only destination branch can approve (they're receiving stock)
		if newStatus == models.TransferStatusApproved {
			if userBranchID != transfer.DestinationBranchID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only the destination branch can approve transfers"})
				return
			}
		}
		// SHIP (in_transit): Only source branch can ship
		if newStatus == models.TransferStatusInTransit {
			if userBranchID != transfer.SourceBranchID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only the source branch can ship transfers"})
				return
			}
		}
		// REJECT: Either source or destination branch can reject
		if newStatus == models.TransferStatusRejected {
			if userBranchID != transfer.SourceBranchID && userBranchID != transfer.DestinationBranchID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only source or destination branch can reject transfers"})
				return
			}
		}
		// RECEIVE (completed): Only destination branch can receive
		if newStatus == models.TransferStatusCompleted {
			if userBranchID != transfer.DestinationBranchID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only the destination branch can receive transfers"})
				return
			}
		}
		// CANCEL: Source branch or the requester can cancel
		if newStatus == models.TransferStatusCancelled {
			if userBranchID != transfer.SourceBranchID && userID != transfer.RequestedByUserID {
				c.JSON(http.StatusForbidden, gin.H{"error": "Only the source branch or the requester can cancel transfers"})
				return
			}
		}
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		transfer.Status = newStatus

		switch newStatus {
		case models.TransferStatusApproved:
			transfer.ApprovedByUserID = &userID
		case models.TransferStatusCompleted:
			transfer.ReceivedByUserID = &userID
		}

		if err := tx.Save(&transfer).Error; err != nil {
			return err
		}

		if oldStatus == models.TransferStatusApproved && newStatus == models.TransferStatusInTransit {

			for _, item := range transfer.Items {
				var product models.Product
				if err := tx.First(&product, item.ProductID).Error; err != nil {
					return errors.New("Product not found")
				}

				var sourceBatches []models.Batch
				remaining := item.Quantity
				log.Printf("STOCK DEDUCTION: ProductID=%d, SourceBranchID=%d, RemainingNeeded=%d", product.ID, transfer.SourceBranchID, remaining)

				if err := tx.Where("product_id = ? AND branch_id = ? AND quantity > 0", product.ID, transfer.SourceBranchID).Order("expiry_date ASC").Find(&sourceBatches).Error; err != nil {
					return err
				}
				log.Printf("STOCK DEDUCTION: Found %d batches for ProductID=%d at BranchID=%d", len(sourceBatches), product.ID, transfer.SourceBranchID)

				if len(sourceBatches) == 0 && product.Stock >= remaining {
					log.Printf("STOCK SELF-HEALING: Creating migration batch for ProductID=%d at BranchID=%d", product.ID, transfer.SourceBranchID)
					var sourceWarehouse models.Warehouse
					if err := tx.Where("branch_id = ?", transfer.SourceBranchID).First(&sourceWarehouse).Error; err != nil {

						sourceWarehouse = models.Warehouse{
							Name:     "Default Warehouse",
							BranchID: transfer.SourceBranchID,
						}
						tx.Create(&sourceWarehouse)
					}

					migrationBatch := models.Batch{
						ProductID:   product.ID,
						WarehouseID: sourceWarehouse.ID,
						BranchID:    transfer.SourceBranchID,
						BatchNumber: "LEGACY-MIGRATION",
						Quantity:    product.Stock,
					}
					if err := tx.Create(&migrationBatch).Error; err == nil {
						sourceBatches = append(sourceBatches, migrationBatch)
					}
				}

				for _, b := range sourceBatches {
					log.Printf("  - Batch ID: %d, Qty: %d", b.ID, b.Quantity)
				}

				for i := range sourceBatches {
					if remaining <= 0 {
						break
					}
					deduct := remaining
					if sourceBatches[i].Quantity < deduct {
						deduct = sourceBatches[i].Quantity
					}

					tx.Model(&sourceBatches[i]).Update("quantity", sourceBatches[i].Quantity-deduct)

					movement := models.StockMovement{
						ProductID:   product.ID,
						BatchID:     &sourceBatches[i].ID,
						WarehouseID: sourceBatches[i].WarehouseID,
						BranchID:    transfer.SourceBranchID,
						UserID:      &userID,
						Type:        models.MovementTypeOut,
						Quantity:    -deduct,
						Reference:   fmt.Sprintf("Sent Transfer %s", transfer.ReferenceNumber),
					}
					tx.Create(&movement)
					remaining -= deduct
				}
				if remaining > 0 {
					return fmt.Errorf("Insufficient stock at source branch for product ID %d (Need %d more)", product.ID, remaining)
				}

				if err := tx.Model(&product).Update("stock", product.Stock-item.Quantity).Error; err != nil {
					return err
				}
			}
		} else if oldStatus == models.TransferStatusInTransit && newStatus == models.TransferStatusCompleted {

			for i, item := range transfer.Items {

				var destWarehouse models.Warehouse
				if err := tx.Where("branch_id = ?", transfer.DestinationBranchID).First(&destWarehouse).Error; err != nil {

					destWarehouse = models.Warehouse{
						Name:     "Default Warehouse",
						BranchID: transfer.DestinationBranchID,
					}
					tx.Create(&destWarehouse)
				}

				batch := models.Batch{
					ProductID:   item.ProductID,
					WarehouseID: destWarehouse.ID,
					BranchID:    transfer.DestinationBranchID,
					BatchNumber: fmt.Sprintf("TRF-%d", transfer.ID),
					Quantity:    item.Quantity,
				}
				if err := tx.Create(&batch).Error; err != nil {
					return err
				}

				// Add stock back to global product.stock (was deducted on ship, now available again at destination)
				var product models.Product
				if err := tx.First(&product, item.ProductID).Error; err == nil {
					tx.Model(&product).Update("stock", product.Stock+item.Quantity)
				}

				// Set received_quantity on the transfer item
				tx.Model(&transfer.Items[i]).Update("received_quantity", item.Quantity)

				movement := models.StockMovement{
					ProductID:   item.ProductID,
					BatchID:     &batch.ID,
					WarehouseID: destWarehouse.ID,
					BranchID:    transfer.DestinationBranchID,
					UserID:      &userID,
					Type:        models.MovementTypeIn,
					Quantity:    item.Quantity,
					Reference:   fmt.Sprintf("Received Transfer %s", transfer.ReferenceNumber),
				}
				tx.Create(&movement)
			}
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to update transfer status", "details": err.Error()})
		return
	}

	h.LogService.Record(userID, "UPDATE", "StockTransfer", strconv.Itoa(int(transfer.ID)), fmt.Sprintf("Status changed to %s", newStatus), c.ClientIP())

	// Send email notifications (async, never blocks the response)
	if h.EmailService != nil {
		var sourceBranch, destBranch models.Branch
		database.DB.First(&sourceBranch, transfer.SourceBranchID)
		database.DB.First(&destBranch, transfer.DestinationBranchID)

		// Notify source branch about all status changes
		if sourceBranch.Email != "" {
			go func() {
				if err := h.EmailService.SendTransferNotification(
					sourceBranch.Email,
					sourceBranch.Name,
					transfer.ReferenceNumber,
					newStatus,
					sourceBranch.Name,
					destBranch.Name,
				); err != nil {
					log.Printf("[TRANSFER] Email to source branch %s failed: %v", sourceBranch.Name, err)
				}
			}()
		}

		// Notify destination branch when items are shipped (in_transit) or received (completed)
		if destBranch.Email != "" && (newStatus == models.TransferStatusInTransit || newStatus == models.TransferStatusCompleted) {
			go func() {
				if err := h.EmailService.SendTransferNotification(
					destBranch.Email,
					destBranch.Name,
					transfer.ReferenceNumber,
					newStatus,
					sourceBranch.Name,
					destBranch.Name,
				); err != nil {
					log.Printf("[TRANSFER] Email to destination branch %s failed: %v", destBranch.Name, err)
				}
			}()
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Transfer status updated", "transfer": transfer})
}
