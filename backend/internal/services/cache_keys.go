package services

import (
	"net/url"
	"strconv"
	"sort"
	"strings"
)

const (
	DashboardPrefix    = "dashboard:stats:"
	SystemStatusPrefix = "system:status"
	ProductListPrefix  = "products:list:"
	CustomerListPrefix = "customers:list:"
	BranchListPrefix   = "branches:list:"
)

func SystemStatusKey() string {
	return SystemStatusPrefix
}

func DashboardStatsKey(branchID uint, role string, values url.Values) string {
	return BuildScopedListKey(DashboardPrefix, branchID, role, values)
}

func BuildScopedListKey(prefix string, branchID uint, role string, values url.Values) string {
	base := prefix + uintKeyPart(branchID) + ":" + role
	query := normalizeQuery(values)
	if query == "" {
		return base
	}
	return base + ":" + query
}

func uintKeyPart(value uint) string {
	return strconv.FormatUint(uint64(value), 10)
}

func normalizeQuery(values url.Values) string {
	if len(values) == 0 {
		return ""
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	parts := make([]string, 0)
	for _, key := range keys {
		items := append([]string(nil), values[key]...)
		sort.Strings(items)
		escapedKey := url.QueryEscape(key)
		for _, item := range items {
			parts = append(parts, escapedKey+"="+url.QueryEscape(item))
		}
	}

	return strings.Join(parts, "&")
}
