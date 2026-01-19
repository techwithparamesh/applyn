-- Applyn VPS MySQL schema patches (safe to run multiple times)
USE `applyn-db`;

-- Ensure build job retry/lock columns exist (required for stale-lock reclaim + retries).

-- build_jobs.attempts
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'build_jobs'
    AND column_name = 'attempts'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `build_jobs` ADD COLUMN `attempts` INT NOT NULL DEFAULT 0',
  'SELECT \'build_jobs.attempts already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---- Google OAuth support (optional) ----
-- users.google_id
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'google_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `google_id` VARCHAR(255) NULL',
  'SELECT \'users.google_id already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- unique index on users.google_id
SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND index_name = 'ux_users_google_id'
);
SET @sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `users` ADD UNIQUE INDEX `ux_users_google_id` (`google_id`)',
  'SELECT \'ux_users_google_id already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---- Apps build fields (if VPS schema is older) ----
-- apps.package_name
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'package_name'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `package_name` VARCHAR(200) NULL',
  'SELECT \'apps.package_name already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.version_code
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'version_code'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `version_code` INT NULL',
  'SELECT \'apps.version_code already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.artifact_path
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'artifact_path'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `artifact_path` TEXT NULL',
  'SELECT \'apps.artifact_path already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.artifact_mime
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'artifact_mime'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `artifact_mime` VARCHAR(100) NULL',
  'SELECT \'apps.artifact_mime already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.artifact_size
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'artifact_size'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `artifact_size` INT NULL',
  'SELECT \'apps.artifact_size already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.build_logs
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'build_logs'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `build_logs` TEXT NULL',
  'SELECT \'apps.build_logs already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.build_error
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'build_error'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `build_error` TEXT NULL',
  'SELECT \'apps.build_error already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- apps.last_build_at
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'apps'
    AND column_name = 'last_build_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `apps` ADD COLUMN `last_build_at` DATETIME NULL',
  'SELECT \'apps.last_build_at already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- build_jobs.lock_token
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'build_jobs'
    AND column_name = 'lock_token'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `build_jobs` ADD COLUMN `lock_token` VARCHAR(64) NULL',
  'SELECT \'build_jobs.lock_token already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- build_jobs.locked_at
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'build_jobs'
    AND column_name = 'locked_at'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `build_jobs` ADD COLUMN `locked_at` DATETIME NULL',
  'SELECT \'build_jobs.locked_at already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- build_jobs.error
SET @col_exists := (
  SELECT COUNT(1)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'build_jobs'
    AND column_name = 'error'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `build_jobs` ADD COLUMN `error` TEXT NULL',
  'SELECT \'build_jobs.error already exists\''
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
