/**
 * Direct Binance API Test
 * Tests that Binance.US endpoint is working correctly
 */

import dotenv from 'dotenv';
dotenv.config();

import { getCandlesticks, get24hrTicker, getOrderBookDepth } from '../services/dataCollection/binanceService';
import { initRedis } from '../config/redis';

async function testBinanceAPI(): Promise<void> {
  // Initialize Redis for caching
  try {
    await initRedis();
    console.log('✅ Redis initialized');
  } catch (error) {
    console.warn('⚠️  Redis not available (caching disabled)');
  }
  console.log('\n🔬 Testing Binance.US API...\n');
  
  const testSymbol = 'BTCUSDT';
  
  try {
    // Test 1: Get Candlesticks
    console.log('📊 Test 1: Fetching candlesticks for', testSymbol);
    const candlesticks = await getCandlesticks(testSymbol, '1h', 10);
    console.log(`✅ SUCCESS: Got ${candlesticks.length} candlesticks`);
    console.log(`   Latest close: $${candlesticks[candlesticks.length - 1].close.toFixed(2)}`);
    
    // Test 2: Get 24hr Ticker
    console.log('\n📈 Test 2: Fetching 24hr statistics for', testSymbol);
    const ticker = await get24hrTicker(testSymbol);
    console.log(`✅ SUCCESS: 24hr Ticker`);
    console.log(`   Price: $${parseFloat(ticker.lastPrice).toFixed(2)}`);
    console.log(`   24h Change: ${parseFloat(ticker.priceChangePercent).toFixed(2)}%`);
    console.log(`   24h Volume: ${parseFloat(ticker.volume).toFixed(0)} BTC`);
    
    // Test 3: Get Order Book Depth
    console.log('\n📖 Test 3: Fetching order book depth for', testSymbol);
    const orderBook = await getOrderBookDepth(testSymbol, 10);
    console.log(`✅ SUCCESS: Order Book`);
    console.log(`   Best Bid: $${parseFloat(orderBook.bids[0][0]).toFixed(2)}`);
    console.log(`   Best Ask: $${parseFloat(orderBook.asks[0][0]).toFixed(2)}`);
    console.log(`   Spread: $${(parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0])).toFixed(2)}`);
    
    console.log('\n🎉 All Binance.US tests PASSED!\n');
  } catch (error) {
    console.error('\n❌ Binance test FAILED:', error);
    
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      
      // Check for common issues
      if (error.message.includes('451')) {
        console.error('\n⚠️  ERROR 451: This means Binance.com is blocked in your region.');
        console.error('   Solution: Make sure BINANCE_REGION=US is set in .env');
      } else if (error.message.includes('400')) {
        console.error('\n⚠️  ERROR 400: Invalid symbol or parameters.');
        console.error('   Note: Binance.US has fewer trading pairs than global Binance.');
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        console.error('\n⚠️  Network error: Check your internet connection.');
      }
    }
    
    process.exit(1);
  }
}

// Run the test
testBinanceAPI()
  .then(() => {
    console.log('✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  });
