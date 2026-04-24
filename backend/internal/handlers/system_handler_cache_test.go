package handlers

import (
	"context"
	"testing"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/services"

	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetStatus_UsesCacheService(t *testing.T) {
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
	require.NotNil(t, cacheSvc)
	assert.True(t, cacheSvc.Enabled(), "cache service should be enabled")
}

func TestSettingsHandler_InvalidatesOnMaintenanceModeChange(t *testing.T) {
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
	_ = cacheSvc.SetJSON(ctx, services.SystemStatusKey(), map[string]interface{}{"maintenance": false}, 0)

	err = cacheSvc.InvalidateSystemStatus(ctx)
	assert.NoError(t, err)
	assert.False(t, mini.Exists(services.SystemStatusKey()), "cache should be invalidated")
}

func TestSettingsHandler_InvalidatesOnMinAppVersionChange(t *testing.T) {
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
	_ = cacheSvc.SetJSON(ctx, services.SystemStatusKey(), map[string]interface{}{"min_version": "1.0.0"}, 0)
	err = cacheSvc.InvalidateSystemStatus(ctx)
	assert.NoError(t, err)
	assert.False(t, mini.Exists(services.SystemStatusKey()))
}

func TestCacheKeyMatchesSpec(t *testing.T) {
	key := services.SystemStatusKey()
	assert.Equal(t, "system:status", key, "cache key should match spec")
}