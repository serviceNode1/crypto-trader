-- Migration: Add user_id to holdings table for multi-user support

-- Add user_id column
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Assign existing holdings to user 1 (admin)
UPDATE holdings SET user_id = 1 WHERE user_id IS NULL;

-- Make user_id NOT NULL after assigning existing data
ALTER TABLE holdings ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE holdings ADD CONSTRAINT fk_holdings_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
