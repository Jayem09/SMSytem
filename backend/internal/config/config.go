package config

import (
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/joho/godotenv"
)

func parseInt(s string, defaultVal int) int {
	if v, err := strconv.Atoi(s); err == nil {
		return v
	}
	return defaultVal
}

type Config struct {
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	DatabaseURL        string
	ServerPort         string
	JWTSecret          string
	JWTExpiry          string
	RedisHost          string
	RedisPort          string
	BackupPath         string
	TerminalSimulation bool
	TerminalPort       string
	// Backup settings
	AutoBackupEnabled bool   // Enable automatic backups
	AutoBackupCron    string // Cron schedule (e.g., "0 2 * * *" = 2am daily)
	BackupRetention   int    // Number of backups to keep (default 10)
	BackupCompress    bool   // Compress backups with gzip
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

	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

	return &Config{
		DBHost:             getEnv("DB_HOST", "127.0.0.1"),
		DBPort:             getEnv("DB_PORT", "3306"),
		DBUser:             getEnv("DB_USER", "smsystem"),
		DBPassword:         getEnv("DB_PASSWORD", "smsystem_secret"),
		DBName:             getEnv("DB_NAME", "smsystem_db"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		JWTSecret:          jwtSecret,
		JWTExpiry:          getEnv("JWT_EXPIRY", "24h"),
		RedisHost:          getEnv("REDIS_HOST", "127.0.0.1"),
		RedisPort:          getEnv("REDIS_PORT", "6379"),
		BackupPath:         getEnv("BACKUP_PATH", "/var/backups/smsystem"),
		TerminalSimulation: getEnv("TERMINAL_SIMULATION", "true") == "true",
		TerminalPort:       getEnv("TERMINAL_PORT", "COM1"),
		// Backup settings
		AutoBackupEnabled: getEnv("AUTO_BACKUP_ENABLED", "false") == "true",
		AutoBackupCron:    getEnv("AUTO_BACKUP_CRON", "0 2 * * *"), // Default: 2am daily
		BackupRetention:   parseInt(getEnv("BACKUP_RETENTION", "10"), 10),
		BackupCompress:    getEnv("BACKUP_COMPRESS", "true") == "true",
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
