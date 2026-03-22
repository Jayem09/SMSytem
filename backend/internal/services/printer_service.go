package services

import (
	"bytes"
	"fmt"
	"os/exec"
	"regexp"
	"smsystem-backend/internal/models"
)

type PrinterService struct {
	LogService *LogService
}

func NewPrinterService(logSvc *LogService) *PrinterService {
	return &PrinterService{LogService: logSvc}
}

var safePrinterNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func isValidPrinterName(name string) bool {
	return len(name) > 0 && len(name) <= 128 && safePrinterNameRegex.MatchString(name)
}

// Common ESC/POS Commands
var (
	ESC_INIT       = []byte{0x1b, 0x40}
	ESC_ALIGN_LEFT = []byte{0x1b, 0x61, 0x00}
	ESC_ALIGN_CTR  = []byte{0x1b, 0x61, 0x01}
	ESC_ALIGN_RGHT = []byte{0x1b, 0x61, 0x02}
	ESC_DRAFT      = []byte{0x1b, 0x78, 0x00} // Draft mode for speed
	ESC_ELITE      = []byte{0x1b, 0x4d}       // Elite pitch (12 cpi)
	ESC_CONDENSED  = []byte{0x0f}             // Condensed mode
	ESC_NORMAL     = []byte{0x12}             // Reset condensed
	ESC_PAPER_FEED = []byte{0x0c}             // Form feed (new page)
)

func (s *PrinterService) GenerateSI(order *models.Order) ([]byte, error) {
	var b bytes.Buffer

	// Initialize
	b.Write(ESC_INIT)
	b.Write(ESC_DRAFT)
	b.Write(ESC_ELITE)

	// Header
	b.Write(ESC_ALIGN_CTR)
	b.WriteString("SMS SALES INVOICE\n")
	b.WriteString(fmt.Sprintf("Invoice #: %d\n", order.ID))
	b.WriteString(fmt.Sprintf("Date: %s\n", order.CreatedAt.Format("2006-01-02 15:04")))
	b.WriteString("------------------------------------------\n")

	// Branch Info
	b.Write(ESC_ALIGN_LEFT)
	if order.BranchID != 0 {
		b.WriteString(fmt.Sprintf("Branch: %s\n", order.Branch.Name))
	}

	// Customer Info
	if order.CustomerID != nil && order.Customer.ID != 0 {
		b.WriteString(fmt.Sprintf("Customer: %s\n", order.Customer.Name))
	} else if order.GuestName != "" {
		b.WriteString(fmt.Sprintf("Guest: %s\n", order.GuestName))
	}
	b.WriteString("\n")

	// Items Header
	b.WriteString("Qty   Description               Price     Total\n")
	b.WriteString("------------------------------------------\n")

	// Items (Assuming 42 characters width for dot matrix Elite pitch)
	for _, item := range order.Items {
		desc := item.Product.Name
		if len(desc) > 23 {
			desc = desc[:20] + "..."
		}
		line := fmt.Sprintf("%-5d %-25s %7.2f %9.2f\n",
			item.Quantity, desc, item.UnitPrice, item.Subtotal)
		b.WriteString(line)
	}

	b.WriteString("------------------------------------------\n")
	b.Write(ESC_ALIGN_RGHT)
	if order.DiscountAmount > 0 {
		b.WriteString(fmt.Sprintf("Discount: %10.2f\n", order.DiscountAmount))
	}
	b.WriteString(fmt.Sprintf("TOTAL DUE: %10.2f\n", order.TotalAmount))
	b.WriteString("\n\n")

	// Footer
	b.Write(ESC_ALIGN_CTR)
	b.WriteString("Thank you for your business!\n")
	b.WriteString("Please keep this invoice for your records.\n")

	// Feed and cut/eject
	b.WriteString("\n\n\n")
	b.Write(ESC_PAPER_FEED)

	return b.Bytes(), nil
}

func (s *PrinterService) GenerateDR(order *models.Order) ([]byte, error) {
	var b bytes.Buffer

	// Initialize
	b.Write(ESC_INIT)
	b.Write(ESC_DRAFT)

	// Header
	b.Write(ESC_ALIGN_CTR)
	b.WriteString("SMS DELIVERY RECEIPT\n")
	b.WriteString(fmt.Sprintf("DR #: %d\n", order.ID))
	b.WriteString(fmt.Sprintf("Date: %s\n", order.CreatedAt.Format("2006-01-02 15:04")))
	b.WriteString("------------------------------------------\n")

	// Info
	b.Write(ESC_ALIGN_LEFT)
	if order.CustomerID != nil && order.Customer.ID != 0 {
		b.WriteString(fmt.Sprintf("To: %s\n", order.Customer.Name))
	}
	b.WriteString("\n")

	// Items
	b.WriteString("Qty   Unit   Description\n")
	b.WriteString("------------------------------------------\n")
	for _, item := range order.Items {
		unit := "pcs"
		if item.Product.Size != "" {
			unit = item.Product.Size
		}
		desc := item.Product.Name
		if len(desc) > 25 {
			desc = desc[:22] + "..."
		}
		line := fmt.Sprintf("%-5d %-6s %-30s\n", item.Quantity, unit, desc)
		b.WriteString(line)
	}
	b.WriteString("------------------------------------------\n")

	b.WriteString("\n\nReceived in good condition:\n\n")
	b.WriteString("___________________________\n")
	b.WriteString("Signature over Printed Name\n")

	// Feed and cut/eject
	b.WriteString("\n\n\n")
	b.Write(ESC_PAPER_FEED)

	return b.Bytes(), nil
}

func (s *PrinterService) PrintRaw(printerName string, data []byte) error {
	if !isValidPrinterName(printerName) {
		return fmt.Errorf("invalid printer name: must be alphanumeric with hyphens/underscores, max 128 characters")
	}

	cmd := exec.Command("lp", "-d", printerName, "-o", "raw")
	cmd.Stdin = bytes.NewReader(data)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("printing failed: %v (stderr: %s)", err, stderr.String())
	}
	return nil
}

func (s *PrinterService) ListPrinters() ([]string, error) {
	// 'lpstat -a' lists printers on macOS/Linux
	cmd := exec.Command("lpstat", "-a")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list printers: %v", err)
	}

	lines := bytes.Split(output, bytes.NewBufferString("\n").Bytes())
	var printers []string
	for _, line := range lines {
		if len(line) == 0 {
			continue
		}
		// Format: "PRINTER_NAME accepting requests since..."
		parts := bytes.Split(line, bytes.NewBufferString(" ").Bytes())
		if len(parts) > 0 {
			printers = append(printers, string(parts[0]))
		}
	}

	return printers, nil
}
