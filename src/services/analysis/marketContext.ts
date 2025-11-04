import { getGlobalMarketData } from '../dataCollection/coinGeckoService';
import { getTraditionalMarketsOverview, calculateMarketSentiment } from '../dataCollection/alphaVantageService';
import { query } from '../../config/database';
import { MARKET_REGIMES } from '../../config/constants';
import { logger } from '../../utils/logger';

export interface MarketContext {
  btcDominance: number;
  totalMarketCap: number;
  marketRegime: 'bull' | 'bear' | 'sideways' | 'high_volatility';
  traditionalMarkets: {
    sp500: number;
    sp500Change: number;
    gold: number;
    vix: number;
  };
  riskSentiment: 'risk-on' | 'risk-off' | 'neutral';
  volatilityIndex: number;
  // Optional additional fields
  totalVolume?: number;
  ethDominance?: number;
  altcoinMarketCap?: number;
  fearGreedIndex?: number;
  sp500?: number;        // Top-level alias for traditionalMarkets.sp500
  gold?: number;         // Top-level alias for traditionalMarkets.gold
  dxy?: number;          // USD Dollar Index
  vix?: number;          // Top-level alias for traditionalMarkets.vix
}

export interface RegimeAnalysis {
  current: string;
  confidence: number;
  characteristics: string[];
  recommendations: string[];
}

/**
 * Get current market context
 */
export async function getMarketContext(): Promise<MarketContext> {
  try {
    logger.info('getMarketContext: Starting...');
    
    // Fetch crypto market data
    logger.info('getMarketContext: Fetching global market data...');
    let globalData: { market_cap_percentage?: { btc?: number }; total_market_cap?: { usd?: number } };
    
    try {
      globalData = await getGlobalMarketData() as {
        market_cap_percentage?: { btc?: number };
        total_market_cap?: { usd?: number };
      };
      logger.info('getMarketContext: Global data fetched', { btcDominance: globalData.market_cap_percentage?.btc });
    } catch (error) {
      logger.error('getMarketContext: Failed to fetch global market data, using defaults', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Use default values if API fails
      globalData = {
        market_cap_percentage: { btc: 50 },
        total_market_cap: { usd: 0 }
      };
    }

    // Fetch traditional markets data (with error handling for rate limits)
    let traditionalData;
    try {
      traditionalData = await getTraditionalMarketsOverview();
    } catch (error) {
      logger.warn('Failed to fetch traditional markets, using defaults', { error });
      traditionalData = {
        sp500: { 
          symbol: 'SPY',
          price: 0, 
          change: 0,
          changePercent: 0,
          volume: 0,
          timestamp: new Date().toISOString()
        },
        gold: 0,
        vix: 20,
      };
    }

    const btcDominance = globalData.market_cap_percentage?.btc || 0;
    const totalMarketCap = globalData.total_market_cap?.usd || 0;

    logger.info('getMarketContext: Determining market regime...');
    // Determine market regime
    const marketRegime = await determineMarketRegime(btcDominance);
    logger.info('getMarketContext: Market regime determined', { marketRegime });

    // Calculate risk sentiment
    const riskSentiment = traditionalData.sp500.price > 0
      ? calculateMarketSentiment(traditionalData)
      : 'neutral';

    // Calculate volatility index (simplified)
    const volatilityIndex = calculateVolatilityIndex(traditionalData.vix);

    const context: MarketContext = {
      btcDominance,
      totalMarketCap,
      marketRegime,
      traditionalMarkets: {
        sp500: traditionalData.sp500.price,
        sp500Change: traditionalData.sp500.changePercent,
        gold: traditionalData.gold,
        vix: traditionalData.vix,
      },
      riskSentiment,
      volatilityIndex,
    };

    // Store in database
    await storeMarketContext(context);

    logger.info('Market context retrieved', {
      btcDominance: btcDominance.toFixed(2),
      marketRegime,
      riskSentiment,
    });

    return context;
  } catch (error) {
    logger.error('Failed to get market context', { error });
    throw error;
  }
}

/**
 * Determine market regime based on historical data and current conditions
 */
async function determineMarketRegime(
  _btcDominance: number
): Promise<'bull' | 'bear' | 'sideways' | 'high_volatility'> {
  try {
    logger.info('determineMarketRegime: Querying prices table for BTC data...');
    
    // Get recent BTC price data
    const result = await query(`
      SELECT 
        close,
        high,
        low,
        time
      FROM prices
      WHERE symbol = 'BTC'
        AND timeframe = '1d'
        AND time > NOW() - INTERVAL '30 days'
      ORDER BY time DESC
      LIMIT 30
    `);

    logger.info('determineMarketRegime: Query completed', { rowCount: result?.rows?.length || 0 });

    if (!result || !result.rows || result.rows.length < 10) {
      logger.warn('Insufficient historical data for regime detection, using default', { 
        rowCount: result?.rows?.length || 0,
        required: 10 
      });
      return MARKET_REGIMES.SIDEWAYS;
    }

    const prices = result.rows.map((r) => parseFloat(r.close));
    const highs = result.rows.map((r) => parseFloat(r.high));
    const lows = result.rows.map((r) => parseFloat(r.low));

    // Calculate trend
    const firstPrice = prices[prices.length - 1];
    const lastPrice = prices[0];
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    // Calculate volatility (average daily range)
    let totalRange = 0;
    for (let i = 0; i < highs.length; i++) {
      const range = ((highs[i] - lows[i]) / lows[i]) * 100;
      totalRange += range;
    }
    const avgDailyRange = totalRange / highs.length;

    // Determine regime
    if (avgDailyRange > 5) {
      return MARKET_REGIMES.HIGH_VOLATILITY;
    } else if (priceChange > 10) {
      return MARKET_REGIMES.BULL;
    } else if (priceChange < -10) {
      return MARKET_REGIMES.BEAR;
    } else {
      return MARKET_REGIMES.SIDEWAYS;
    }
  } catch (error) {
    logger.error('Market regime determination failed', { error });
    return MARKET_REGIMES.SIDEWAYS;
  }
}

/**
 * Calculate volatility index from VIX
 */
function calculateVolatilityIndex(vix: number): number {
  // VIX ranges typically from 10 (low volatility) to 80+ (extreme volatility)
  // Normalize to 0-1 scale
  const normalized = Math.min(1, Math.max(0, (vix - 10) / 70));
  return normalized;
}

/**
 * Store market context in database
 */
async function storeMarketContext(context: MarketContext): Promise<void> {
  try {
    await query(
      `
      INSERT INTO market_context (
        btc_dominance,
        total_market_cap,
        market_regime,
        sp500_price,
        gold_price,
        vix_index,
        vix_price,
        dxy_price,
        risk_sentiment,
        market_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `,
      [
        context.btcDominance,
        context.totalMarketCap,
        context.marketRegime,
        context.traditionalMarkets.sp500,
        context.traditionalMarkets.gold,
        context.traditionalMarkets.vix,
        context.traditionalMarkets.vix,  // Store in both columns for compatibility
        context.dxy || null,  // Optional field
        context.riskSentiment,
      ]
    );
    logger.info('Market context stored successfully');
  } catch (error) {
    logger.error('Failed to store market context', { error });
  }
}

/**
 * Analyze market regime with detailed insights
 */
export function analyzeRegime(context: MarketContext): RegimeAnalysis {
  const { marketRegime, btcDominance, riskSentiment, volatilityIndex } = context;

  const characteristics: string[] = [];
  const recommendations: string[] = [];
  let confidence = 0.7; // Base confidence

  switch (marketRegime) {
    case MARKET_REGIMES.BULL:
      characteristics.push('Upward price trend across market');
      characteristics.push('Increasing trading volumes');
      characteristics.push('Positive market sentiment');
      
      recommendations.push('Consider momentum strategies');
      recommendations.push('Look for breakout opportunities');
      recommendations.push('Watch for overextension signals');
      
      if (btcDominance > 50) {
        characteristics.push('Bitcoin leading the rally');
        recommendations.push('BTC strength suggests early bull phase');
      } else {
        characteristics.push('Altcoins outperforming (alt season)');
        recommendations.push('Consider quality altcoin positions');
      }
      
      confidence = 0.8;
      break;

    case MARKET_REGIMES.BEAR:
      characteristics.push('Downward price trend across market');
      characteristics.push('Declining volumes');
      characteristics.push('Negative market sentiment');
      
      recommendations.push('Focus on capital preservation');
      recommendations.push('Reduce position sizes');
      recommendations.push('Look for reversal signals before entry');
      
      if (btcDominance > 55) {
        characteristics.push('Flight to safety (Bitcoin)');
        recommendations.push('Avoid altcoins during bear market');
      }
      
      confidence = 0.8;
      break;

    case MARKET_REGIMES.SIDEWAYS:
      characteristics.push('Range-bound price action');
      characteristics.push('Lack of clear trend');
      characteristics.push('Lower volatility');
      
      recommendations.push('Range trading strategies work best');
      recommendations.push('Wait for clear breakout before trending positions');
      recommendations.push('Focus on mean reversion');
      
      confidence = 0.6;
      break;

    case MARKET_REGIMES.HIGH_VOLATILITY:
      characteristics.push('Rapid price swings');
      characteristics.push('Increased risk of whipsaws');
      characteristics.push('Heightened market uncertainty');
      
      recommendations.push('Reduce position sizes significantly');
      recommendations.push('Widen stop losses to avoid false triggers');
      recommendations.push('Consider sitting out until volatility subsides');
      
      if (volatilityIndex > 0.7) {
        characteristics.push('Extreme volatility conditions');
        recommendations.push('Strong recommendation to pause trading');
        confidence = 0.9;
      } else {
        confidence = 0.75;
      }
      break;
  }

  // Adjust for risk sentiment
  if (riskSentiment === 'risk-off') {
    characteristics.push('Traditional markets showing risk-off behavior');
    recommendations.push('Expect correlation with traditional market weakness');
    confidence *= 0.9;
  } else if (riskSentiment === 'risk-on') {
    characteristics.push('Traditional markets showing risk-on appetite');
  }

  logger.debug('Regime analysis completed', {
    regime: marketRegime,
    confidence: confidence.toFixed(2),
  });

  return {
    current: marketRegime,
    confidence,
    characteristics,
    recommendations,
  };
}

/**
 * Check if market conditions favor trading
 */
export function shouldTrade(context: MarketContext): {
  shouldTrade: boolean;
  reason: string;
} {
  // Don't trade in extreme volatility
  if (context.volatilityIndex > 0.8) {
    return {
      shouldTrade: false,
      reason: 'Extreme market volatility detected',
    };
  }

  // Be cautious during risk-off periods
  if (
    context.riskSentiment === 'risk-off' &&
    context.marketRegime === MARKET_REGIMES.BEAR
  ) {
    return {
      shouldTrade: false,
      reason: 'Risk-off sentiment combined with bear market',
    };
  }

  // High VIX indicates fear
  if (context.traditionalMarkets.vix > 35) {
    return {
      shouldTrade: false,
      reason: 'High VIX indicates market fear',
    };
  }

  return {
    shouldTrade: true,
    reason: 'Market conditions acceptable for trading',
  };
}

/**
 * Get correlation between crypto and traditional markets
 */
export async function calculateMarketCorrelation(
  _days: number = 30
): Promise<{
  btcSp500: number;
  btcGold: number;
  btcVix: number;
}> {
  try {
    // This is a simplified version - full implementation would calculate Pearson correlation
    // Using historical data from both crypto and traditional markets

    logger.info('Market correlation calculation placeholder');

    // Placeholder values - actual implementation would query historical data
    return {
      btcSp500: 0.3, // Weak positive correlation
      btcGold: -0.1, // Weak negative correlation
      btcVix: -0.4, // Moderate negative correlation (inverse)
    };
  } catch (error) {
    logger.error('Market correlation calculation failed', { error });
    return {
      btcSp500: 0,
      btcGold: 0,
      btcVix: 0,
    };
  }
}
