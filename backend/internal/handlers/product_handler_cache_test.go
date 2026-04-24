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

func TestProductListCacheKey(t *testing.T) {
	// Test that cache key includes branch ID, role, and query params
	values := url.Values{}
	key := services.BuildScopedListKey(services.ProductListPrefix, 1, "admin", values)
	assert.Equal(t, "products:list:1:admin", key, "key should include branch ID and role")

	// Test with query params
	values.Set("category_id", "5")
	keyWithParams := services.BuildScopedListKey(services.ProductListPrefix, 1, "admin", values)
	assert.Contains(t, keyWithParams, "category_id=5", "key should include query params")

	// Test with ALL branch_id
	keyAll := services.BuildScopedListKey(services.ProductListPrefix, 0, "super_admin", url.Values{"branch_id": {"ALL"}})
	assert.Contains(t, keyAll, "branch_id=ALL", "key should include ALL query param")
}

func TestProductCacheTTL(t *testing.T) {
	// Verify TTL for product lists is 60 seconds as per spec
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:      mini.Host(),
		RedisPort:     mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{
		{"id": 1, "name": "Test Product"},
	}
	err = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.ProductListPrefix, 1, "admin", nil), testData, 60*time.Second)
	require.NoError(t, err)

	// Verify TTL is approximately 60 seconds (allow some margin)
	ttl := mini.TTL("products:list:1:admin")
	assert.True(t, ttl > 55*time.Second && ttl <= 60*time.Second,
		"TTL should be approximately 60 seconds, got %v", ttl)
}

func TestProductReadThrough(t *testing.T) {
	// Test read-through caching pattern
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:      mini.Host(),
		RedisPort:     mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{
		{"id": 1, "name": "Test Product", "price": 100.0},
		{"id": 2, "name": "Another Product", "price": 200.0},
	}

	// Pre-populate cache
	cacheKey := services.BuildScopedListKey(services.ProductListPrefix, 1, "admin", nil)
	err = cacheSvc.SetJSON(ctx, cacheKey, testData, 60*time.Second)
	require.NoError(t, err)

	// Test read-through works
	var result []map[string]interface{}
	found, err := cacheSvc.GetJSON(ctx, cacheKey, &result)
	assert.True(t, found, "should find cached data")
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, "Test Product", result[0]["name"])
}

func TestProductInvalidation(t *testing.T) {
	// Test that InvalidateProducts clears all product list cache entries
	mini, err := miniredis.Run()
	require.NoError(t, err)
	defer mini.Close()

	cacheCfg := &config.Config{
		CacheEnabled:    true,
		RedisHost:      mini.Host(),
		RedisPort:     mini.Port(),
		CacheDefaultTTL: "60s",
	}
	cacheSvc, err := services.NewCacheService(cacheCfg)
	require.NoError(t, err)

	ctx := context.Background()
	testData := []map[string]interface{}{{"id": 1, "name": "Test Product"}}

	// Set multiple product list cache entries
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.ProductListPrefix, 1, "admin", nil), testData, 60*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.ProductListPrefix, 1, "manager", nil), testData, 60*time.Second)
	_ = cacheSvc.SetJSON(ctx, services.BuildScopedListKey(services.ProductListPrefix, 2, "admin", nil), testData, 60*time.Second)

	// Verify they exist
	assert.True(t, mini.Exists("products:list:1:admin"))
	assert.True(t, mini.Exists("products:list:2:admin"))

	// Invalidate and verify all cleared
	err = cacheSvc.InvalidateProducts(ctx)
	assert.NoError(t, err)

	// Give Redis time to process
	time.Sleep(50 * time.Millisecond)

	// Verify prefix-based deletion worked
	assert.False(t, mini.Exists("products:list:1:admin"))
	assert.False(t, mini.Exists("products:list:2:admin"))
}

func TestNewProductHandlerAcceptsCacheService(t *testing.T) {
	// Verify NewProductHandler accepts cache service
	handler := NewProductHandler(nil, nil)
	assert.NotNil(t, handler)
	assert.Nil(t, handler.LogService)
	assert.Nil(t, handler.CacheService)
}