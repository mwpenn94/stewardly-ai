-- Production Maturity Migration: plaid_items table for encrypted token storage
CREATE TABLE IF NOT EXISTS plaid_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  institution_id VARCHAR(100),
  institution_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  consent_expires_at BIGINT,
  last_synced_at BIGINT,
  error_code VARCHAR(100),
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_plaid_items_user_id (user_id),
  INDEX idx_plaid_items_item_id (item_id)
);
