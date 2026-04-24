package handlers

import (
	"context"
	"net/url"
	"testing"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/services"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ==================== Customer Cache Tests ====================

func TestCustomerListCacheKey(t *testing.T) {
	// Test that cache key includes branch ID, role, and query params
	values := url.Values{}
	key := services.BuildScopedListKey(services.CustomerListPrefix, 1, "admin", values)
	assert.Equal(t, "customers:list:1:admin", key, "key should include branch ID and role")

	// Test with query params
	values.Set("search", "john")
	keyWithParams := services.BuildScopedListKey(services.CustomerListPrefix, 1, "admin", values)
	assert.Contains(t, keyWithParams, "search=john", "key should include query params")
}

func TestCustomerCacheTTL(t *testing.T) {
	// Verify TTL for customer lists is 60 seconds as per spec
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:     true,
		RedisHost:       mini.Host(),
		RedisPort:       mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{
		{"id": 1, "name": "Test Customer"},
	}
	err = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.CustomerListPrefix, 1, "admin", nil), testData, 60*time.Second)
	require.NoError(t, err)

	// Verify TTL is approximately 60 seconds (allow some margin)
	ttl := mini.TTL("customers:list:1:admin")
	assert.True(t, ttl > 55*time.Second && ttl <= 60*time.Second,
		"TTL should be approximately 60 seconds, got %v", ttl)
}

func TestCustomerReadThrough(t *testing.T) {
	// Test read-through caching pattern
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:    mini.Host(),
		RedisPort:   mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{
		{"id": 1, "name": "Test Customer"},
		{"id": 2, "name": "Another Customer"},
	}

	// Pre-populate cache
	cacheKey := services.BuildScopedListKey(services.CustomerListPrefix, 1, "admin", nil)
	err = cacheSvc.SetJSON(ctx, cacheKey, testData, 60*time.Second)
	require.NoError(t, err)

	// Test read-through works
	var result []map[string]interface{}
	found, err := cacheSvc.GetJSON(ctx, cacheKey, &result)
	assert.True(t, found, "should find cached data")
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, "Test Customer", result[0]["name"])
}

func TestCustomerInvalidation(t *testing.T) {
	// Test that InvalidateCustomers clears all customer list cache entries
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:    mini.Host(),
		RedisPort:   mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{{"id": 1, "name": "Test Customer"}}

	// Set multiple customer list cache entries
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.CustomerListPrefix, 1, "admin", nil), testData, 60*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.CustomerListPrefix, 1, "manager", nil), testData, 60*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.CustomerListPrefix, 2, "admin", nil), testData, 60*time.Second)

	// Verify they exist
	assert.True(t, mini.Exists("customers:list:1:admin"))
	assert.True(t, mini.Exists("customers:list:2:admin"))

	// Invalidate and verify all cleared
	err = cacheSvc.InvalidateCustomers(ctx)
	assert.NoError(t, err)

	// Give Redis time to process
	time.Sleep(50 * time.Millisecond)

	// Verify prefix-based deletion worked
	assert.False(t, mini.Exists("customers:list:1:admin"))
	assert.False(t, mini.Exists("customers:list:2:admin"))
}

func TestNewCustomerHandlerAcceptsCacheService(t *testing.T) {
	// Verify NewCustomerHandler accepts cache service
	handler := NewCustomerHandler(nil, nil)
	assert.NotNil(t, handler)
	assert.Nil(t, handler.LogService)
	assert.Nil(t, handler.CacheService)
}

// ==================== Branch Cache Tests ====================

func TestBranchListCacheKey(t *testing.T) {
	// Test that cache key includes branch ID, role, and query params
	values := url.Values{}
	key := services.BuildScopedListKey(services.BranchListPrefix, 1, "admin", values)
	assert.Equal(t, "branches:list:1:admin", key, "key should include branch ID and role")

	// Test with query params
	values.Set("active", "true")
	keyWithParams := services.BuildScopedListKey(services.BranchListPrefix, 1, "admin", values)
	assert.Contains(t, keyWithParams, "active=true", "key should include query params")
}

func TestBranchCacheTTL(t *testing.T) {
	// Verify TTL for branch lists is 60 seconds as per spec
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:    mini.Host(),
		RedisPort:   mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{
		{"id": 1, "name": "Test Branch"},
	}
	err = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.BranchListPrefix, 1, "admin", nil), testData, 60*time.Second)
	require.NoError(t, err)

	// Verify TTL is approximately 60 seconds (allow some margin)
	ttl := mini.TTL("branches:list:1:admin")
	assert.True(t, ttl > 55*time.Second && ttl <= 60*time.Second,
		"TTL should be approximately 60 seconds, got %v", ttl)
}

func TestBranchReadThrough(t *testing.T) {
	// Test read-through caching pattern
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:    mini.Host(),
		RedisPort:   mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{
		{"id": 1, "name": "Branch A"},
		{"id": 2, "name": "Branch B"},
	}

	// Pre-populate cache
	cacheKey := services.BuildScopedListKey(services.BranchListPrefix, 1, "admin", nil)
	err = cacheSvc.SetJSON(ctx, cacheKey, testData, 60*time.Second)
	require.NoError(t, err)

	// Test read-through works
	var result []map[string]interface{}
	found, err := cacheSvc.GetJSON(ctx, cacheKey, &result)
	assert.True(t, found, "should find cached data")
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, "Branch A", result[0]["name"])
}

func TestBranchInvalidation(t *testing.T) {
	// Test that InvalidateBranches clears all branch list cache entries
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:    mini.Host(),
		RedisPort:   mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{{"id": 1, "name": "Test Branch"}}

	// Set multiple branch list cache entries
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.BranchListPrefix, 1, "admin", nil), testData, 60*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.BranchListPrefix, 1, "manager", nil), testData, 60*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.BranchListPrefix, 2, "admin", nil), testData, 60*time.Second)

	// Verify they exist
	assert.True(t, mini.Exists("branches:list:1:admin"))
	assert.True(t, mini.Exists("branches:list:2:admin"))

	// Invalidate and verify all cleared
	err = cacheSvc.InvalidateBranches(ctx)
	assert.NoError(t, err)

	// Give Redis time to process
	time.Sleep(50 * time.Millisecond)

	// Verify prefix-based deletion worked
	assert.False(t, mini.Exists("branches:list:1:admin"))
	assert.False(t, mini.Exists("branches:list:2:admin"))
}

func TestNewBranchHandlerAcceptsCacheService(t *testing.T) {
	// Verify NewBranchHandler accepts cache service
	handler := NewBranchHandler(nil, nil)
	assert.NotNil(t, handler)
	assert.Nil(t, handler.LogService)
	assert.Nil(t, handler.CacheService)
}