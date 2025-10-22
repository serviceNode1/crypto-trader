-- Migration: Fix visual_style constraint to include 'glass' option

-- Drop old constraint
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_visual_style_check;

-- Add new constraint with 'glass' option
ALTER TABLE user_settings ADD CONSTRAINT user_settings_visual_style_check 
  CHECK (visual_style IN ('default', 'glass', 'compact', 'comfortable'));
