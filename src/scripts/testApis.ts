/**
 * API Health Check Script
 * Tests all external APIs to identify which ones are failing
 */

import { getCurrentPrice } from '../services/dataCollection/coinGeckoService';
import { getCandlesticks } from '../services/dataCollection/binanceService';
import { getCryptoNews } from '../services/dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../services/dataCollection/redditService';
import { logger } from '../utils/logger';

interface APITestResult {
  service: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  responseTime: number;
}

async function testAPI(
  name: string,
  testFn: () => Promise<any>
): Promise<APITestResult> {
  const startTime = Date.now();
  
  try {
    await testFn();
    const responseTime = Date.now() - startTime;
    
    logger.info(`✅ ${name} - SUCCESS`, { responseTime: `${responseTime}ms` });
    
    return {
      service: name,
      status: 'SUCCESS',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error(`❌ ${name} - FAILED`, {
      error: errorMessage,
      responseTime: `${responseTime}ms`,
    });
    
    return {
      service: name,
      status: 'FAILED',
      error: errorMessage,
      responseTime,
    };
  }
}

async function runAPIHealthCheck(): Promise<void> {
  console.log('\n🔬 Starting API Health Check...\n');
  
  const results: APITestResult[] = [];
  
  // Test CoinGecko
  results.push(
    await testAPI('CoinGecko (Price Data)', async () => {
      await getCurrentPrice('BTC');
    })
  );
  
  // Test Binance
  results.push(
    await testAPI('Binance (Candlestick Data)', async () => {
      await getCandlesticks('BTCUSDT', '1h', 10);
    })
  );
  
  // Test CryptoPanic
  results.push(
    await testAPI('CryptoPanic (News)', async () => {
      await getCryptoNews('BTC', 5);
    })
  );
  
  // Test Reddit (most likely to fail)
  results.push(
    await testAPI('Reddit (Social Sentiment)', async () => {
      await getCryptoMentions('BTC', 5);
    })
  );
  
  // Summary
  console.log('\n📊 Health Check Summary:\n');
  console.log('═'.repeat(60));
  
  results.forEach((result) => {
    const status = result.status === 'SUCCESS' ? '✅' : '❌';
    const time = `${result.responseTime}ms`;
    console.log(`${status} ${result.service.padEnd(35)} ${time.padStart(10)}`);
    
    if (result.error) {
      console.log(`   ⚠️  Error: ${result.error}`);
    }
  });
  
  console.log('═'.repeat(60));
  
  const failedCount = results.filter((r) => r.status === 'FAILED').length;
  const successCount = results.filter((r) => r.status === 'SUCCESS').length;
  
  console.log(`\n✅ Passed: ${successCount}  ❌ Failed: ${failedCount}\n`);
  
  if (failedCount > 0) {
    console.log('💡 Recommendation:');
    console.log('   - Check API keys in .env file');
    console.log('   - Verify network/firewall settings');
    console.log('   - Check if you\'ve hit rate limits');
    console.log('   - Try again in a few minutes\n');
  }
}

// Run the health check
runAPIHealthCheck()
  .then(() => {
    console.log('✅ Health check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });
