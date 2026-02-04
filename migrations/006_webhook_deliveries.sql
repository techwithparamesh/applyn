-- Migration: Add webhook_deliveries table for durable webhook delivery + retries
-- Run this on your VPS: mysql -u applyn -p applyn < migrations/006_webhook_deliveries.sql

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  webhook_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  app_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  event_name VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX webhook_deliveries_webhook_id_idx (webhook_id),
  INDEX webhook_deliveries_app_id_idx (app_id),
  INDEX webhook_deliveries_next_retry_at_idx (next_retry_at),
  INDEX webhook_deliveries_delivered_at_idx (delivered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
