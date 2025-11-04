/**
 * Populate the prices table with historical candlestick data
 * This is needed for market regime detection and technical analysis
 */

import { getCandlesticks } from '../src/services/dataCollection/coinbaseService';
import { query } from '../src/config/database';
import { logger } from '../src/utils/logger';
import { initRedis } from '../src/config/redis';

const SYMBOLS_TO_POPULATE = ['BTC', 'ETH']; // Start with major coins
const TIMEFRAME = '1d'; // Daily candles for market regime detection
const DAYS_OF_HISTORY = 90; // 90 days of data

async function populatePricesTable() {
  try {
    console.log('\n📊 Populating prices table with historical data...\n');
    
    // Initialize Redis for caching
    await initRedis();
    console.log('✅ Redis initialized\n');

    for (const symbol of SYMBOLS_TO_POPULATE) {
      console.log(`📈 Fetching ${DAYS_OF_HISTORY} days of ${symbol} data...`);
      
      try {
        // Fetch candlestick data
        const candles = await getCandlesticks(symbol, TIMEFRAME, DAYS_OF_HISTORY);
        
        if (candles.length === 0) {
          console.log(`  ⚠️  No data available for ${symbol}\n`);
          continue;
        }

        console.log(`  ✅ Fetched ${candles.length} candles`);
        console.log(`  💾 Storing in database...`);

        let inserted = 0;
        let skipped = 0;

        for (const candle of candles) {
          try {
            // Convert timestamp to PostgreSQL timestamp
            const timestamp = new Date(candle.openTime);

            // Insert or update (upsert) to avoid duplicates
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
            if (error.code === '23505') {
              // Duplicate key - already exists
              skipped++;
            } else {
              logger.error(`Failed to insert candle for ${symbol}`, { error });
            }
          }
        }

        console.log(`  ✅ Inserted: ${inserted}, Skipped: ${skipped}\n`);

      } catch (error) {
        console.error(`  ❌ Failed to fetch data for ${symbol}:`, error);
        console.log('');
      }
    }

    // Verify what was stored
    console.log('═══════════════════════════════════════');
    console.log('VERIFICATION');
    console.log('═══════════════════════════════════════\n');

    for (const symbol of SYMBOLS_TO_POPULATE) {
      const result = await query(`
        SELECT COUNT(*) as count,
               MIN(time) as oldest,
               MAX(time) as newest
        FROM prices
        WHERE symbol = $1 AND timeframe = $2
      `, [symbol, TIMEFRAME]);

      const { count, oldest, newest } = result.rows[0];
      
      console.log(`${symbol}:`);
      console.log(`  Records: ${count}`);
      console.log(`  Oldest: ${oldest || 'N/A'}`);
      console.log(`  Newest: ${newest || 'N/A'}\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log('✅ Prices table populated successfully!');
    console.log('═══════════════════════════════════════\n');
    console.log('Next step: Run recommendation job again:');
    console.log('  npx ts-node scripts/trigger-recommendation-job.ts\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to populate prices table:', error);
    logger.error('Price table population failed', { error });
    process.exit(1);
  }
}

populatePricesTable();
