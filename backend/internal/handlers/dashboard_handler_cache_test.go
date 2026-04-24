package handlers

import (
	"context"
	"testing"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/services"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDashboardStatsKey(t *testing.T) {
	// Test that cache key includes branch ID, role, and query params
	key := services.DashboardStatsKey(1, "super_admin", nil)
	assert.Equal(t, "dashboard:stats:1:super_admin", key, "key should include branch ID and role")

	// Test with query params (note: url.Values type)
	keyWithDays := services.DashboardStatsKey(1, "super_admin", map[string][]string{"days": {"30"}})
	assert.Contains(t, keyWithDays, "days=30", "key should include query params")

	// Test with ALL branch_id
	keyAll := services.DashboardStatsKey(0, "super_admin", map[string][]string{"branch_id": {"ALL"}})
	assert.Contains(t, keyAll, "branch_id=ALL", "key should include ALL query param")
}

func TestDashboardCacheTTL(t *testing.T) {
	// Verify TTL for dashboard stats is 20 seconds as per spec
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:     mini.Host(),
		RedisPort:     mini.Port(),
		CacheDefaultTTL: "20s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := map[string]interface{}{
		"total_sales": 1000.0,
	}
	err = cacheSvc.SetJSON(ctx, "dashboard:stats:1:super_admin", testData, 20*time.Second)
	require.NoError(t, err)

	// Verify TTL is approximately 20 seconds (allow some margin)
	ttl := mini.TTL("dashboard:stats:1:super_admin")
	assert.True(t, ttl > 15*time.Second && ttl <= 20*time.Second,
		"TTL should be approximately 20 seconds, got %v", ttl)
}

func TestDashboardReadThrough(t *testing.T) {
	// Test read-through caching pattern
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:     mini.Host(),
		RedisPort:     mini.Port(),
		CacheDefaultTTL: "20s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := map[string]interface{}{
		"total_sales": 5000.0,
		"order_count": 10,
	}

	// Pre-populate cache
	err = cacheSvc.SetJSON(ctx, services.DashboardStatsKey(1, "super_admin", nil), testData, 20*time.Second)
	require.NoError(t, err)

	// Test read-through works
	var result map[string]interface{}
	found, err := cacheSvc.GetJSON(ctx, services.DashboardStatsKey(1, "super_admin", nil), &result)
	assert.True(t, found, "should find cached data")
	assert.NoError(t, err)
	assert.Equal(t, 5000.0, result["total_sales"])
}

func TestDashboardInvalidation(t *testing.T) {
	// Test that InvalidateDashboard clears all dashboard cache entries
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:     mini.Host(),
		RedisPort:     mini.Port(),
		CacheDefaultTTL: "20s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := map[string]interface{}{"total_sales": 1000.0}

	// Set multiple dashboard cache entries
	_ = cacheSvc.SetJSON(ctx, services.DashboardStatsKey(1, "super_admin", nil), testData, 20*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.DashboardStatsKey(1, "super_admin", map[string][]string{"days": {"30"}}), testData, 20*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.DashboardStatsKey(2, "admin", nil), testData, 20*time.Second)

	// Verify they exist
	assert.True(t, mini.Exists("dashboard:stats:1:super_admin"))
	assert.True(t, mini.Exists("dashboard:stats:2:admin"))

	// Invalidate and verify all cleared
	err = cacheSvc.InvalidateDashboard(ctx)
	assert.NoError(t, err)

	// Give Redis time to process
	time.Sleep(50 * time.Millisecond)

	// Verify prefix-based deletion worked
	assert.False(t, mini.Exists("dashboard:stats:1:super_admin"))
	assert.False(t, mini.Exists("dashboard:stats:2:admin"))
}

func TestNewDashboardHandlerAcceptsCacheService(t *testing.T) {
	// Verify NewDashboardHandler accepts nil cache service (backward compatible)
	handler := NewDashboardHandler(nil)
	assert.NotNil(t, handler)
	assert.Nil(t, handler.CacheService)
}