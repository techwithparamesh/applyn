-- 007_performance_indexes.sql
-- Performance-safe composite indexes for production scaling.
-- Idempotent by using IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS build_jobs_status_locked_created_idx
  ON build_jobs (status, locked_at, created_at);

CREATE INDEX IF NOT EXISTS webhook_deliveries_delivered_retry_idx
  ON webhook_deliveries (delivered_at, next_retry_at);
