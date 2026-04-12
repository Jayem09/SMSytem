CREATE TABLE IF NOT EXISTS branch_suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    branch_id INT NOT NULL,
    supplier_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY idx_branch_supplier (branch_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_supplier_branch ON branch_suppliers(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_supplier_supplier ON branch_suppliers(supplier_id);

ALTER TABLE purchase_orders ADD COLUMN branch_id INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id);