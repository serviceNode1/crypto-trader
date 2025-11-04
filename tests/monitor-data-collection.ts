/**
 * Monitor data collection progress
 * Run this while the app is running to see when data arrives
 */

import { query } from '../src/config/database';

async function monitorDataCollection() {
  console.log('\n📊 Monitoring Data Collection...\n');
  console.log('Checking every 10 seconds. Press Ctrl+C to stop.\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const checkInterval = setInterval(async () => {
    try {
      const timestamp = new Date().toLocaleTimeString();
      
      // Check prices table
      const pricesResult = await query(`
        SELECT COUNT(*) as count, MAX(time) as latest
        FROM prices
        WHERE symbol = 'BTC'
      `);
      
      const pricesCount = parseInt(pricesResult.rows[0].count);
      const latestPrice = pricesResult.rows[0].latest;
      
      if (pricesCount > 0) {
        console.log(`[${timestamp}] ✅ PRICES: ${pricesCount} BTC records | Latest: ${latestPrice}`);
        console.log('\n🎉 Data collection is working! You can now test recommendations.\n');
        console.log('Run: npx ts-node scripts/trigger-recommendation-job.ts\n');
        clearInterval(checkInterval);
        process.exit(0);
      } else {
        console.log(`[${timestamp}] ⏳ Waiting for price data... (prices table still empty)`);
      }
    } catch (error: any) {
      const errorTimestamp = new Date().toLocaleTimeString();
      console.log(`[${errorTimestamp}] ❌ Error: ${error.message}`);
    }
  }, 10000); // Check every 10 seconds

  // Initial check
  setTimeout(async () => {
    try {
      const initialTimestamp = new Date().toLocaleTimeString();
      const result = await query(`SELECT COUNT(*) as count FROM prices WHERE symbol = 'BTC'`);
      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        console.log(`[${initialTimestamp}] ✅ Prices table already has ${count} BTC records!\n`);
        console.log('Data collection is working. You can test recommendations now.\n');
        clearInterval(checkInterval);
        process.exit(0);
      }
    } catch (error) {
      // Table might not exist yet
    }
  }, 1000);
}

monitorDataCollection();
