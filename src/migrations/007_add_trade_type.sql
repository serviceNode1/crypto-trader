-- Migration 007: Add trade type tracking
-- Distinguishes between manual, automatic, and protection-triggered trades

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS trade_type VARCHAR(20) DEFAULT 'manual' CHECK (
    trade_type IN ('manual', 'automatic', 'stop_loss', 'take_profit')
  ),
  ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN trades.trade_type IS 'Type of trade: manual (user), automatic (AI), stop_loss (protection), take_profit (protection)';
COMMENT ON COLUMN trades.triggered_by IS 'What triggered the trade (e.g., "stop_loss_$24.50", "take_profit_$30.00", "recommendation_123", "user")';

-- Create index for filtering by trade type
CREATE INDEX IF NOT EXISTS idx_trades_type ON trades (trade_type, executed_at DESC);
