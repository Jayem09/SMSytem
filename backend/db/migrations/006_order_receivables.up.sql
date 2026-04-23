ALTER TABLE orders
ADD COLUMN amount_paid DOUBLE NOT NULL DEFAULT 0 AFTER total_amount,
ADD COLUMN balance_due DOUBLE NOT NULL DEFAULT 0 AFTER amount_paid,
ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' AFTER payment_method;

UPDATE orders
SET
    amount_paid = CASE
        WHEN status = 'completed' AND payment_method NOT IN ('dated_check', 'post_dated_check') THEN total_amount
        ELSE 0
    END,
    balance_due = CASE
        WHEN status = 'completed' AND payment_method IN ('dated_check', 'post_dated_check') THEN total_amount
        WHEN status = 'pending' THEN total_amount
        ELSE 0
    END,
    payment_status = CASE
        WHEN status = 'completed' AND payment_method IN ('dated_check', 'post_dated_check') THEN 'unpaid'
        WHEN status = 'pending' THEN 'unpaid'
        ELSE 'paid'
    END;

CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_balance_due ON orders(balance_due);
