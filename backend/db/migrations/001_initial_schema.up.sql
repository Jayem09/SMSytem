-- Create initial schema
-- Version: 001

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address VARCHAR(500),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    branch_id INT UNSIGNED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_branch_id (branch_id),
    INDEX idx_deleted_at (deleted_at)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DOUBLE NOT NULL DEFAULT 0,
    cost_price DOUBLE NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    size VARCHAR(50),
    parent_id INT UNSIGNED,
    image_url VARCHAR(500),
    category_id INT UNSIGNED,
    brand_id INT UNSIGNED,
    reorder_level INT NOT NULL DEFAULT 5,
    primary_supplier_id INT UNSIGNED,
    is_service BOOLEAN NOT NULL DEFAULT FALSE,
    pcd VARCHAR(50),
    offset_et VARCHAR(20),
    width VARCHAR(20),
    bore VARCHAR(20),
    finish VARCHAR(100),
    speed_rating VARCHAR(10),
    load_index VARCHAR(10),
    dot_code VARCHAR(20),
    ply_rating VARCHAR(10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_parent_id (parent_id),
    INDEX idx_category_id (category_id),
    INDEX idx_brand_id (brand_id),
    INDEX idx_primary_supplier_id (primary_supplier_id),
    INDEX idx_deleted_at (deleted_at)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED,
    guest_name VARCHAR(255),
    guest_phone VARCHAR(50),
    user_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    service_advisor_name VARCHAR(255),
    total_amount DOUBLE NOT NULL DEFAULT 0,
    discount_amount DOUBLE DEFAULT 0,
    discount_type VARCHAR(20) DEFAULT 'fixed',
    tax_amount DOUBLE DEFAULT 0,
    is_tax_inclusive BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(100),
    receipt_type VARCHAR(10) DEFAULT 'SI',
    tin VARCHAR(100),
    business_address VARCHAR(255),
    withholding_tax_rate DOUBLE DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_user_id (user_id),
    INDEX idx_branch_id (branch_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DOUBLE NOT NULL DEFAULT 0,
    subtotal DOUBLE NOT NULL DEFAULT 0,
    INDEX idx_order_product (order_id, product_id)
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    amount DOUBLE NOT NULL DEFAULT 0,
    category VARCHAR(100) NOT NULL,
    expense_date DATETIME NOT NULL,
    user_id INT UNSIGNED,
    branch_id INT UNSIGNED,
    product_id INT UNSIGNED,
    quantity INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_expense_date (expense_date),
    INDEX idx_user_id (user_id),
    INDEX idx_branch_id (branch_id),
    INDEX idx_product_id (product_id)
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_deleted_at (deleted_at)
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT UNSIGNED,
    user_id INT UNSIGNED NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    po_number VARCHAR(100),
    total_cost DOUBLE NOT NULL DEFAULT 0,
    order_date DATETIME NOT NULL,
    received_date DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier_id (supplier_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_cost DOUBLE NOT NULL DEFAULT 0,
    subtotal DOUBLE NOT NULL DEFAULT 0,
    INDEX idx_purchase_order_id (purchase_order_id),
    INDEX idx_product_id (product_id)
);

-- Warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact VARCHAR(255),
    branch_id INT UNSIGNED,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_branch_id (branch_id),
    INDEX idx_deleted_at (deleted_at)
);

-- Batches
CREATE TABLE IF NOT EXISTS batches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    warehouse_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    batch_number VARCHAR(100),
    quantity INT NOT NULL DEFAULT 0,
    expiry_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    INDEX idx_product_id (product_id),
    INDEX idx_warehouse_id (warehouse_id),
    INDEX idx_branch_id (branch_id),
    INDEX idx_batch_number (batch_number),
    INDEX idx_deleted_at (deleted_at)
);

-- Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    batch_id INT UNSIGNED,
    warehouse_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED,
    branch_id INT UNSIGNED NOT NULL,
    type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    reference VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product_id (product_id),
    INDEX idx_batch_id (batch_id),
    INDEX idx_warehouse_id (warehouse_id),
    INDEX idx_user_id (user_id),
    INDEX idx_branch_id (branch_id)
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(100) PRIMARY KEY,
    value TEXT
);

-- Stock Transfers
CREATE TABLE IF NOT EXISTS stock_transfers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reference_number VARCHAR(50) NOT NULL UNIQUE,
    source_branch_id INT UNSIGNED NOT NULL,
    destination_branch_id INT UNSIGNED NOT NULL,
    requested_by_user_id INT UNSIGNED NOT NULL,
    approved_by_user_id INT UNSIGNED,
    received_by_user_id INT UNSIGNED,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stock Transfer Items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stock_transfer_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    received_quantity INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_stock_transfer_id (stock_transfer_id)
);

-- Seed default branch
INSERT INTO branches (name, code) SELECT 'Default Branch', 'MAIN-01' WHERE NOT EXISTS (SELECT 1 FROM branches WHERE code = 'MAIN-01');
