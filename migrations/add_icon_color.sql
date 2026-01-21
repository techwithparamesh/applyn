-- Add icon_color column to apps table
-- Run this on your VPS: mysql -u applyn -p applyn < migrations/add_icon_color.sql

ALTER TABLE apps ADD COLUMN icon_color VARCHAR(16) DEFAULT '#2563EB' AFTER icon_url;
