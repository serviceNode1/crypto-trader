-- Migration 009: Add missing tables and columns
-- Fixes price_data table and sentiment table columns

-- Create price_data table for real-time price collection
CREATE TABLE IF NOT EXISTS price_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  volume_24h NUMERIC(20, 2),
  market_cap NUMERIC(20, 2),
  price_change_24h NUMERIC(10, 4)
);

CREATE INDEX IF NOT EXISTS idx_price_data_symbol ON price_data (symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON price_data (timestamp DESC);

COMMENT ON TABLE price_data IS 'Real-time price data collection for cryptocurrencies';

-- Add missing columns to sentiment table
ALTER TABLE sentiment
  ADD COLUMN IF NOT EXISTS author_karma INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS url VARCHAR(500);

-- Add index for url lookups (used in ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sentiment_url ON sentiment (url) WHERE url IS NOT NULL;

COMMENT ON COLUMN sentiment.author_karma IS 'Author karma/reputation score from source';
COMMENT ON COLUMN sentiment.url IS 'URL to the original post/content';
