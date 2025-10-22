-- Migration: Assign existing data to user_id = 1 (default admin)
-- This ensures existing data is not orphaned when user isolation is implemented
-- Only updates tables that exist and have nullable user_id columns

-- AI review logs
UPDATE ai_review_logs
SET user_id = 1
WHERE user_id IS NULL;

-- Audit log
UPDATE audit_log
SET user_id = 1
WHERE user_id IS NULL;

-- User settings
UPDATE user_settings
SET user_id = 1
WHERE user_id IS NULL;
