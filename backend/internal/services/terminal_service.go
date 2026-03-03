package services

import (
	"fmt"
	"log"
	"time"
)

// TerminalResponse represents the result of a terminal transaction.
type TerminalResponse struct {
	Status       string  `json:"status"` // "APPROVED", "DECLINED", "ERROR", "CANCELLED"
	Amount       float64 `json:"amount"`
	ApprovalCode string  `json:"approval_code"`
	ReferenceNo  string  `json:"reference_no"`
	ErrorMessage string  `json:"error_message,omitempty"`
}

type TerminalService struct {
	IsSimulation bool
	PortName     string // e.g. "COM3" or "/dev/ttyUSB0"
}

func NewTerminalService(isSim bool, port string) *TerminalService {
	return &TerminalService{
		IsSimulation: isSim,
		PortName:     port,
	}
}

// ProcessPayment initiates a sale on the terminal.
func (s *TerminalService) ProcessPayment(amount float64) (*TerminalResponse, error) {
	if s.IsSimulation {
		return s.simulatePayment(amount)
	}

	// Real Maya ECR Protocol Implementation would go here.
	// 1. Open Serial Port
	// 2. Format ECR Sale Packet
	// 3. Send and Wait for Response
	return nil, fmt.Errorf("physical terminal integration requires specific hardware configuration on port %s", s.PortName)
}

func (s *TerminalService) simulatePayment(amount float64) (*TerminalResponse, error) {
	log.Printf("[TERMINAL SIM] Initiating payment for ₱%.2f", amount)

	// Simulate terminal processing time
	time.Sleep(3 * time.Second)

	// Always approve in simulation for now
	return &TerminalResponse{
		Status:       "APPROVED",
		Amount:       amount,
		ApprovalCode: "SIM-OK-123",
		ReferenceNo:  fmt.Sprintf("SYM-%d", time.Now().Unix()),
	}, nil
}
