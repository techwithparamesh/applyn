-- Adds a UNIQUE constraint on payments.provider_order_id.
-- NOTE: MySQL UNIQUE indexes allow multiple NULLs.
--
-- Before applying, ensure there are no duplicate non-NULL provider_order_id values:
--   SELECT provider_order_id, COUNT(*) AS n
--   FROM payments
--   WHERE provider_order_id IS NOT NULL
--   GROUP BY provider_order_id
--   HAVING n > 1;
--
-- If duplicates exist, decide which row to keep and null out/delete the others.

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_order_id_uq UNIQUE (provider_order_id);
