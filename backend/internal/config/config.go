package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	ServerPort string
	JWTSecret  string
	JWTExpiry  string
}

// Load reads configuration from .env file and environment variables.
func Load() *Config {
	// Try loading .env from backend dir, then project root
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Println("Warning: No .env file found, using environment variables")
		}
	}

	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBUser:     getEnv("DB_USER", "smsystem"),
		DBPassword: getEnv("DB_PASSWORD", "smsystem_secret"),
		DBName:     getEnv("DB_NAME", "smsystem_db"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
		JWTSecret:  getEnv("JWT_SECRET", "default-secret-change-me"),
		JWTExpiry:  getEnv("JWT_EXPIRY", "24h"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
