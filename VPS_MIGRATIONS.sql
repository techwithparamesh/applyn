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
