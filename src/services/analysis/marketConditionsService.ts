/**
 * Market Conditions Service
 * Calculates market conditions and determines optimal review intervals
 */

import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { getMarketContext } from './marketContext';

export interface MarketConditions {
  timestamp: Date;
  marketRegime: 'bull' | 'bear' | 'sideways' | 'high_volatility';
  volatility: 'low' | 'medium' | 'high';
  riskSentiment: 'risk-on' | 'neutral' | 'risk-off';
  btcDominance: number;
  recommendedInterval: number; // hours
  reasoning: string;
}

/**
 * Calculate current market conditions
 */
export async function calculateMarketConditions(): Promise<MarketConditions> {
  try {
    // Get market context (already has regime, sentiment, BTC dominance)
    const context = await getMarketContext();

    // Calculate volatility from recent BTC price data
    const volatility = await calculateVolatility();

    // Determine optimal review interval based on conditions
    const { interval, reasoning } = calculateReviewInterval(
      context.marketRegime,
      volatility,
      context.riskSentiment
    );

    const conditions: MarketConditions = {
      timestamp: new Date(),
      marketRegime: context.marketRegime,
      volatility,
      riskSentiment: context.riskSentiment,
      btcDominance: context.btcDominance,
      recommendedInterval: interval,
      reasoning,
    };

    logger.info('Market conditions calculated', {
      regime: conditions.marketRegime,
      volatility: conditions.volatility,
      interval: conditions.recommendedInterval,
    });

    return conditions;
  } catch (error) {
    logger.error('Failed to calculate market conditions', { error });
    
    // Return safe defaults on error
    return {
      timestamp: new Date(),
      marketRegime: 'sideways',
      volatility: 'medium',
      riskSentiment: 'neutral',
      btcDominance: 50,
      recommendedInterval: 24, // Default to daily
      reasoning: 'Using default values due to calculation error',
    };
  }
}

/**
 * Calculate volatility from recent BTC price movements
 */
async function calculateVolatility(): Promise<'low' | 'medium' | 'high'> {
  try {
    // Get last 7 days of BTC daily candles
    const result = await query(`
      SELECT high, low, close
      FROM prices
      WHERE symbol = 'BTC'
        AND timeframe = '1d'
        AND time >= NOW() - INTERVAL '7 days'
      ORDER BY time DESC
      LIMIT 7
    `);

    if (!result.rows || result.rows.length < 7) {
      logger.warn('Insufficient data for volatility calculation, using medium');
      return 'medium';
    }

    // Calculate average true range (ATR) as percentage
    let totalRange = 0;
    for (const candle of result.rows) {
      const range = ((candle.high - candle.low) / candle.close) * 100;
      totalRange += range;
    }
    const avgRange = totalRange / result.rows.length;

    // Classify volatility
    // Low: < 3% daily range
    // Medium: 3-6% daily range
    // High: > 6% daily range
    if (avgRange < 3) {
      return 'low';
    } else if (avgRange < 6) {
      return 'medium';
    } else {
      return 'high';
    }
  } catch (error) {
    logger.error('Failed to calculate volatility', { error });
    return 'medium';
  }
}

/**
 * Calculate review interval based on market conditions (HYBRID APPROACH)
 * 
 * Strategy:
 * - BASELINE: 2 hours (default cron schedule)
 * - Speed up to 1-1.5hr when high activity/opportunities
 * - Slow down to max 4hr when very quiet
 * - Add urgent check triggers for extreme volatility spikes
 * 
 * Logic:
 * - High Volatility (any regime) = 1 hour (2x faster - catch opportunities)
 * - Bull + Medium Vol = 2 hours (baseline - normal operation)
 * - Bull + Low Vol = 3 hours (slightly slower - steady growth)
 * - Bear + High Vol = 1.5 hours (watch for reversals and bounces)
 * - Bear + Medium Vol = 2 hours (baseline - still opportunities for DCA/bounces)
 * - Bear + Low Vol = 3 hours (slower - but not too slow)
 * - Sideways + Low Vol = 4 hours (slowest - minimal activity)
 * - Extreme Volatility = 1 hour + urgent check flag
 * 
 * Risk sentiment adjustments:
 * - Risk-off: Add 1 hour (more cautious, but never exceed 4hr)
 * - Risk-on + Bull: Subtract 30 min (more aggressive, min 1hr)
 */
export function calculateReviewInterval(
  regime: 'bull' | 'bear' | 'sideways' | 'high_volatility',
  volatility: 'low' | 'medium' | 'high',
  riskSentiment: 'risk-on' | 'neutral' | 'risk-off'
): { interval: number; reasoning: string } {
  let interval = 2; // Baseline: 2 hours
  let reasoning = '';

  // Base interval on regime and volatility
  if (regime === 'bull') {
    if (volatility === 'high') {
      interval = 1;
      reasoning = 'High volatility bull market - increased monitoring frequency';
    } else if (volatility === 'medium') {
      interval = 2;
      reasoning = 'Active bull market - standard monitoring';
    } else {
      interval = 3;
      reasoning = 'Steady bull market - reduced monitoring';
    }
  } else if (regime === 'bear') {
    if (volatility === 'high') {
      interval = 1.5;
      reasoning = 'Volatile bear market - watching for reversal signals';
    } else if (volatility === 'medium') {
      interval = 2;
      reasoning = 'Bear market with activity - monitoring for opportunities';
    } else {
      interval = 3;
      reasoning = 'Quiet bear market - patient monitoring';
    }
  } else if (regime === 'high_volatility') {
    // Extreme volatility - maximum frequency
    interval = 1;
    reasoning = 'Extreme volatility detected - maximum monitoring frequency';
  } else {
    // Sideways
    if (volatility === 'low') {
      interval = 4;
      reasoning = 'Low activity sideways market - minimal monitoring';
    } else if (volatility === 'medium') {
      interval = 2;
      reasoning = 'Sideways market with some activity - standard monitoring';
    } else {
      interval = 1.5;
      reasoning = 'Volatile sideways market - watching for breakout';
    }
  }

  // Adjust for risk sentiment (but cap at 1hr min, 4hr max)
  if (riskSentiment === 'risk-off') {
    // More cautious - extend interval
    const oldInterval = interval;
    interval = Math.min(interval + 1, 4);
    if (interval !== oldInterval) {
      reasoning += ' • Extended due to risk-off sentiment';
    }
  } else if (riskSentiment === 'risk-on' && regime === 'bull') {
    // More aggressive in bull markets
    const oldInterval = interval;
    interval = Math.max(interval - 0.5, 1);
    if (interval !== oldInterval) {
      reasoning += ' • Accelerated due to risk-on sentiment';
    }
  }

  return { interval, reasoning };
}

/**
 * Log market conditions to database for historical tracking
 */
export async function logMarketConditions(conditions: MarketConditions): Promise<void> {
  try {
    // Map to existing table schema
    const metadata = {
      riskSentiment: conditions.riskSentiment,
      reasoning: conditions.reasoning,
      timestamp: conditions.timestamp.toISOString(),
    };

    await query(`
      INSERT INTO market_conditions_log (
        volatility_level,
        btc_dominance,
        market_regime,
        review_interval_minutes,
        metadata
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      conditions.volatility,
      conditions.btcDominance,
      conditions.marketRegime === 'high_volatility' ? 'volatile' : conditions.marketRegime,
      conditions.recommendedInterval * 60, // Convert hours to minutes
      JSON.stringify(metadata),
    ]);

    logger.info('Market conditions logged to database');
  } catch (error) {
    logger.error('Failed to log market conditions', { error });
    // Don't throw - logging failure shouldn't break the flow
  }
}

/**
 * Get latest market conditions from database (for quick retrieval)
 */
export async function getLatestMarketConditions(): Promise<MarketConditions | null> {
  try {
    const result = await query(`
      SELECT 
        created_at,
        market_regime,
        volatility_level,
        btc_dominance,
        review_interval_minutes,
        metadata
      FROM market_conditions_log
      ORDER BY created_at DESC
      LIMIT 1
    `);

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const metadata = row.metadata || {};
    
    return {
      timestamp: row.created_at,
      marketRegime: row.market_regime === 'volatile' ? 'high_volatility' : row.market_regime,
      volatility: row.volatility_level,
      riskSentiment: metadata.riskSentiment || 'neutral',
      btcDominance: parseFloat(row.btc_dominance),
      recommendedInterval: row.review_interval_minutes / 60, // Convert minutes to hours
      reasoning: metadata.reasoning || 'No reasoning available',
    };
  } catch (error) {
    logger.error('Failed to get latest market conditions', { error });
    return null;
  }
}
