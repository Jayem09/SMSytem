package main

import (
	"log"
	"smsystem-backend/internal/config"
	"smsystem-backend/internal/database"
)

func main() {
	cfg := config.Load()
	database.Connect(cfg)

	log.Println("Upgrading MySQL users to new caching_sha2_password format...")

	
	database.DB.Exec("ALTER USER 'smsystem'@'%' IDENTIFIED WITH caching_sha2_password BY 'smsystem_secret';")
	database.DB.Exec("ALTER USER 'smsystem'@'localhost' IDENTIFIED WITH caching_sha2_password BY 'smsystem_secret';")
	database.DB.Exec("ALTER USER 'smsystem'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY 'smsystem_secret';")

	
	database.DB.Exec("ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '';")
	database.DB.Exec("ALTER USER 'root'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '';")

	database.DB.Exec("FLUSH PRIVILEGES;")

	log.Println("Done! The terminal client should now work.")
}
