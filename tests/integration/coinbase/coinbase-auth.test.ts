/**
 * Test Coinbase API with Authentication
 * Verifies API keys are configured correctly
 */

import dotenv from 'dotenv';
dotenv.config();

import { getCandlesticks, get24hrTicker, getOrderBookDepth, getProducts } from '../../../src/services/dataCollection/coinbaseService';
import { initRedis } from '../../../src/config/redis';

async function testCoinbaseAuth() {
  console.log('\n🔬 Testing Coinbase API with Authentication...\n');
  
  // Initialize Redis
  try {
    await initRedis();
    console.log('✅ Redis initialized\n');
  } catch (error) {
    console.warn('⚠️  Redis not available (tests will work without cache)\n');
  }
  
  // Check API key configuration
  const hasReadKey = !!(process.env.COINBASE_API_KEY && process.env.COINBASE_API_SECRET);
  const hasTradingKey = !!(process.env.COINBASE_API_KEY_TRADING && process.env.COINBASE_API_SECRET_TRADING);
  
  console.log('📋 API Key Configuration:');
  console.log(`   Read-only Key: ${hasReadKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Trading Key: ${hasTradingKey ? '✅ Configured' : '❌ Missing'}`);
  console.log('');
  
  let successCount = 0;
  let failCount = 0;
  
  // Test 1: Get Available Products
  console.log('📊 Test 1: Fetching available products...');
  try {
    const products = await getProducts();
    const btcProduct = products.find(p => p.id === 'BTC-USD');
    console.log(`   ✅ SUCCESS: ${products.length} trading pairs available`);
    if (btcProduct) {
      console.log(`   BTC-USD status: ${btcProduct.status}`);
    }
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Test 2: Get Candlesticks (OHLC Data)
  console.log('\n📈 Test 2: Fetching candlestick data for BTC...');
  try {
    const candles = await getCandlesticks('BTC', '1h', 10);
    console.log(`   ✅ SUCCESS: Got ${candles.length} candlesticks`);
    const latest = candles[candles.length - 1];
    console.log(`   Latest candle:`);
    console.log(`     Open: $${latest.open.toFixed(2)}`);
    console.log(`     High: $${latest.high.toFixed(2)}`);
    console.log(`     Low: $${latest.low.toFixed(2)}`);
    console.log(`     Close: $${latest.close.toFixed(2)}`);
    console.log(`     Volume: ${latest.volume.toFixed(4)} BTC`);
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Test 3: Get 24hr Ticker
  console.log('\n💰 Test 3: Fetching 24hr ticker for BTC...');
  try {
    const ticker = await get24hrTicker('BTC');
    console.log(`   ✅ SUCCESS: 24hr Ticker`);
    console.log(`   Price: $${parseFloat(ticker.lastPrice).toFixed(2)}`);
    console.log(`   24h Change: ${ticker.priceChangePercent}%`);
    console.log(`   24h Volume: ${parseFloat(ticker.volume).toFixed(2)} BTC`);
    console.log(`   Bid: $${parseFloat(ticker.bidPrice).toFixed(2)}`);
    console.log(`   Ask: $${parseFloat(ticker.askPrice).toFixed(2)}`);
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Test 4: Get Order Book Depth
  console.log('\n📖 Test 4: Fetching order book for BTC...');
  try {
    const orderBook = await getOrderBookDepth('BTC', 10);
    console.log(`   ✅ SUCCESS: Order Book`);
    console.log(`   Best Bid: $${parseFloat(orderBook.bids[0][0]).toFixed(2)} (${orderBook.bids[0][1]} BTC)`);
    console.log(`   Best Ask: $${parseFloat(orderBook.asks[0][0]).toFixed(2)} (${orderBook.asks[0][1]} BTC)`);
    const spread = parseFloat(orderBook.asks[0][0]) - parseFloat(orderBook.bids[0][0]);
    console.log(`   Spread: $${spread.toFixed(2)}`);
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary:`);
  console.log(`   ✅ Passed: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('');
  
  if (failCount === 0) {
    console.log('🎉 All tests PASSED! Coinbase integration is working!\n');
    console.log('✨ Ready for:');
    console.log('   - Technical analysis with Coinbase candlesticks');
    console.log('   - Real-time price data');
    console.log('   - Order book depth for slippage calculation');
    console.log('   - Paper trading with accurate market data\n');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.\n');
    console.log('Common issues:');
    console.log('   - API keys not configured correctly in .env');
    console.log('   - Special characters in secrets need quotes');
    console.log('   - Network/firewall issues');
    console.log('   - Trading pair not available on Coinbase\n');
  }
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run the test
testCoinbaseAuth().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
