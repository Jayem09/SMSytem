package db

import (
	"embed"
	"fmt"
	"log"
	"regexp"
	"sort"
	"strings"

	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type Migration struct {
	Version int
	UpSQL   string
	DownSQL string
}

// RunMigrations runs all pending migrations
func RunMigrations(db *gorm.DB) error {
	log.Println("Running database migrations...")

	// Create indexes for stock_transfers if they don't exist
	// MySQL doesn't support CREATE INDEX IF NOT EXISTS, so we check first with a raw query
	var count int
	db.Raw("SELECT COUNT(*) FROM information_schema.statistics WHERE table_name = 'stock_transfers' AND index_name = 'idx_stock_transfers_source_status' AND table_schema = DATABASE()").Scan(&count)
	if count == 0 {
		db.Exec("CREATE INDEX idx_stock_transfers_source_status ON stock_transfers(source_branch_id, status)")
	}
	db.Raw("SELECT COUNT(*) FROM information_schema.statistics WHERE table_name = 'stock_transfers' AND index_name = 'idx_stock_transfers_dest_status' AND table_schema = DATABASE()").Scan(&count)
	if count == 0 {
		db.Exec("CREATE INDEX idx_stock_transfers_dest_status ON stock_transfers(destination_branch_id, status)")
	}

	migrations, err := loadMigrations()
	if err != nil {
		return fmt.Errorf("failed to load migrations: %w", err)
	}

	if err := createMigrationsTable(db); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	for _, m := range migrations {
		applied, err := isMigrationApplied(db, m.Version)
		if err != nil {
			return fmt.Errorf("failed to check migration status: %w", err)
		}

		if applied {
			log.Printf("Migration v%d already applied, skipping", m.Version)
			continue
		}

		log.Printf("Applying migration v%d...", m.Version)
		if err := applyMigration(db, m.Version, m.UpSQL); err != nil {
			return fmt.Errorf("failed to apply migration v%d: %w", m.Version, err)
		}
		log.Printf("Migration v%d applied successfully", m.Version)
	}

	log.Println("All migrations completed")
	return nil
}

func createMigrationsTable(db *gorm.DB) error {
	return db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT PRIMARY KEY,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`).Error
}

func isMigrationApplied(db *gorm.DB, version int) (bool, error) {
	var count int64
	err := db.Raw("SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version).Scan(&count).Error
	return count > 0, err
}

func applyMigration(db *gorm.DB, version int, sql string) error {
	statements := splitSQLStatements(sql)

	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" || strings.HasPrefix(stmt, "--") {
			continue
		}

		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("statement %d failed: %w", i+1, err)
		}
	}

	return db.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version).Error
}

func splitSQLStatements(sql string) []string {
	var statements []string
	var current strings.Builder
	depth := 0
	inString := false
	stringChar := byte(0)

	for i := 0; i < len(sql); i++ {
		c := sql[i]

		if !inString && (c == '\'' || c == '"') {
			inString = true
			stringChar = c
			current.WriteByte(c)
			continue
		}

		if inString && c == stringChar {
			if i+1 < len(sql) && sql[i+1] == stringChar {
				current.WriteByte(c)
				current.WriteByte(c)
				i++
				continue
			}
			inString = false
			current.WriteByte(c)
			continue
		}

		if inString {
			current.WriteByte(c)
			continue
		}

		if c == '(' {
			depth++
			current.WriteByte(c)
			continue
		}

		if c == ')' {
			depth--
			current.WriteByte(c)
			continue
		}

		if c == ';' && depth == 0 {
			statements = append(statements, current.String())
			current.Reset()
			continue
		}

		current.WriteByte(c)
	}

	if s := strings.TrimSpace(current.String()); s != "" && !strings.HasPrefix(s, "--") {
		statements = append(statements, s)
	}

	return statements
}

func loadMigrations() ([]Migration, error) {
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return nil, err
	}

	var migrations []Migration
	upPattern := regexp.MustCompile(`(\d+)_.+\.up\.sql$`)
	downPattern := regexp.MustCompile(`(\d+)_.+\.down\.sql$`)

	versions := make(map[int]*Migration)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()

		if matches := upPattern.FindStringSubmatch(name); matches != nil {
			version := parseInt(matches[1])
			sql, err := migrationsFS.ReadFile("migrations/" + name)
			if err != nil {
				return nil, err
			}

			if versions[version] == nil {
				versions[version] = &Migration{Version: version}
			}
			versions[version].UpSQL = string(sql)
		}

		if matches := downPattern.FindStringSubmatch(name); matches != nil {
			version := parseInt(matches[1])
			sql, err := migrationsFS.ReadFile("migrations/" + name)
			if err != nil {
				return nil, err
			}

			if versions[version] == nil {
				versions[version] = &Migration{Version: version}
			}
			versions[version].DownSQL = string(sql)
		}
	}

	for _, m := range versions {
		migrations = append(migrations, *m)
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

func parseInt(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

func SeedDefaultData(db *gorm.DB) error {
	var branchCount int64
	db.Model(&struct{ Count int64 }{}).Raw("SELECT COUNT(*) as count FROM branches").Scan(&branchCount)

	if branchCount == 0 {
		if err := db.Exec("INSERT INTO branches (name, code) VALUES ('Default Branch', 'MAIN-01')").Error; err != nil {
			return err
		}
		log.Println("Default branch seeded")
	}

	var branchID uint
	if err := db.Raw("SELECT id FROM branches LIMIT 1").Scan(&branchID).Error; err == nil {
		var warehouseCount int64
		db.Raw("SELECT COUNT(*) as count FROM warehouses WHERE branch_id = ?", branchID).Scan(&warehouseCount)

		if warehouseCount == 0 {
			if err := db.Exec("INSERT INTO warehouses (name, branch_id) VALUES ('Main Warehouse', ?)", branchID).Error; err != nil {
				return err
			}
			log.Println("Default warehouse seeded")
		}
	}

	return nil
}

func DropAllTables(db *gorm.DB) error {
	tables := []string{
		"branch_suppliers",
		"stock_transfer_items",
		"stock_transfers",
		"settings",
		"stock_movements",
		"batches",
		"warehouses",
		"purchase_order_items",
		"purchase_orders",
		"activity_logs",
		"expenses",
		"order_items",
		"orders",
		"customers",
		"products",
		"suppliers",
		"brands",
		"categories",
		"users",
		"branches",
		"schema_migrations",
	}

	for _, table := range tables {
		if err := db.Exec("DROP TABLE IF EXISTS " + table).Error; err != nil {
			return fmt.Errorf("failed to drop table %s: %w", table, err)
		}
	}

	log.Println("All tables dropped")
	return nil
}

func ResetDatabase(db *gorm.DB) error {
	if err := DropAllTables(db); err != nil {
		return err
	}
	return RunMigrations(db)
}
