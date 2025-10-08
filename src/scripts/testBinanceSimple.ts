/**
 * Simple Direct Binance Test
 * No dependencies, just raw axios
 */

import axios from 'axios';

async function testBinance() {
  console.log('\n🔬 Testing Binance Endpoints...\n');
  
  // Test both endpoints
  const endpoints = [
    { name: 'Binance.US', url: 'https://api.binance.us/api/v3' },
    { name: 'Binance Global', url: 'https://api.binance.com/api/v3' }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing ${endpoint.name}...`);
    console.log(`   URL: ${endpoint.url}/ticker/24hr?symbol=BTCUSDT`);
    
    try {
      const response = await axios.get(`${endpoint.url}/ticker/24hr`, {
        params: { symbol: 'BTCUSDT' },
        timeout: 10000
      });
      
      console.log(`   ✅ SUCCESS! ${endpoint.name} is working!`);
      console.log(`   Price: $${parseFloat(response.data.lastPrice).toFixed(2)}`);
      console.log(`   24h Change: ${parseFloat(response.data.priceChangePercent).toFixed(2)}%`);
      
    } catch (error: any) {
      console.log(`   ❌ FAILED: ${endpoint.name}`);
      
      if (error.response) {
        console.log(`   HTTP Error: ${error.response.status}`);
        if (error.response.status === 451) {
          console.log(`   ⚠️  Blocked by region (Error 451)`);
        }
      } else if (error.code === 'ENOENT' || error.code === 'ENOTFOUND') {
        console.log(`   ⚠️  DNS resolution failed - cannot reach this endpoint`);
      } else {
        console.log(`   ⚠️  ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Summary:');
  console.log('If Binance Global works but Binance.US fails:');
  console.log('  → Set BINANCE_REGION=GLOBAL in .env');
  console.log('\nIf both fail:');
  console.log('  → Check your internet connection');
  console.log('  → Check firewall/proxy settings');
  console.log('\n');
}

testBinance().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
