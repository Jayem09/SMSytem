-- Create backups table for tracking backup history
CREATE TABLE IF NOT EXISTS backups (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    size BIGINT DEFAULT 0,
    type VARCHAR(20) DEFAULT 'manual',
    status VARCHAR(20) DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backups_created_at (created_at),
    INDEX idx_backups_type (type)
);

-- Database Indexing Recommendations
-- Run these on your MySQL database to optimize query performance

-- Orders table indexes for better query performance
-- ALTER TABLE orders ADD INDEX idx_orders_customer_id (customer_id);
-- ALTER TABLE orders ADD INDEX idx_orders_created_at (created_at);
-- ALTER TABLE orders ADD INDEX idx_orders_status (status);
-- ALTER TABLE orders ADD INDEX idx_orders_branch_id (branch_id);

-- Order items indexes
-- ALTER TABLE order_items ADD INDEX idx_order_items_order_id (order_id);
-- ALTER TABLE order_items ADD INDEX idx_order_items_product_id (product_id);

-- Products indexes
-- ALTER TABLE products ADD INDEX idx_products_category_id (category_id);
-- ALTER TABLE products ADD INDEX idx_products_brand_id (brand_id);
-- ALTER TABLE products ADD INDEX idx_products_status (status);
-- ALTER TABLE products ADD INDEX idx_products_sku (sku);

-- Inventory indexes
-- ALTER TABLE inventory ADD INDEX idx_inventory_product_id (product_id);
-- ALTER TABLE inventory ADD INDEX idx_inventory_branch_id (branch_id);
-- ALTER TABLE inventory ADD INDEX idx_inventory_quantity (quantity);

-- Customers indexes
-- ALTER TABLE customers ADD INDEX idx_customers_phone (phone);
-- ALTER TABLE customers ADD INDEX idx_customers_email (email);
-- ALTER TABLE customers ADD INDEX idx_customers_rfid (rfid_card_id);

-- Loyalty ledger indexes
-- ALTER TABLE loyalty_ledgers ADD INDEX idx_loyalty_customer_id (customer_id);
-- ALTER TABLE loyalty_ledgers ADD INDEX idx_loyalty_order_id (order_id);
-- ALTER TABLE loyalty_ledgers ADD INDEX idx_loyalty_created_at (created_at);

-- Stock transfers indexes
-- ALTER TABLE stock_transfers ADD INDEX idx_transfers_from_branch (from_branch_id);
-- ALTER TABLE stock_transfers ADD INDEX idx_transfers_to_branch (to_branch_id);
-- ALTER TABLE stock_transfers ADD INDEX idx_transfers_status (status);

-- Users indexes
-- ALTER TABLE users ADD INDEX idx_users_branch_id (branch_id);
-- ALTER TABLE users ADD INDEX idx_users_role (role);