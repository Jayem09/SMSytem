package config

import (
	"log"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)


type Config struct {
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	DatabaseURL string 
	ServerPort  string
	JWTSecret   string
	JWTExpiry   string
}


func Load() *Config {
	
	
	
	
	paths := []string{".env", "../.env"}

	if execPath, err := os.Executable(); err == nil {
		paths = append(paths, filepath.Join(filepath.Dir(execPath), ".env"))
		paths = append(paths, filepath.Join(filepath.Dir(execPath), "../Resources/.env"))
	}

	for _, path := range paths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("Loaded configuration from %s", path)
			break
		}
	}

	return &Config{
		DBHost:      getEnv("DB_HOST", "127.0.0.1"),
		DBPort:      getEnv("DB_PORT", "3306"),
		DBUser:      getEnv("DB_USER", "smsystem"),
		DBPassword:  getEnv("DB_PASSWORD", "smsystem_secret"),
		DBName:      getEnv("DB_NAME", "smsystem_db"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		ServerPort:  getEnv("SERVER_PORT", "8080"),
		JWTSecret:   getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
		JWTExpiry:   getEnv("JWT_EXPIRY", "24h"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
