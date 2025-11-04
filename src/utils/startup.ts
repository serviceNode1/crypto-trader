/**
 * Startup utilities for application initialization
 */

import { getCandlesticks } from '../services/dataCollection/coinbaseService';
import { query } from '../config/database';
import { logger } from './logger';

const CRITICAL_SYMBOLS = ['BTC', 'ETH']; // Essential for market regime detection
const TIMEFRAME = '1d';
const DAYS_OF_HISTORY = 90;

/**
 * Ensure prices table has minimum required data for market analysis
 * This runs on startup to populate historical data if missing
 */
export async function ensurePricesData(): Promise<void> {
  try {
    logger.info('Checking prices table for historical data...');

    for (const symbol of CRITICAL_SYMBOLS) {
      // Check if we have recent data
      const checkResult = await query(`
        SELECT COUNT(*) as count, MAX(time) as latest
        FROM prices
        WHERE symbol = $1 AND timeframe = $2
      `, [symbol, TIMEFRAME]);

      const count = parseInt(checkResult.rows[0].count);
      const latest = checkResult.rows[0].latest;

      // If we have data and it's recent (within 2 days), skip
      if (count > 0 && latest) {
        const daysSinceUpdate = (Date.now() - new Date(latest).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 2 && count >= 30) {
          logger.info(`${symbol} prices up to date (${count} records, latest: ${latest})`);
          continue;
        }
      }

      // Need to populate or update
      logger.info(`Populating ${symbol} price history (${DAYS_OF_HISTORY} days)...`);

      try {
        const candles = await getCandlesticks(symbol, TIMEFRAME, DAYS_OF_HISTORY);

        if (candles.length === 0) {
          logger.warn(`No candlestick data available for ${symbol}`);
          continue;
        }

        let inserted = 0;
        for (const candle of candles) {
          try {
            const timestamp = new Date(candle.openTime);

            await query(`
              INSERT INTO prices (time, symbol, open, high, low, close, volume, timeframe)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (symbol, timeframe, time) 
              DO UPDATE SET
                open = EXCLUDED.open,
                high = EXCLUDED.high,
                low = EXCLUDED.low,
                close = EXCLUDED.close,
                volume = EXCLUDED.volume
            `, [
              timestamp,
              symbol,
              candle.open,
              candle.high,
              candle.low,
              candle.close,
              candle.volume,
              TIMEFRAME
            ]);

            inserted++;
          } catch (error: any) {
            // Ignore duplicate key errors
            if (error.code !== '23505') {
              logger.error(`Failed to insert candle for ${symbol}`, { error });
            }
          }
        }

        logger.info(`✓ ${symbol}: ${inserted} candles stored`);

      } catch (error) {
        logger.error(`Failed to populate ${symbol} prices`, { error });
        // Don't throw - continue with other symbols
      }
    }

    logger.info('✓ Prices table check completed');
  } catch (error) {
    logger.error('Failed to ensure prices data', { error });
    // Don't throw - this shouldn't prevent app startup
  }
}
