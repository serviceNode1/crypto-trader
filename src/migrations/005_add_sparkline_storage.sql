-- Migration 005: Add Sparkline Storage to Discovery Data
-- This allows us to cache 7-day price charts and show data freshness

-- Add sparkline storage columns
ALTER TABLE discovered_coins
  ADD COLUMN IF NOT EXISTS sparkline_data JSONB,
  ADD COLUMN IF NOT EXISTS sparkline_fetched_at TIMESTAMP DEFAULT NOW();

-- Add index for fetched_at queries (to check freshness)
CREATE INDEX IF NOT EXISTS idx_discovered_coins_fetched_at 
  ON discovered_coins(sparkline_fetched_at DESC);

-- Add comment
COMMENT ON COLUMN discovered_coins.sparkline_data IS '7-day price history array for sparkline charts';
COMMENT ON COLUMN discovered_coins.sparkline_fetched_at IS 'When sparkline data was last fetched';

-- Migration complete
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 005 completed successfully!';
  RAISE NOTICE '   - Added sparkline_data column (JSONB)';
  RAISE NOTICE '   - Added sparkline_fetched_at timestamp';
  RAISE NOTICE '   - Created index on sparkline_fetched_at';
END $$;
