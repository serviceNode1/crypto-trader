/**
 * Test Coinbase API
 */

import axios from 'axios';

async function testCoinbase() {
  console.log('\n🔬 Testing Coinbase API...\n');
  
  const BASE_URL = 'https://api.exchange.coinbase.com';
  const product = 'BTC-USD';
  
  try {
    console.log(`📡 Testing endpoint: ${BASE_URL}/products/${product}/ticker`);
    
    const response = await axios.get(`${BASE_URL}/products/${product}/ticker`, {
      timeout: 10000
    });
    
    console.log('\n✅ SUCCESS! Coinbase API is working!\n');
    console.log('Response:');
    console.log(`  Product: ${product}`);
    console.log(`  Price: $${parseFloat(response.data.price).toFixed(2)}`);
    console.log(`  Bid: $${parseFloat(response.data.bid).toFixed(2)}`);
    console.log(`  Ask: $${parseFloat(response.data.ask).toFixed(2)}`);
    console.log(`  Volume: ${parseFloat(response.data.volume).toFixed(2)} BTC`);
    
    console.log('\n✨ Coinbase is a great alternative to Binance!\n');
    console.log('Benefits:');
    console.log('  ✅ 10,000 requests/hour (FREE)');
    console.log('  ✅ Available globally');
    console.log('  ✅ No API key required for public data');
    console.log('  ✅ Major coins supported\n');
    
  } catch (error: any) {
    console.error('\n❌ Coinbase test FAILED\n');
    
    if (error.response) {
      console.error('HTTP Error:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('Network error:', error.message);
      console.error('\nThis could indicate:');
      console.error('  - Internet connection issue');
      console.error('  - Firewall blocking the request');
      console.error('  - DNS resolution problem');
    } else {
      console.error('Error:', error.message);
    }
    
    process.exit(1);
  }
}

testCoinbase();
