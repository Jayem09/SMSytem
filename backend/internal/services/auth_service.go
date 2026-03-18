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


type AuthService struct {
	Config *config.Config
}


func NewAuthService(cfg *config.Config) *AuthService {
	return &AuthService{Config: cfg}
}


type RegisterInput struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}


type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}


type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}


func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	
	var existing models.User
	result := database.DB.Where("email = ?", input.Email).First(&existing)
	if result.Error == nil {
		return nil, errors.New("email already registered")
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, result.Error
	}

	
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	// If this is the very first user, make them super_admin automatically
	var userCount int64
	database.DB.Model(&models.User{}).Count(&userCount)
	
	role := "pending"
	if userCount == 0 {
		role = "super_admin"
	}

	// Default to the first branch as a placeholder until admin assigns one
	var firstBranch models.Branch
	database.DB.First(&firstBranch)

	user := models.User{
		Name:     input.Name,
		Email:    input.Email,
		Password: string(hashedPassword),
		Role:     role,
		BranchID: firstBranch.ID,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return nil, errors.New("failed to create user record: " + err.Error())
	}

	
	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}


func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
	var user models.User
	result := database.DB.Where("email = ?", input.Email).First(&user)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid email or password")
		}
		return nil, result.Error
	}

	
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	
	token, err := s.GenerateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}


func (s *AuthService) GetUserByID(userID uint) (*models.User, error) {
	var user models.User
	if err := database.DB.Preload("Branch").First(&user, userID).Error; err != nil {
		return nil, errors.New("user not found")
	}
	return &user, nil
}


func (s *AuthService) GenerateToken(user models.User) (string, error) {
	duration, err := time.ParseDuration(s.Config.JWTExpiry)
	if err != nil {
		duration = 24 * time.Hour
	}

	claims := jwt.MapClaims{
		"user_id":   user.ID,
		"email":     user.Email,
		"role":      user.Role,
		"branch_id": user.BranchID,
		"exp":       time.Now().Add(duration).Unix(),
		"iat":       time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.Config.JWTSecret))
}
