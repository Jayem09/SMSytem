package handlers

type dashboardSummary struct {
	TotalSales    float64
	TotalExpenses float64
	NetProfit     float64
}

func buildDashboardSummary(totalSales, totalCostOfGoods, totalExpenses float64) dashboardSummary {
	return dashboardSummary{
		TotalSales:    totalSales,
		TotalExpenses: totalExpenses,
		NetProfit:     totalSales - totalCostOfGoods - totalExpenses,
	}
}
