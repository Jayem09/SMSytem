package handlers

import (
	"github.com/gin-gonic/gin"
)

func GetUintFromContext(c *gin.Context, key string) (uint, bool) {
	value, exists := c.Get(key)
	if !exists {
		return 0, false
	}

	switch v := value.(type) {
	case uint:
		return v, true
	case float64:
		return uint(v), true
	case int:
		return uint(v), true
	case int64:
		return uint(v), true
	default:
		return 0, false
	}
}

func GetUintPtrFromContext(c *gin.Context, key string) (*uint, bool) {
	value, exists := c.Get(key)
	if !exists {
		return nil, false
	}

	switch v := value.(type) {
	case uint:
		return &v, true
	case float64:
		u := uint(v)
		return &u, true
	case int:
		u := uint(v)
		return &u, true
	case int64:
		u := uint(v)
		return &u, true
	default:
		return nil, false
	}
}
