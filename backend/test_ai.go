package main

import (
	"fmt"
	"smsystem-backend/internal/handlers"
	"os"
)

func main() {
    client := handlers.NewOllamaClient()
    resp, err := client.GenerateWithQuestion("Are there any stock transfers currently pending?", "1")
    if err != nil {
        fmt.Println("Error:", err)
    }
    fmt.Println("RESPONSE:", resp)
}
