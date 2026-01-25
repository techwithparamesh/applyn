-- Migration: Add ticket_messages table for conversation threads
-- Run this migration after 004_audit_logs.sql (if exists)

CREATE TABLE IF NOT EXISTS ticket_messages (
  id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci PRIMARY KEY,
  ticket_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  sender_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  sender_role VARCHAR(16) NOT NULL DEFAULT 'user', -- user, staff, system
  message TEXT NOT NULL,
  is_internal TINYINT(1) NOT NULL DEFAULT 0, -- Internal staff notes not visible to user
  attachments TEXT, -- JSON array of attachment URLs
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX ticket_messages_ticket_id_idx (ticket_id),
  INDEX ticket_messages_sender_id_idx (sender_id),
  INDEX ticket_messages_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note: Foreign key removed to avoid collation compatibility issues
-- The application layer handles referential integrity
-- The is_internal column allows staff to leave notes that users cannot see
-- The sender_role helps identify if the message is from user, staff, or system (automated)
