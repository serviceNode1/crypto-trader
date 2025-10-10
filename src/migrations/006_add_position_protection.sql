-- Migration 006: Add Stop Loss and Take Profit to Holdings
-- This allows tracking protection levels for open positions

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS take_profit NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS protection_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comment for documentation
COMMENT ON COLUMN holdings.stop_loss IS 'Price level to automatically sell and limit losses';
COMMENT ON COLUMN holdings.take_profit IS 'Price level to automatically sell and lock in profits';
COMMENT ON COLUMN holdings.protection_updated_at IS 'When stop loss or take profit was last modified';
