-- Migration 011: Set default exit strategy to 'full'
-- Ensures all users have a clear exit strategy set

-- Update any existing users with NULL or unset strategy
UPDATE user_settings 
SET take_profit_strategy = 'full' 
WHERE take_profit_strategy IS NULL 
   OR take_profit_strategy NOT IN ('full', 'partial', 'trailing');

-- Update user 1 specifically (current user) to 'full' if set to 'partial'
-- This fixes the issue where automatic take-profit was doing ladder exits
UPDATE user_settings 
SET take_profit_strategy = 'full' 
WHERE user_id = 1;

COMMENT ON COLUMN user_settings.take_profit_strategy IS 'Exit strategy: full (sell 100%), partial (ladder out 50%), or trailing (trailing stop)';
