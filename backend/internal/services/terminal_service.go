package services

import (
	"fmt"
	"log"
	"time"
)


type TerminalResponse struct {
	Status       string  `json:"status"` 
	Amount       float64 `json:"amount"`
	ApprovalCode string  `json:"approval_code"`
	ReferenceNo  string  `json:"reference_no"`
	ErrorMessage string  `json:"error_message,omitempty"`
}

type TerminalService struct {
	IsSimulation bool
	PortName     string 
}

func NewTerminalService(isSim bool, port string) *TerminalService {
	return &TerminalService{
		IsSimulation: isSim,
		PortName:     port,
	}
}


func (s *TerminalService) ProcessPayment(amount float64) (*TerminalResponse, error) {
	if s.IsSimulation {
		return s.simulatePayment(amount)
	}

	
	
	
	
	return nil, fmt.Errorf("physical terminal integration requires specific hardware configuration on port %s", s.PortName)
}

func (s *TerminalService) simulatePayment(amount float64) (*TerminalResponse, error) {
	log.Printf("[TERMINAL SIM] Initiating payment for ₱%.2f", amount)

	
	time.Sleep(3 * time.Second)

	
	return &TerminalResponse{
		Status:       "APPROVED",
		Amount:       amount,
		ApprovalCode: "SIM-OK-123",
		ReferenceNo:  fmt.Sprintf("SYM-%d", time.Now().Unix()),
	}, nil
}
