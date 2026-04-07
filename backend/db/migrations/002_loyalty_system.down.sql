-- Rollback Loyalty System MVP
DROP TABLE IF EXISTS loyalty_ledgers;
ALTER TABLE customers 
DROP COLUMN rfid_card_id,
DROP COLUMN loyalty_points;
