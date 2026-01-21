-- Add icon_url column for custom logo support
-- Run this on your VPS MySQL database:
-- mysql -u applyn -p applyn < migrations/add_icon_url.sql

-- Use MEDIUMTEXT to support large base64 images (up to 16MB)
ALTER TABLE apps ADD COLUMN icon_url MEDIUMTEXT AFTER icon;
