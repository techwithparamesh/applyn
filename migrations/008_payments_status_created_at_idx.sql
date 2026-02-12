-- 008_payments_status_created_at_idx.sql
-- Composite index to speed up filtering by status + created_at.
-- MySQL does not reliably support CREATE INDEX IF NOT EXISTS across versions,
-- so use an information_schema guard for idempotence.

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND index_name = 'payments_status_created_at_idx'
);

SET @create_stmt := IF(
  @idx_exists = 0,
  'CREATE INDEX payments_status_created_at_idx ON payments (status, created_at)',
  'SELECT 1'
);

PREPARE stmt FROM @create_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
