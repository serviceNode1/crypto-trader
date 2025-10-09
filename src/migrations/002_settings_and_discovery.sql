-- Migration 002: Settings and Discovery Tables
-- Purpose: Support user settings and coin discovery system

-- ============================================
-- USER SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER DEFAULT 1,  -- For future multi-user support
  
  -- Auto-Trading Settings
  auto_execute BOOLEAN DEFAULT FALSE,
  confidence_threshold INTEGER DEFAULT 75 CHECK (confidence_threshold BETWEEN 70 AND 90),
  human_approval BOOLEAN DEFAULT TRUE,
  
  -- Position Sizing
  position_sizing_strategy VARCHAR(20) DEFAULT 'equal' CHECK (position_sizing_strategy IN ('equal', 'confidence')),
  max_position_size DECIMAL(5,2) DEFAULT 5.0 CHECK (max_position_size BETWEEN 2.0 AND 10.0),
  
  -- Exit Strategy
  take_profit_strategy VARCHAR(20) DEFAULT 'partial' CHECK (take_profit_strategy IN ('full', 'partial', 'trailing')),
  auto_stop_loss BOOLEAN DEFAULT TRUE,
  
  -- Market Focus
  coin_universe VARCHAR(20) DEFAULT 'top25' CHECK (coin_universe IN ('top10', 'top25', 'top50')),
  analysis_frequency INTEGER DEFAULT 4 CHECK (analysis_frequency IN (1, 4, 8, 24)),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO user_settings (user_id) VALUES (1);

-- Index for quick lookups
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- TRADE APPROVALS QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS trade_approvals (
  id SERIAL PRIMARY KEY,
  recommendation_id INTEGER REFERENCES recommendations(id),
  symbol VARCHAR(10) NOT NULL,
  action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity DECIMAL(20,8) NOT NULL,
  entry_price DECIMAL(20,8) NOT NULL,
  stop_loss DECIMAL(20,8),
  take_profit_1 DECIMAL(20,8),
  take_profit_2 DECIMAL(20,8),
  reasoning TEXT,
  
  -- Approval Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed')),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_trade_approvals_status ON trade_approvals(status, created_at DESC);
CREATE INDEX idx_trade_approvals_symbol ON trade_approvals(symbol, created_at DESC);

-- ============================================
-- COIN DISCOVERY TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS discovered_coins (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL UNIQUE,  -- UNIQUE constraint for ON CONFLICT
  name VARCHAR(100),
  
  -- Market Data
  market_cap_rank INTEGER,
  market_cap DECIMAL(20,2),
  current_price DECIMAL(20,8),
  volume_24h DECIMAL(20,2),
  
  -- Score Components
  volume_score DECIMAL(5,2),          -- Volume growth score (0-100)
  price_momentum_score DECIMAL(5,2),  -- Price momentum score (0-100)
  sentiment_score DECIMAL(5,2),       -- Sentiment score (0-100)
  composite_score DECIMAL(5,2),       -- Overall score (0-100)
  
  -- Metadata
  discovered_at TIMESTAMP DEFAULT NOW(),
  analyzed BOOLEAN DEFAULT FALSE,
  recommendation_generated BOOLEAN DEFAULT FALSE
);

-- Index is automatically created by UNIQUE constraint, but adding explicit name for clarity
-- CREATE UNIQUE INDEX idx_discovered_coins_symbol ON discovered_coins(symbol);
CREATE INDEX idx_discovered_coins_score ON discovered_coins(composite_score DESC, discovered_at DESC);
CREATE INDEX idx_discovered_coins_analyzed ON discovered_coins(analyzed, composite_score DESC);

-- ============================================
-- EXECUTION LOGS (Detailed Auto-Trading History)
-- ============================================
CREATE TABLE IF NOT EXISTS execution_logs (
  id SERIAL PRIMARY KEY,
  recommendation_id INTEGER REFERENCES recommendations(id),
  trade_id INTEGER REFERENCES trades(id),
  approval_id INTEGER REFERENCES trade_approvals(id),
  
  symbol VARCHAR(10) NOT NULL,
  action VARCHAR(10) NOT NULL,
  
  -- Execution Details
  trigger_type VARCHAR(30) NOT NULL,  -- 'auto', 'manual_approval', 'stop_loss', 'take_profit'
  execution_method VARCHAR(20) NOT NULL,  -- 'immediate', 'queued', 'rejected'
  
  -- Settings at Time of Execution
  settings_snapshot JSONB,  -- Store settings used for this execution
  
  -- Risk Checks
  risk_checks_passed BOOLEAN,
  risk_check_details JSONB,
  
  -- Performance
  execution_time_ms INTEGER,
  
  -- Outcome
  success BOOLEAN,
  error_message TEXT,
  
  -- Metadata
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_execution_logs_symbol ON execution_logs(symbol, executed_at DESC);
CREATE INDEX idx_execution_logs_trigger ON execution_logs(trigger_type, executed_at DESC);
CREATE INDEX idx_execution_logs_success ON execution_logs(success, executed_at DESC);

-- ============================================
-- CIRCUIT BREAKERS (Safety System)
-- ============================================
CREATE TABLE IF NOT EXISTS circuit_breakers (
  id SERIAL PRIMARY KEY,
  
  -- Trigger Details
  trigger_type VARCHAR(50) NOT NULL,  -- 'consecutive_losses', 'daily_loss_limit', 'manual_halt'
  trigger_value DECIMAL(10,2),  -- Value that triggered (e.g., loss amount)
  threshold DECIMAL(10,2),      -- Threshold setting
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'manual_override')),
  
  -- Impact
  trades_blocked INTEGER DEFAULT 0,
  duration_minutes INTEGER,
  
  -- Resolution
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(50),  -- 'auto', 'manual', 'system'
  resolution_notes TEXT,
  
  -- Metadata
  triggered_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_circuit_breakers_status ON circuit_breakers(status, triggered_at DESC);

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Add execution status to recommendations
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS execution_status VARCHAR(20) DEFAULT 'pending'
  CHECK (execution_status IN ('pending', 'queued', 'executed', 'rejected', 'expired'));

ALTER TABLE recommendations
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;

-- Add auto-execution flag to trades
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS auto_executed BOOLEAN DEFAULT FALSE;

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS approval_id INTEGER REFERENCES trade_approvals(id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-expire old trade approvals
CREATE OR REPLACE FUNCTION expire_old_approvals()
RETURNS void AS $$
BEGIN
  UPDATE trade_approvals
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- ============================================
-- VIEWS FOR CONVENIENCE
-- ============================================

-- Active approvals view
CREATE OR REPLACE VIEW active_approvals AS
SELECT 
  ta.*,
  r.confidence,
  r.risk_level,
  (ta.expires_at - NOW()) as time_remaining
FROM trade_approvals ta
LEFT JOIN recommendations r ON ta.recommendation_id = r.id
WHERE ta.status = 'pending'
  AND ta.expires_at > NOW()
ORDER BY ta.created_at DESC;

-- Recent executions view
CREATE OR REPLACE VIEW recent_executions AS
SELECT 
  el.*,
  t.total_cost,
  t.fee,
  t.slippage
FROM execution_logs el
LEFT JOIN trades t ON el.trade_id = t.id
WHERE el.executed_at > NOW() - INTERVAL '7 days'
ORDER BY el.executed_at DESC;

-- Discovery leaderboard view
CREATE OR REPLACE VIEW discovery_leaderboard AS
SELECT 
  symbol,
  name,
  composite_score,
  market_cap_rank,
  volume_24h,
  discovered_at,
  analyzed,
  recommendation_generated
FROM discovered_coins
WHERE discovered_at > NOW() - INTERVAL '7 days'
ORDER BY composite_score DESC
LIMIT 20;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE user_settings IS 'User trading preferences and configuration';
COMMENT ON TABLE trade_approvals IS 'Queue for trades requiring manual approval';
COMMENT ON TABLE discovered_coins IS 'Automatically discovered trading opportunities';
COMMENT ON TABLE execution_logs IS 'Detailed log of all trade executions';
COMMENT ON TABLE circuit_breakers IS 'Trading halt events for safety';

COMMENT ON COLUMN user_settings.auto_execute IS 'Enable automatic trade execution';
COMMENT ON COLUMN user_settings.confidence_threshold IS 'Minimum AI confidence (70-90%) for auto-execution';
COMMENT ON COLUMN user_settings.human_approval IS 'Require manual approval before executing';

COMMENT ON COLUMN trade_approvals.status IS 'pending | approved | rejected | expired | executed';
COMMENT ON COLUMN discovered_coins.composite_score IS 'Overall opportunity score (0-100)';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 002 completed successfully!';
  RAISE NOTICE '   - user_settings table created';
  RAISE NOTICE '   - trade_approvals table created';
  RAISE NOTICE '   - discovered_coins table created';
  RAISE NOTICE '   - execution_logs table created';
  RAISE NOTICE '   - circuit_breakers table created';
  RAISE NOTICE '   - Views and triggers configured';
END $$;
