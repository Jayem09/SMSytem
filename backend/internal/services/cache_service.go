package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"smsystem-backend/internal/config"

	"github.com/redis/go-redis/v9"
)

type CacheService struct {
	client     *redis.Client
	enabled    bool
	defaultTTL time.Duration
}

const defaultCacheTTL = 5 * time.Minute

func NewCacheService(cfg *config.Config) (*CacheService, error) {
	service := &CacheService{}
	if cfg == nil || !cfg.CacheEnabled {
		return service, nil
	}

	defaultTTL := defaultCacheTTL
	if cfg.CacheDefaultTTL != "" {
		parsedTTL, err := time.ParseDuration(cfg.CacheDefaultTTL)
		if err != nil {
			return nil, fmt.Errorf("parse cache default ttl: %w", err)
		}
		defaultTTL = parsedTTL
	}

	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
		Password: cfg.RedisPassword,
	})

	service.client = client
	service.defaultTTL = defaultTTL
	service.enabled = true

	if err := client.Ping(context.Background()).Err(); err != nil {
		service.enabled = false
		return service, err
	}

	return service, nil
}

func (s *CacheService) Enabled() bool {
	return s != nil && s.enabled && s.client != nil
}

func (s *CacheService) GetJSON(ctx context.Context, key string, target any) (bool, error) {
	if !s.Enabled() {
		return false, nil
	}

	value, err := s.client.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if err := json.Unmarshal(value, target); err != nil {
		return false, err
	}

	return true, nil
}

func (s *CacheService) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if !s.Enabled() {
		return nil
	}

	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}

	if ttl <= 0 {
		ttl = s.defaultTTL
	}

	return s.client.Set(ctx, key, payload, ttl).Err()
}

func (s *CacheService) DeleteByPrefixes(ctx context.Context, prefixes ...string) error {
	if !s.Enabled() {
		return nil
	}

	for _, prefix := range prefixes {
		var cursor uint64
		for {
			keys, next, err := s.client.Scan(ctx, cursor, prefix+"*", 100).Result()
			if err != nil {
				return err
			}
			if len(keys) > 0 {
				if err := s.client.Del(ctx, keys...).Err(); err != nil {
					return err
				}
			}
			cursor = next
			if cursor == 0 {
				break
			}
		}
	}

	return nil
}

func (s *CacheService) InvalidateDashboard(ctx context.Context) error {
	return s.DeleteByPrefixes(ctx, DashboardPrefix)
}

func (s *CacheService) InvalidateSystemStatus(ctx context.Context) error {
	return s.DeleteByPrefixes(ctx, SystemStatusPrefix)
}

func (s *CacheService) InvalidateProducts(ctx context.Context) error {
	return s.DeleteByPrefixes(ctx, ProductListPrefix)
}

func (s *CacheService) InvalidateCustomers(ctx context.Context) error {
	return s.DeleteByPrefixes(ctx, CustomerListPrefix)
}

func (s *CacheService) InvalidateBranches(ctx context.Context) error {
	return s.DeleteByPrefixes(ctx, BranchListPrefix)
}
