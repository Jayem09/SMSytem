package main

import (
	"flag"
	"fmt"
	"log"

	migrate "smsystem-backend/db"
	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"

	"gorm.io/gorm"
)

func main() {
	flag.Parse()

	upCmd := flag.NewFlagSet("up", flag.ExitOnError)
	downCmd := flag.NewFlagSet("down", flag.ExitOnError)
	resetCmd := flag.NewFlagSet("reset", flag.ExitOnError)
	statusCmd := flag.NewFlagSet("status", flag.ExitOnError)

	if len(flag.Args()) < 1 {
		printUsage()
		return
	}

	cfg := config.Load()
	database.Connect(cfg)
	databaseDB := database.DB

	switch flag.Args()[0] {
	case "up":
		if err := upCmd.Parse(flag.Args()[1:]); err != nil {
			log.Fatalf("Failed to parse up command flags: %v", err)
		}
		runUp(databaseDB)
	case "down":
		if err := downCmd.Parse(flag.Args()[1:]); err != nil {
			log.Fatalf("Failed to parse down command flags: %v", err)
		}
		runDown(databaseDB)
	case "reset":
		if err := resetCmd.Parse(flag.Args()[1:]); err != nil {
			log.Fatalf("Failed to parse reset command flags: %v", err)
		}
		runReset(databaseDB)
	case "status":
		if err := statusCmd.Parse(flag.Args()[1:]); err != nil {
			log.Fatalf("Failed to parse status command flags: %v", err)
		}
		runStatus(databaseDB)
	default:
		printUsage()
	}
}

func printUsage() {
	fmt.Println("Usage: go run cmd/migrate/main.go <command>")
	fmt.Println("\nCommands:")
	fmt.Println("  up      - Run all pending migrations")
	fmt.Println("  down    - Rollback the last migration")
	fmt.Println("  reset   - Drop all tables and re-run migrations")
	fmt.Println("  status  - Show migration status")
}

func runUp(db *gorm.DB) {
	if err := db.Exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)").Error; err != nil {
		log.Fatalf("Failed to create migrations table: %v", err)
	}

	if err := migrate.RunMigrations(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Migrations completed successfully")
}

func runDown(db *gorm.DB) {
	log.Println("Rollback not implemented - use 'reset' to rebuild database")
}

func runReset(db *gorm.DB) {
	fmt.Print("This will DROP ALL TABLES. Are you sure? (yes/no): ")
	var confirm string
	if _, err := fmt.Scanln(&confirm); err != nil {
		log.Fatalf("Failed to read confirmation: %v", err)
	}

	if confirm != "yes" {
		log.Println("Aborted")
		return
	}

	if err := migrate.ResetDatabase(db); err != nil {
		log.Fatalf("Failed to reset database: %v", err)
	}
	log.Println("Database reset completed")
}

func runStatus(db *gorm.DB) {
	rows, err := db.Raw("SELECT version, applied_at FROM schema_migrations ORDER BY version DESC").Rows()
	if err != nil {
		log.Fatalf("Failed to get migration status: %v", err)
	}
	defer rows.Close()

	fmt.Println("\nMigration Status:")
	fmt.Println("-----------------")

	var hasMigrations bool
	for rows.Next() {
		hasMigrations = true
		var version int
		var appliedAt interface{}
		if err := rows.Scan(&version, &appliedAt); err != nil {
			log.Fatalf("Failed to scan migration status row: %v", err)
		}
		fmt.Printf("  v%d - Applied\n", version)
	}

	if err := rows.Err(); err != nil {
		log.Fatalf("Failed while iterating migration status rows: %v", err)
	}

	if !hasMigrations {
		fmt.Println("  No migrations applied")
	}

	fmt.Println()
}
