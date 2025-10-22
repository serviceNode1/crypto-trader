-- Migration: Add UI preference settings to user_settings table

-- Add discovery_strategy column
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS discovery_strategy VARCHAR(20) DEFAULT 'moderate';
ALTER TABLE user_settings ADD CONSTRAINT user_settings_discovery_strategy_check 
  CHECK (discovery_strategy IN ('conservative', 'moderate', 'aggressive'));

-- Add color_mode column
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS color_mode VARCHAR(20) DEFAULT 'auto';
ALTER TABLE user_settings ADD CONSTRAINT user_settings_color_mode_check 
  CHECK (color_mode IN ('light', 'dark', 'auto'));

-- Add visual_style column
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS visual_style VARCHAR(20) DEFAULT 'default';
ALTER TABLE user_settings ADD CONSTRAINT user_settings_visual_style_check 
  CHECK (visual_style IN ('default', 'compact', 'comfortable'));

-- Set default values for existing records
UPDATE user_settings SET discovery_strategy = 'moderate' WHERE discovery_strategy IS NULL;
UPDATE user_settings SET color_mode = 'auto' WHERE color_mode IS NULL;
UPDATE user_settings SET visual_style = 'default' WHERE visual_style IS NULL;
