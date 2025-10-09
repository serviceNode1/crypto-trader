-- ============================================
-- MIGRATION 003: Fix discovered_coins UNIQUE constraint
-- ============================================
-- Issue: ON CONFLICT requires UNIQUE CONSTRAINT, not just UNIQUE INDEX
-- Solution: Add UNIQUE constraint to symbol column

-- Drop the existing unique index (if exists)
DROP INDEX IF EXISTS idx_discovered_coins_symbol;

-- Add UNIQUE constraint to symbol column
-- This will automatically create a unique index
ALTER TABLE discovered_coins 
  DROP CONSTRAINT IF EXISTS discovered_coins_symbol_key,
  ADD CONSTRAINT discovered_coins_symbol_key UNIQUE (symbol);

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 003 completed successfully!';
  RAISE NOTICE '   - UNIQUE constraint added to discovered_coins.symbol';
  RAISE NOTICE '   - ON CONFLICT (symbol) will now work correctly';
END $$;
