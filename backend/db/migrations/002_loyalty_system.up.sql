-- Loyalty System MVP: Add RFID and Loyalty Points fields to customers table
ALTER TABLE customers 
ADD COLUMN rfid_card_id VARCHAR(50) DEFAULT NULL,
ADD COLUMN loyalty_points DECIMAL(10,2) DEFAULT 0;

-- Create loyalty_ledgers table for tracking points history
CREATE TABLE IF NOT EXISTS loyalty_ledgers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NOT NULL,
    order_id INT UNSIGNED,
    points_earned DECIMAL(10,2) DEFAULT 0,
    points_redeemed DECIMAL(10,2) DEFAULT 0,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_loyalty_ledgers_customer_id (customer_id),
    INDEX idx_loyalty_ledgers_order_id (order_id)
);
