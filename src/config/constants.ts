// Risk Management Constants (Hard-Coded Safety Limits)
export const RISK_LIMITS = {
  MAX_POSITION_SIZE: 0.05, // 5% of portfolio per position
  MAX_PORTFOLIO_RISK: 0.15, // 15% of portfolio at risk simultaneously
  MAX_DAILY_LOSS: 0.03, // 3% daily loss limit
  MAX_OPEN_POSITIONS: 5,
  MIN_DAILY_VOLUME: 1_000_000, // $1M minimum
  MAX_POSITION_CORRELATION: 0.7,
  MIN_TRADE_INTERVAL_MS: 3600000, // 1 hour in milliseconds
} as const;

// Transaction Costs
export const TRANSACTION_COSTS = {
  FEE_RATE: 0.001, // 0.1%
  MIN_SLIPPAGE: 0.001, // 0.1%
  MAX_SLIPPAGE: 0.003, // 0.3%
} as const;

// Cache TTLs (in seconds)
export const CACHE_TTL = {
  PRICE: 60, // 1 minute
  MARKETCAP: 300, // 5 minutes
  SENTIMENT: 900, // 15 minutes
  NEWS: 1800, // 30 minutes
  TRADITIONAL_MARKETS: 3600, // 1 hour
  HISTORICAL: 86400, // 24 hours
  DISCOVERY: 7200, // 2 hours - for coin discovery results
} as const;

// Timeframes for technical analysis
export const TIMEFRAMES = {
  MINUTE_5: '5m',
  MINUTE_15: '15m',
  HOUR_1: '1h',
  HOUR_4: '4h',
  DAY_1: '1d',
} as const;

// Technical indicator periods
export const INDICATOR_PERIODS = {
  RSI: 14,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  BB_PERIOD: 20,
  BB_STDDEV: 2,
  EMA_SHORT: 9,
  EMA_MEDIUM: 21,
  EMA_LONG: 50,
} as const;

// Altcoin screening criteria
export const ALTCOIN_CRITERIA = {
  MIN_MARKET_CAP: 10_000_000, // $10M
  MAX_MARKET_CAP: 500_000_000, // $500M
  MIN_DAILY_VOLUME: 1_000_000, // $1M
  MIN_AGE_DAYS: 90,
  MIN_EXCHANGES: 2,
} as const;

// Price movement thresholds
export const PRICE_THRESHOLDS = {
  SIGNIFICANT_MOVE: 0.05, // 5% in 1 hour
  CORRELATION_WINDOW_HOURS: 2,
} as const;

// Sentiment scoring
export const SENTIMENT_SCORES = {
  BULLISH: 1,
  NEUTRAL: 0,
  BEARISH: -1,
} as const;

// Credibility scoring factors
export const CREDIBILITY_FACTORS = {
  MIN_ACCOUNT_AGE_DAYS: 30,
  MIN_KARMA: 100,
  ENGAGEMENT_WEIGHT: 0.3,
  AGE_WEIGHT: 0.4,
  KARMA_WEIGHT: 0.3,
} as const;

// API rate limits (requests per minute)
export const API_RATE_LIMITS = {
  COINGECKO: 50,
  BINANCE: 1200,
  REDDIT: 60,
  CRYPTOPANIC: 100,
  ALPHA_VANTAGE: 5, // Very limited
  ETHERSCAN: 5,
  OPENAI: 500,
  ANTHROPIC: 1000,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 10000,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Reddit subreddits to monitor
export const REDDIT_SUBREDDITS = [
  'CryptoCurrency',
  'altcoin',
  'SatoshiStreetBets',
] as const;

// Supported cryptocurrencies (initial set)
export const SUPPORTED_SYMBOLS = [
  'BTC',
  'ETH',
  'BNB',
  'XRP',
  'ADA',
  'SOL',
  'DOT',
  'MATIC',
  'AVAX',
  'LINK',
] as const;

// Market regime types
export const MARKET_REGIMES = {
  BULL: 'bull',
  BEAR: 'bear',
  SIDEWAYS: 'sideways',
  HIGH_VOLATILITY: 'high_volatility',
} as const;

// Trade actions
export const TRADE_ACTIONS = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
} as const;

// Risk levels
export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

// AI model configuration
export const AI_MODELS = {
  OPENAI: {
    MODEL: 'gpt-4o-mini',
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.7,
  },
  ANTHROPIC: {
    MODEL: 'claude-3-haiku-20240307',
    MAX_TOKENS: 1000,
    TEMPERATURE: 0.7,
  },
} as const;

// Learning system configuration
export const LEARNING_CONFIG = {
  FEATURE_IMPORTANCE_WINDOW_DAYS: 7,
  MIN_PREDICTIONS_FOR_ANALYSIS: 20,
  PREDICTION_EVALUATION_DELAY_HOURS: 24,
  STRATEGY_OPTIMIZATION_FREQUENCY_DAYS: 7,
} as const;
