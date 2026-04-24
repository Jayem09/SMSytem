package config

import (
	"fmt"
	"os"
	"time"
)

func Validate(cfg *Config) error {
	if cfg.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET environment variable is required")
	}

	if len(cfg.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters for security")
	}

	if cfg.DBHost == "" {
		return fmt.Errorf("DB_HOST environment variable is required")
	}

	if cfg.CacheEnabled {
		if _, ok := os.LookupEnv("REDIS_HOST"); !ok || cfg.RedisHost == "" {
			return fmt.Errorf("REDIS_HOST environment variable is required when CACHE_ENABLED=true")
		}

		if _, ok := os.LookupEnv("REDIS_PORT"); !ok || cfg.RedisPort == "" {
			return fmt.Errorf("REDIS_PORT environment variable is required when CACHE_ENABLED=true")
		}
	}

	if cfg.CacheDefaultTTL != "" {
		if _, err := time.ParseDuration(cfg.CacheDefaultTTL); err != nil {
			return fmt.Errorf("CACHE_DEFAULT_TTL must be a valid duration: %w", err)
		}
	}

	return nil
}

func MustValidate(cfg *Config) {
	if err := Validate(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "Configuration validation failed: %v\n", err)
		os.Exit(1)
	}
}
