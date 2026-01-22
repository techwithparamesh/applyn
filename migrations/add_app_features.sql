-- Add features column to apps table
-- This column stores JSON string with native enhancement feature flags:
-- { "bottomNav": boolean, "pullToRefresh": boolean, "offlineScreen": boolean }

-- MySQL Migration
ALTER TABLE apps ADD COLUMN features TEXT NULL AFTER status;

-- Default existing apps will have null features, which defaults to:
-- bottomNav: false, pullToRefresh: true, offlineScreen: true
