package handlers

import "testing"

func TestBuildDashboardSummarySubtractsCostOfGoodsAndExpenses(t *testing.T) {
	summary := buildDashboardSummary(292512, 120000, 5000)

	if summary.TotalSales != 292512 {
		t.Fatalf("expected total sales to stay unchanged, got %v", summary.TotalSales)
	}

	if summary.TotalExpenses != 5000 {
		t.Fatalf("expected total expenses to stay unchanged, got %v", summary.TotalExpenses)
	}

	expectedNetProfit := 167512.0
	if summary.NetProfit != expectedNetProfit {
		t.Fatalf("expected net profit %v, got %v", expectedNetProfit, summary.NetProfit)
	}
}
