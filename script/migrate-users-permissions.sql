-- Add users.permissions JSON column (nullable; treat null as empty permissions array)
-- Safe to run multiple times only if you guard manually; MySQL lacks IF NOT EXISTS for ADD COLUMN on older versions.

ALTER TABLE users ADD COLUMN permissions JSON NULL;
