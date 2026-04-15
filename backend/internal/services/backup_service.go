package services

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

func (s *BackupService) backupFilePath(filename string) string {
	return filepath.Join(s.cfg.BackupPath, filename)
}

func (s *BackupService) ensureBackupDir() error {
	return os.MkdirAll(s.cfg.BackupPath, 0755)
}

func (s *BackupService) ensureCommandAvailable(name string) error {
	if _, err := exec.LookPath(name); err != nil {
		return fmt.Errorf("%s is not installed or not available in PATH", name)
	}
	return nil
}

func (s *BackupService) mysqlCommand(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.Env = append(os.Environ(), "MYSQL_PWD="+s.cfg.DBPassword)
	return cmd
}

func (s *BackupService) GetBackup(backupID uint) (*models.Backup, error) {
	var backup models.Backup
	if err := database.DB.First(&backup, backupID).Error; err != nil {
		return nil, fmt.Errorf("backup not found: %v", err)
	}
	return &backup, nil
}

func (s *BackupService) CreateBackup() (*models.Backup, error) {
	if err := s.ensureBackupDir(); err != nil {
		return nil, fmt.Errorf("failed to create backup directory: %v", err)
	}
	if err := s.ensureCommandAvailable("mysqldump"); err != nil {
		return nil, err
	}

	filename := fmt.Sprintf("smsystem_backup_%s.sql", time.Now().Format("2006-01-02_15-04"))
	backupPath := s.backupFilePath(filename)

	cmd := s.mysqlCommand("mysqldump",
		"-h", s.cfg.DBHost,
		"-P", s.cfg.DBPort,
		"-u", s.cfg.DBUser,
		"--single-transaction",
		"--quick",
		"--routines",
		"--triggers",
		s.cfg.DBName,
	)

	outfile, err := os.Create(backupPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create backup file: %v", err)
	}
	defer outfile.Close()

	cmd.Stdout = outfile
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		_ = os.Remove(backupPath)
		details := strings.TrimSpace(stderr.String())
		if details != "" {
			return nil, fmt.Errorf("mysqldump failed: %v: %s", err, details)
		}
		return nil, fmt.Errorf("mysqldump failed: %v", err)
	}

	if err := outfile.Sync(); err != nil {
		_ = os.Remove(backupPath)
		return nil, fmt.Errorf("failed to flush backup file: %v", err)
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		return nil, fmt.Errorf("failed to get backup file info: %v", err)
	}
	if info.Size() == 0 {
		_ = os.Remove(backupPath)
		return nil, fmt.Errorf("backup file was created but is empty")
	}

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
	if err := s.ensureCommandAvailable("mysql"); err != nil {
		return err
	}
	backup, err := s.GetBackup(backupID)
	if err != nil {
		return err
	}

	backupPath := s.backupFilePath(backup.Filename)
	info, err := os.Stat(backupPath)
	if err != nil {
		return fmt.Errorf("backup file not found: %v", err)
	}
	if info.Size() == 0 {
		return fmt.Errorf("backup file is empty")
	}

	infile, err := os.Open(backupPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %v", err)
	}
	defer infile.Close()

	cmd := s.mysqlCommand("mysql",
		"-h", s.cfg.DBHost,
		"-P", s.cfg.DBPort,
		"-u", s.cfg.DBUser,
		s.cfg.DBName,
	)
	cmd.Stdin = infile
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	backup.Status = "in_progress"
	_ = database.DB.Save(backup).Error

	if err := cmd.Run(); err != nil {
		backup.Status = "failed"
		_ = database.DB.Save(backup).Error
		details := strings.TrimSpace(stderr.String())
		if details != "" {
			return fmt.Errorf("mysql restore failed: %v: %s", err, details)
		}
		return fmt.Errorf("mysql restore failed: %v", err)
	}

	backup.Status = "completed"
	if err := database.DB.Save(backup).Error; err != nil {
		return fmt.Errorf("restore completed but failed to update backup status: %v", err)
	}

	return nil
}

func (s *BackupService) DeleteBackup(backupID uint) error {
	backup, err := s.GetBackup(backupID)
	if err != nil {
		return err
	}

	backupPath := s.backupFilePath(backup.Filename)
	if err := os.Remove(backupPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete backup file: %v", err)
	}

	if err := database.DB.Delete(backup).Error; err != nil {
		return fmt.Errorf("failed to delete backup record: %v", err)
	}

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
	var oldBackups []models.Backup
	if err := database.DB.Where("type = ?", "auto").
		Order("created_at DESC").
		Offset(keep).
		Find(&oldBackups).Error; err != nil {
		return
	}

	for _, backup := range oldBackups {
		_ = s.DeleteBackup(backup.ID)
	}
}

// CheckBackupEnabled checks if backup is configured properly
func (s *BackupService) CheckBackupEnabled() bool {
	if err := s.ensureCommandAvailable("mysqldump"); err != nil {
		return false
	}

	if err := s.ensureBackupDir(); err != nil {
		return false
	}

	testFile := filepath.Join(s.cfg.BackupPath, ".test")
	f, err := os.Create(testFile)
	if err != nil {
		return false
	}
	f.Close()
	os.Remove(testFile)

	return true
}
