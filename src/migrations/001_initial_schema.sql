-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Prices table (TimescaleDB hypertable for time-series data)
CREATE TABLE IF NOT EXISTS prices (
  time TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  open NUMERIC(20, 8),
  high NUMERIC(20, 8),
  low NUMERIC(20, 8),
  close NUMERIC(20, 8),
  volume NUMERIC(20, 8),
  timeframe VARCHAR(10) NOT NULL,
  PRIMARY KEY (time, symbol, timeframe)
);

-- Convert to hypertable
SELECT create_hypertable('prices', 'time', if_not_exists => TRUE);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prices_symbol_time ON prices (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_prices_timeframe ON prices (timeframe, time DESC);

-- Sentiment data table
CREATE TABLE IF NOT EXISTS sentiment (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  source VARCHAR(50) NOT NULL,
  content TEXT,
  score NUMERIC(5, 4),
  credibility NUMERIC(5, 4),
  author VARCHAR(100),
  post_id VARCHAR(100) UNIQUE,
  upvotes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_symbol ON sentiment (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_source ON sentiment (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_created ON sentiment (created_at DESC);

-- News articles table
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  currencies TEXT[],
  votes_positive INTEGER DEFAULT 0,
  votes_negative INTEGER DEFAULT 0,
  source VARCHAR(100),
  domain VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_currencies ON news USING GIN (currencies);

-- Portfolio holdings table
CREATE TABLE IF NOT EXISTS holdings (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) UNIQUE NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
  average_price NUMERIC(20, 8) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio cash balance
CREATE TABLE IF NOT EXISTS portfolio_balance (
  id SERIAL PRIMARY KEY,
  cash NUMERIC(20, 8) NOT NULL,
  total_value NUMERIC(20, 8),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial balance
INSERT INTO portfolio_balance (cash, total_value) 
VALUES (10000.00, 10000.00) 
ON CONFLICT DO NOTHING;

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  quantity NUMERIC(20, 8) NOT NULL,
  price NUMERIC(20, 8) NOT NULL,
  fee NUMERIC(20, 8) NOT NULL,
  slippage NUMERIC(20, 8) NOT NULL,
  total_cost NUMERIC(20, 8) NOT NULL,
  reasoning TEXT,
  recommendation_id INTEGER,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades (executed_at DESC);

-- Recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  action VARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  confidence NUMERIC(5, 2) NOT NULL,
  entry_price NUMERIC(20, 8),
  stop_loss NUMERIC(20, 8),
  take_profit_1 NUMERIC(20, 8),
  take_profit_2 NUMERIC(20, 8),
  position_size NUMERIC(5, 4),
  risk_level VARCHAR(10) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  reasoning JSONB,
  sources TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recommendations_symbol ON recommendations (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON recommendations (created_at DESC);

-- Predictions table (for learning system)
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  action VARCHAR(4) NOT NULL,
  entry_price NUMERIC(20, 8) NOT NULL,
  target_price NUMERIC(20, 8),
  stop_loss NUMERIC(20, 8),
  confidence NUMERIC(5, 2) NOT NULL,
  timeframe_hours INTEGER NOT NULL,
  reasoning TEXT,
  sources TEXT[],
  input_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  evaluated_at TIMESTAMPTZ,
  outcome JSONB
);

CREATE INDEX IF NOT EXISTS idx_predictions_symbol ON predictions (symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_evaluated ON predictions (evaluated_at);

-- Feature importance table
CREATE TABLE IF NOT EXISTS feature_importance (
  id SERIAL PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  score NUMERIC(5, 4) NOT NULL,
  sample_size INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_importance_calc ON feature_importance (calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_importance_category ON feature_importance (category, calculated_at DESC);

-- Market context table
CREATE TABLE IF NOT EXISTS market_context (
  id SERIAL PRIMARY KEY,
  btc_dominance NUMERIC(5, 2),
  total_market_cap NUMERIC(20, 2),
  market_regime VARCHAR(20),
  sp500_price NUMERIC(10, 2),
  gold_price NUMERIC(10, 2),
  dxy_index NUMERIC(10, 4),
  vix_index NUMERIC(10, 2),
  risk_sentiment VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_context_created ON market_context (created_at DESC);

-- Altcoin discoveries table
CREATE TABLE IF NOT EXISTS altcoin_discoveries (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  market_cap NUMERIC(20, 2),
  volume_24h NUMERIC(20, 2),
  price NUMERIC(20, 8),
  sentiment_score NUMERIC(5, 4),
  technical_score NUMERIC(5, 4),
  total_score NUMERIC(5, 4),
  rank INTEGER,
  exchanges TEXT[],
  discovered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_altcoin_discoveries_discovered ON altcoin_discoveries (discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_altcoin_discoveries_rank ON altcoin_discoveries (rank, discovered_at DESC);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id SERIAL PRIMARY KEY,
  portfolio_value NUMERIC(20, 8) NOT NULL,
  cash_balance NUMERIC(20, 8) NOT NULL,
  total_return_pct NUMERIC(10, 4),
  sharpe_ratio NUMERIC(10, 4),
  max_drawdown NUMERIC(10, 4),
  win_rate NUMERIC(5, 4),
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  avg_win NUMERIC(20, 8),
  avg_loss NUMERIC(20, 8),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_calc ON performance_metrics (calculated_at DESC);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL,
  component VARCHAR(50),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level, created_at DESC);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  api_name VARCHAR(50) NOT NULL,
  endpoint VARCHAR(200),
  requests_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(api_name, endpoint, date)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage (date DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_api ON api_usage (api_name, date DESC);
