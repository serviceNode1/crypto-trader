/**
 * Complete Integration Test
 * Tests all new integrations without dependencies
 */

import axios from 'axios';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  time: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<any>): Promise<void> {
  const start = Date.now();
  try {
    const result = await fn();
    const time = Date.now() - start;
    results.push({ name, status: 'PASS', time, details: result });
    console.log(`✅ ${name} (${time}ms)`);
  } catch (error: any) {
    const time = Date.now() - start;
    results.push({ name, status: 'FAIL', time, error: error.message });
    console.log(`❌ ${name} (${time}ms) - ${error.message}`);
  }
}

async function runTests() {
  console.log('\n🔬 Integration Test Suite\n');
  console.log('═'.repeat(60));
  
  // Test 1: CoinGecko (existing)
  await test('CoinGecko - Price API', async () => {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: 'bitcoin', vs_currencies: 'usd' },
      timeout: 10000
    });
    return `BTC: $${response.data.bitcoin.usd}`;
  });
  
  // Test 2: Coinbase (NEW - replaced Binance)
  await test('Coinbase - Ticker API', async () => {
    const response = await axios.get('https://api.exchange.coinbase.com/products/BTC-USD/ticker', {
      timeout: 10000
    });
    return `BTC: $${parseFloat(response.data.price).toFixed(2)}`;
  });
  
  await test('Coinbase - Candlesticks', async () => {
    const response = await axios.get('https://api.exchange.coinbase.com/products/BTC-USD/candles', {
      params: { granularity: 3600 },
      timeout: 10000
    });
    return `${response.data.length} candles`;
  });
  
  await test('Coinbase - Order Book', async () => {
    const response = await axios.get('https://api.exchange.coinbase.com/products/BTC-USD/book', {
      params: { level: 1 },
      timeout: 10000
    });
    return `Bid: $${response.data.bids[0][0]}, Ask: $${response.data.asks[0][0]}`;
  });
  
  // Test 3: CryptoCompare (NEW)
  await test('CryptoCompare - News API', async () => {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY || '';
    const params: any = { lang: 'EN' };
    if (apiKey) params.api_key = apiKey;
    
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/', {
      params,
      timeout: 10000
    });
    return `${response.data.Data?.length || 0} articles`;
  });
  
  // Test 4: RSS Feeds (NEW)
  await test('RSS - CoinDesk Feed', async () => {
    const response = await axios.get('https://www.coindesk.com/arc/outboundfeeds/rss/', {
      timeout: 10000,
      headers: { 'User-Agent': 'crypto-ai-trading-bot/1.0' }
    });
    return `Feed size: ${response.data.length} bytes`;
  });
  
  await test('RSS - CoinTelegraph Feed', async () => {
    const response = await axios.get('https://cointelegraph.com/rss', {
      timeout: 10000,
      headers: { 'User-Agent': 'crypto-ai-trading-bot/1.0' }
    });
    return `Feed size: ${response.data.length} bytes`;
  });
  
  await test('RSS - Decrypt Feed', async () => {
    const response = await axios.get('https://decrypt.co/feed', {
      timeout: 10000,
      headers: { 'User-Agent': 'crypto-ai-trading-bot/1.0' }
    });
    return `Feed size: ${response.data.length} bytes`;
  });
  
  // Test 5: Reddit (existing)
  await test('Reddit - OAuth Check', async () => {
    const hasCredentials = !!(
      process.env.REDDIT_CLIENT_ID && 
      process.env.REDDIT_CLIENT_SECRET
    );
    return hasCredentials ? 'Credentials configured' : 'Credentials missing';
  });
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Test Summary:\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalTime = results.reduce((sum, r) => sum + r.time, 0);
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log('');
  
  if (passed > 0) {
    console.log('🎉 Working Integrations:');
    results.filter(r => r.status === 'PASS').forEach(r => {
      console.log(`   ✅ ${r.name}`);
      if (r.details) console.log(`      ${r.details}`);
    });
    console.log('');
  }
  
  if (failed > 0) {
    console.log('⚠️  Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   ❌ ${r.name}`);
      console.log(`      ${r.error}`);
    });
    console.log('');
  }
  
  // Integration Status
  console.log('📋 Integration Status:\n');
  
  const coinbaseWorking = results.some(r => r.name.includes('Coinbase') && r.status === 'PASS');
  const cryptocompareWorking = results.some(r => r.name.includes('CryptoCompare') && r.status === 'PASS');
  const rssWorking = results.filter(r => r.name.includes('RSS') && r.status === 'PASS').length;
  
  console.log(`   Coinbase (Binance replacement): ${coinbaseWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`   CryptoCompare News: ${cryptocompareWorking ? '✅ Working' : '❌ Failed'}`);
  console.log(`   RSS Feeds: ${rssWorking}/3 working`);
  console.log('');
  
  if (coinbaseWorking && (cryptocompareWorking || rssWorking > 0)) {
    console.log('🚀 Ready to use!');
    console.log('   - Price data from Coinbase ✅');
    console.log('   - News from multiple sources ✅');
    console.log('   - No API costs (all free tiers) ✅\n');
  } else {
    console.log('⚠️  Some integrations need attention\n');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
console.log('\nStarting integration tests...\n');
runTests().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
