package handlers

import "gorm.io/gorm"

type dashboardBranchScope struct {
	branchID uint
}

func newDashboardBranchScope(branchID uint) dashboardBranchScope {
	return dashboardBranchScope{branchID: branchID}
}

func (s dashboardBranchScope) isAllBranches() bool {
	return s.branchID == 0
}

func (s dashboardBranchScope) directBranchColumn() string {
	return "branch_id"
}

func (s dashboardBranchScope) orderJoinBranchColumn() string {
	return "orders.branch_id"
}

func (s dashboardBranchScope) whereClause(column string) (string, []interface{}) {
	if s.isAllBranches() {
		return "", nil
	}

	return column + " = ?", []interface{}{s.branchID}
}

func (s dashboardBranchScope) apply(query *gorm.DB, column string) *gorm.DB {
	whereClause, args := s.whereClause(column)
	if whereClause == "" {
		return query
	}

	return query.Where(whereClause, args...)
}
