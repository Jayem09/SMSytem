package handlers

import (
	"testing"
	"time"
)

func withStubbedOfftakeNow(t *testing.T, now time.Time) {
	t.Helper()
	original := offtakeNow
	offtakeNow = func() time.Time { return now }
	t.Cleanup(func() {
		offtakeNow = original
	})
}

func TestResolveOfftakeDateRangeUsesExplicitBounds(t *testing.T) {
	start, end := resolveOfftakeDateRange("2026-04-05", "2026-04-10", time.UTC)

	if got := start.Format("2006-01-02 15:04:05"); got != "2026-04-05 00:00:00" {
		t.Fatalf("expected start of range to be normalized, got %q", got)
	}

	if got := end.Format("2006-01-02 15:04:05"); got != "2026-04-11 00:00:00" {
		t.Fatalf("expected end of range to be exclusive next-day midnight, got %q", got)
	}
}

func TestResolveOfftakeDateRangeFallsBackToSingleDayWhenEndIsNotAfterStart(t *testing.T) {
	start, end := resolveOfftakeDateRange("2026-04-10", "2026-04-05", time.UTC)

	if got := start.Format("2006-01-02 15:04:05"); got != "2026-04-10 00:00:00" {
		t.Fatalf("expected start to stay on 2026-04-10, got %q", got)
	}

	if got := end.Format("2006-01-02 15:04:05"); got != "2026-04-11 00:00:00" {
		t.Fatalf("expected end to reset to one day after start, got %q", got)
	}
}

func TestResolveOfftakeDateRangeFallsBackWhenLocationIsNil(t *testing.T) {
	withStubbedOfftakeNow(t, time.Date(2026, 4, 27, 15, 0, 0, 0, time.UTC))

	start, end := resolveOfftakeDateRange("", "", nil)

	if got := start.Format("2006-01-02 15:04:05"); got != "2026-04-27 00:00:00" {
		t.Fatalf("expected nil-location fallback start to use stubbed current day, got %q", got)
	}

	if got := end.Format("2006-01-02 15:04:05"); got != "2026-04-28 00:00:00" {
		t.Fatalf("expected nil-location fallback end to be next day, got %q", got)
	}
}

func TestNormalizeOfftakeBranchIDRestrictsNonSuperAdmin(t *testing.T) {
	branchID := normalizeOfftakeBranchID("cashier", 4, "1")
	if branchID != 4 {
		t.Fatalf("expected cashier branch to stay locked to 4, got %d", branchID)
	}
}

func TestNormalizeOfftakeBranchIDAllowsSuperAdminAllBranches(t *testing.T) {
	branchID := normalizeOfftakeBranchID("super_admin", 0, "ALL")
	if branchID != 0 {
		t.Fatalf("expected ALL to resolve to branch 0, got %d", branchID)
	}
}

func TestNormalizeOfftakeBranchIDFallsBackToContextBranchOnInvalidInput(t *testing.T) {
	branchID := normalizeOfftakeBranchID("super_admin", 7, "abc")
	if branchID != 7 {
		t.Fatalf("expected invalid input to fall back to the context branch, got %d", branchID)
	}
}

func TestBuildOfftakeInvoiceLabelPadsOrderID(t *testing.T) {
	label := buildOfftakeInvoiceLabel("SI", 42)
	if label != "SI-00042" {
		t.Fatalf("expected invoice label SI-00042, got %q", label)
	}
}

func TestBuildOfftakeInvoiceLabelDefaultsBlankReceiptTypeToSI(t *testing.T) {
	label := buildOfftakeInvoiceLabel("   ", 42)
	if label != "SI-00042" {
		t.Fatalf("expected blank receipt type to default to SI, got %q", label)
	}
}

func TestBuildOfftakeItemSummaryJoinsItems(t *testing.T) {
	summary := buildOfftakeItemSummary([]offtakeItemPart{
		{Name: "Accelera Tire", Quantity: 2},
		{Name: "Alignment", Quantity: 1},
	})

	if summary != "Accelera Tire x2, Alignment x1" {
		t.Fatalf("unexpected item summary %q", summary)
	}
}

func TestBuildOfftakeItemSummarySkipsBlankNames(t *testing.T) {
	summary := buildOfftakeItemSummary([]offtakeItemPart{
		{Name: "", Quantity: 2},
		{Name: "Alignment", Quantity: 1},
		{Name: "   ", Quantity: 5},
	})

	if summary != "Alignment x1" {
		t.Fatalf("expected blank item names to be skipped, got %q", summary)
	}
}

func TestBuildOfftakeRowsShapesInvoiceLevelData(t *testing.T) {
	raw := []offtakeRawRow{
		{
			OrderID:        42,
			ReceiptType:    "SI",
			CreatedAt:      time.Date(2026, 4, 10, 9, 15, 0, 0, time.UTC),
			CustomerName:   "John Doe",
			BranchName:     "LIPA A",
			ServiceAdvisor: "Mike",
			PaymentStatus:  "paid",
			TotalAmount:    12500,
			AmountPaid:     12500,
			BalanceDue:     0,
			QuantityTotal:  3,
			ItemSummary:    "Accelera Tire x2, Alignment x1",
		},
	}

	rows := buildOfftakeRows(raw)
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}

	if rows[0].InvoiceNo != "SI-00042" {
		t.Fatalf("expected invoice label SI-00042, got %q", rows[0].InvoiceNo)
	}

	if rows[0].QuantityTotal != 3 {
		t.Fatalf("expected quantity total 3, got %d", rows[0].QuantityTotal)
	}
}
