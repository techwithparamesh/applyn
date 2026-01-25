-- Applyn VPS MySQL migrations (safe to run multiple times)
USE `applyn-db`;

-- MySQL doesn’t support `ADD INDEX IF NOT EXISTS`, so we check `information_schema.statistics`
-- and conditionally run each `ALTER TABLE`.

-- Apps listing / ownership queries
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND index_name = 'idx_apps_owner_updated'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `apps` ADD INDEX `idx_apps_owner_updated` (`owner_id`, `updated_at`)',
  'SELECT \'idx_apps_owner_updated already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Build queue efficiency
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'build_jobs'
    AND index_name = 'idx_build_jobs_status_created'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `build_jobs` ADD INDEX `idx_build_jobs_status_created` (`status`, `created_at`)',
  'SELECT \'idx_build_jobs_status_created already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'build_jobs'
    AND index_name = 'idx_build_jobs_app_created'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `build_jobs` ADD INDEX `idx_build_jobs_app_created` (`app_id`, `created_at`)',
  'SELECT \'idx_build_jobs_app_created already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Support tickets
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND index_name = 'idx_support_tickets_requester_updated'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `support_tickets` ADD INDEX `idx_support_tickets_requester_updated` (`requester_id`, `updated_at`)',
  'SELECT \'idx_support_tickets_requester_updated already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND index_name = 'idx_support_tickets_status_updated'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `support_tickets` ADD INDEX `idx_support_tickets_status_updated` (`status`, `updated_at`)',
  'SELECT \'idx_support_tickets_status_updated already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Contact submissions (optional)
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'contact_submissions'
    AND index_name = 'idx_contact_created_at'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `contact_submissions` ADD INDEX `idx_contact_created_at` (`created_at`)',
  'SELECT \'idx_contact_created_at already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =====================================================
-- Enhanced Support Tickets - New Fields
-- =====================================================

-- Add priority column
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND column_name = 'priority'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `support_tickets` ADD COLUMN `priority` VARCHAR(10) NOT NULL DEFAULT \'medium\' AFTER `status`',
  'SELECT \'priority column already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add assigned_to column (staff member ID)
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND column_name = 'assigned_to'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `support_tickets` ADD COLUMN `assigned_to` VARCHAR(36) NULL AFTER `priority`',
  'SELECT \'assigned_to column already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add resolution_notes column
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND column_name = 'resolution_notes'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `support_tickets` ADD COLUMN `resolution_notes` TEXT NULL AFTER `assigned_to`',
  'SELECT \'resolution_notes column already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add resolved_at timestamp
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND column_name = 'resolved_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `support_tickets` ADD COLUMN `resolved_at` TIMESTAMP NULL AFTER `resolution_notes`',
  'SELECT \'resolved_at column already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add closed_at timestamp
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND column_name = 'closed_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `support_tickets` ADD COLUMN `closed_at` TIMESTAMP NULL AFTER `resolved_at`',
  'SELECT \'closed_at column already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Extend status column to support new statuses
ALTER TABLE `support_tickets` MODIFY COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'open';

-- Index for assigned_to (staff workload)
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND index_name = 'idx_support_tickets_assigned_to'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `support_tickets` ADD INDEX `idx_support_tickets_assigned_to` (`assigned_to`)',
  'SELECT \'idx_support_tickets_assigned_to already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for priority (triage)
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'support_tickets'
    AND index_name = 'idx_support_tickets_priority'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `support_tickets` ADD INDEX `idx_support_tickets_priority` (`priority`)',
  'SELECT \'idx_support_tickets_priority already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
