-- Migration 008: Coin ID Mappings Cache
-- Stores discovered symbol → CoinGecko ID mappings for faster lookups

CREATE TABLE IF NOT EXISTS coin_id_mappings (
  symbol VARCHAR(20) PRIMARY KEY,
  coin_id VARCHAR(100) NOT NULL,
  discovered_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW(),
  usage_count INT DEFAULT 1
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_coin_id_mappings_last_used ON coin_id_mappings (last_used_at DESC);

-- Add comment
COMMENT ON TABLE coin_id_mappings IS 'Cache of symbol to CoinGecko coin ID mappings discovered dynamically';
COMMENT ON COLUMN coin_id_mappings.symbol IS 'Cryptocurrency symbol (e.g., BTC, ETH)';
COMMENT ON COLUMN coin_id_mappings.coin_id IS 'CoinGecko coin ID (e.g., bitcoin, ethereum)';
COMMENT ON COLUMN coin_id_mappings.discovered_at IS 'When this mapping was first discovered';
COMMENT ON COLUMN coin_id_mappings.last_used_at IS 'Last time this mapping was accessed';
COMMENT ON COLUMN coin_id_mappings.usage_count IS 'Number of times this mapping has been used';
