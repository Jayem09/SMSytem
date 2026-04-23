DROP INDEX idx_orders_payment_status ON orders;
DROP INDEX idx_orders_balance_due ON orders;

ALTER TABLE orders
DROP COLUMN payment_status,
DROP COLUMN balance_due,
DROP COLUMN amount_paid;
