package handlers

import "testing"

func TestDashboardBranchScopeForAllBranches(t *testing.T) {
	scope := newDashboardBranchScope(0)

	if got := scope.directBranchColumn(); got != "branch_id" {
		t.Fatalf("expected direct branch column to be branch_id, got %q", got)
	}

	if got := scope.orderJoinBranchColumn(); got != "orders.branch_id" {
		t.Fatalf("expected order join branch column to be orders.branch_id, got %q", got)
	}

	if !scope.isAllBranches() {
		t.Fatal("expected branch scope to represent all branches")
	}
}

func TestDashboardBranchScopeForSpecificBranch(t *testing.T) {
	scope := newDashboardBranchScope(5)

	if scope.isAllBranches() {
		t.Fatal("expected branch scope to represent a specific branch")
	}

	query, args := scope.whereClause(scope.directBranchColumn())
	if query != "branch_id = ?" {
		t.Fatalf("expected direct where clause to target branch_id, got %q", query)
	}

	if len(args) != 1 || args[0] != uint(5) {
		t.Fatalf("expected direct where args [5], got %#v", args)
	}

	joinedQuery, joinedArgs := scope.whereClause(scope.orderJoinBranchColumn())
	if joinedQuery != "orders.branch_id = ?" {
		t.Fatalf("expected joined where clause to target orders.branch_id, got %q", joinedQuery)
	}

	if len(joinedArgs) != 1 || joinedArgs[0] != uint(5) {
		t.Fatalf("expected joined where args [5], got %#v", joinedArgs)
	}
}
