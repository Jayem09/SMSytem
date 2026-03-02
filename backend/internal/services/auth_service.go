package services

import (
	"errors"
	"time"

	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
	"smsystem-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService handles authentication business logic.
type AuthService struct {
	Config *config.Config
}

// NewAuthService creates a new AuthService instance.
func NewAuthService(cfg *config.Config) *AuthService {
	return &AuthService{Config: cfg}
}

// RegisterInput holds data needed to register a new user.
type RegisterInput struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginInput holds data needed to log in.
type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse is returned after successful login/register.
type AuthResponse struct {
	Token string       `json:"token"`
	User  models.User  `json:"user"`
}

// Register creates a new user account.
func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	// Check if email already exists
	var existing models.User
	result := database.DB.Where("email = ?", input.Email).First(&existing)
	if result.Error == nil {
		return nil, errors.New("email already registered")
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, result.Error
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	user := models.User{
		Name:     input.Name,
		Email:    input.Email,
		Password: string(hashedPassword),
		Role:     "user",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return nil, errors.New("failed to create user")
	}

	// Generate token
	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}

// Login authenticates a user and returns a JWT token.
func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
	var user models.User
	result := database.DB.Where("email = ?", input.Email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid email or password")
		}
		return nil, result.Error
	}

	// Compare passwords
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Generate token
	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}

// GetUserByID retrieves a user by their ID.
func (s *AuthService) GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return &user, nil
}

// GenerateToken creates a JWT token for the given user.
func (s *AuthService) GenerateToken(user models.User) (string, error) {
	duration, err := time.ParseDuration(s.Config.JWTExpiry)
	if err != nil {
		duration = 24 * time.Hour
	}

	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(duration).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.Config.JWTSecret))
}
