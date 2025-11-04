/**
 * Manually trigger a recommendation job to test Phase 1 changes
 */

import { processRecommendation } from '../src/jobs/processors/recommendationProcessor';
import { logger } from '../src/utils/logger';
import { initRedis } from '../src/config/redis';

async function triggerRecommendationJob() {
  try {
    console.log('\n🚀 Triggering recommendation job...\n');
    console.log('Initializing Redis...');
    
    // Initialize Redis first
    await initRedis();
    console.log('✅ Redis initialized\n');
    
    console.log('This will:');
    console.log('  1. Run discovery for all 3 strategies (Conservative, Moderate, Aggressive)');
    console.log('  2. Generate AI recommendations for top opportunities');
    console.log('  3. Store BUY recommendations in discovery_recommendations table');
    console.log('  4. Skip SELL recommendations (handled separately in Phase 3)\n');
    console.log('⏳ This may take 2-5 minutes depending on API response times...\n');

    const startTime = Date.now();

    // Create a mock job object
    const mockJob = {
      data: {
        maxBuy: 3,  // Generate 3 BUY recommendations per strategy
        maxSell: 0, // Skip SELL for global jobs
      },
      id: 'manual-trigger-' + Date.now(),
    } as any;

    await processRecommendation(mockJob);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n✅ Recommendation job completed in ${duration} seconds!\n`);
    console.log('Checking results...\n');

    // Check what was created
    const { query } = await import('../src/config/database');
    
    const result = await query(`
      SELECT strategy, coin_universe, COUNT(*) as count
      FROM discovery_recommendations
      WHERE created_at > NOW() - INTERVAL '10 minutes'
      GROUP BY strategy, coin_universe
      ORDER BY strategy, coin_universe
    `);

    if (result.rows.length > 0) {
      console.log('📊 Recommendations created:\n');
      result.rows.forEach(row => {
        console.log(`  ${row.strategy} / ${row.coin_universe}: ${row.count} recommendations`);
      });
      console.log('');
    } else {
      console.log('⚠️  No recommendations were created (this might be normal if no opportunities found)\n');
    }

    // Show sample recommendations
    const sampleResult = await query(`
      SELECT symbol, strategy, confidence, discovery_score, created_at
      FROM discovery_recommendations
      WHERE created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY confidence DESC
      LIMIT 5
    `);

    if (sampleResult.rows.length > 0) {
      console.log('🎯 Top 5 recommendations:\n');
      sampleResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.symbol} (${row.strategy})`);
        console.log(`   Confidence: ${row.confidence}% | Discovery Score: ${row.discovery_score}`);
        console.log(`   Created: ${row.created_at}\n`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Job failed:', error);
    logger.error('Manual recommendation job failed', { error });
    process.exit(1);
  }
}

triggerRecommendationJob();
