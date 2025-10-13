/**
 * Quick Coinbase Test (no Redis required)
 */

import axios from 'axios';

const BASE_URL = 'https://api.exchange.coinbase.com';

async function testCoinbase() {
  console.log('\n🔬 Quick Coinbase Test...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  // Test 1: Products
  console.log('📊 Test 1: Fetching products...');
  try {
    const response = await axios.get(`${BASE_URL}/products`);
    const btc = response.data.find((p: any) => p.id === 'BTC-USD');
    console.log(`   ✅ SUCCESS: ${response.data.length} products, BTC-USD status: ${btc?.status}`);
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Test 2: Ticker
  console.log('\n💰 Test 2: Fetching BTC ticker...');
  try {
    const response = await axios.get(`${BASE_URL}/products/BTC-USD/ticker`);
    console.log(`   ✅ SUCCESS: BTC Price $${parseFloat(response.data.price).toFixed(2)}`);
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Test 3: Candles
  console.log('\n📈 Test 3: Fetching candlesticks...');
  try {
    const response = await axios.get(`${BASE_URL}/products/BTC-USD/candles`, {
      params: { granularity: 3600 } // 1 hour
    });
    console.log(`   ✅ SUCCESS: Got ${response.data.length} candles`);
    successCount++;
  } catch (error: any) {
    console.log(`   ❌ FAILED: ${error.message}`);
    failCount++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n✅ Passed: ${successCount}  ❌ Failed: ${failCount}\n`);
  
  if (failCount === 0) {
    console.log('🎉 Coinbase integration is working!\n');
  } else {
    console.log('⚠️  Some tests failed\n');
  }
  
  process.exit(failCount > 0 ? 1 : 0);
}

testCoinbase();
