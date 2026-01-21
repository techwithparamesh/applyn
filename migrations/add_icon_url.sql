-- Add icon_url column for custom logo support
-- Run this on your VPS MySQL database:
-- mysql -u applyn -p applyn < migrations/add_icon_url.sql

ALTER TABLE apps ADD COLUMN icon_url TEXT AFTER icon;
