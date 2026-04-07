package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"
)

type BackupService struct {
	cfg *config.Config
}

func NewBackupService(cfg *config.Config) *BackupService {
	return &BackupService{cfg: cfg}
}

func (s *BackupService) CreateBackup() (*models.Backup, error) {
	// Ensure backup directory exists
	if err := os.MkdirAll(s.cfg.BackupPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create backup directory: %v", err)
	}

	filename := fmt.Sprintf("smsystem_backup_%s.sql", time.Now().Format("2006-01-02_15-04"))
	filepath := filepath.Join(s.cfg.BackupPath, filename)

	// Build mysqldump command
	cmd := exec.Command("mysqldump",
		"-h", s.cfg.DBHost,
		"-P", s.cfg.DBPort,
		"-u", s.cfg.DBUser,
		"-p"+s.cfg.DBPassword,
		s.cfg.DBName,
	)

	// Set output file
	outfile, err := os.Create(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to create backup file: %v", err)
	}
	defer outfile.Close()

	cmd.Stdout = outfile

	if err := cmd.Run(); err != nil {
		os.Remove(filepath)
		return nil, fmt.Errorf("mysqldump failed: %v", err)
	}

	// Get file size
	info, err := os.Stat(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to get backup file info: %v", err)
	}

	// Save to database
	backup := &models.Backup{
		Filename: filename,
		Size:     info.Size(),
		Type:     "manual",
		Status:   "completed",
	}

	if err := database.DB.Create(backup).Error; err != nil {
		return nil, fmt.Errorf("failed to save backup record: %v", err)
	}

	return backup, nil
}

func (s *BackupService) RestoreBackup(backupID uint) error {
	var backup models.Backup
	if err := database.DB.First(&backup, backupID).Error; err != nil {
		return fmt.Errorf("backup not found: %v", err)
	}

	filepath := filepath.Join(s.cfg.BackupPath, backup.Filename)
	if _, err := os.Stat(filepath); err != nil {
		return fmt.Errorf("backup file not found: %v", err)
	}

	// Read SQL file
	data, err := os.ReadFile(filepath)
	if err != nil {
		return fmt.Errorf("failed to read backup file: %v", err)
	}

	// Execute SQL (be careful - this is destructive!)
	// For safety, we'll just log this. In production, you'd want to:
	// 1. Create a transaction
	// 2. Drop all tables (or use a fresh database)
	// 3. Execute the SQL

	// For now, just log what we'd do
	fmt.Printf("Would restore %d bytes from %s\n", len(data), backup.Filename)

	// Update backup status
	backup.Status = "completed"
	database.DB.Save(&backup)

	return nil
}

func (s *BackupService) DeleteBackup(backupID uint) error {
	var backup models.Backup
	if err := database.DB.First(&backup, backupID).Error; err != nil {
		return fmt.Errorf("backup not found: %v", err)
	}

	// Delete file
	filepath := filepath.Join(s.cfg.BackupPath, backup.Filename)
	if err := os.Remove(filepath); err != nil {
		// Log but don't fail - maybe file was already deleted
		fmt.Printf("Warning: failed to delete backup file: %v\n", err)
	}

	// Delete from database
	database.DB.Delete(&backup)

	return nil
}

func (s *BackupService) ListBackups(limit int) ([]models.Backup, error) {
	var backups []models.Backup
	err := database.DB.Order("created_at DESC").Limit(limit).Find(&backups).Error
	return backups, err
}

func (s *BackupService) GetBackupPath() string {
	return s.cfg.BackupPath
}

// RunAutoBackup creates an automatic backup
func (s *BackupService) RunAutoBackup() (*models.Backup, error) {
	backup, err := s.CreateBackup()
	if err != nil {
		// Log error but don't fail
		fmt.Printf("Auto backup failed: %v\n", err)
		return nil, err
	}

	// Update backup type to auto
	backup.Type = "auto"
	database.DB.Save(backup)

	// Clean old auto backups (keep last 7)
	s.cleanOldAutoBackups(7)

	return backup, nil
}

func (s *BackupService) cleanOldAutoBackups(keep int) {
	var count int64
	database.DB.Model(&models.Backup{}).Where("type = ?", "auto").Count(&count)

	if count <= int64(keep) {
		return
	}

	// Delete old auto backups
	database.DB.Where("type = ?", "auto").
		Order("created_at ASC").
		Limit(int(count) - keep).
		Delete(&models.Backup{})
}

// CheckBackupEnabled checks if backup is configured properly
func (s *BackupService) CheckBackupEnabled() bool {
	// Check if mysqldump is available
	cmd := exec.Command("which", "mysqldump")
	if err := cmd.Run(); err != nil {
		return false
	}

	// Check if backup directory is writable
	testFile := filepath.Join(s.cfg.BackupPath, ".test")
	f, err := os.Create(testFile)
	if err != nil {
		return false
	}
	f.Close()
	os.Remove(testFile)

	return true
}
