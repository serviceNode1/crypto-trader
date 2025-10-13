import { Job } from 'bull';
import { generateActionableRecommendations } from '../../services/discovery/opportunityFinder';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';

interface RecommendationJobData {
  symbol?: string;
  maxBuy?: number;
  maxSell?: number;
}

/**
 * Store recommendation in database
 */
async function storeRecommendation(recommendation: any): Promise<void> {
  try {
    await query(
      `INSERT INTO recommendations (
        symbol, action, confidence, entry_price, stop_loss,
        take_profit_1, take_profit_2, position_size, risk_level,
        reasoning, sources, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '24 hours')`,
      [
        recommendation.symbol,
        recommendation.action,
        recommendation.confidence,
        recommendation.entryPrice,
        recommendation.stopLoss,
        recommendation.takeProfitLevels?.[0] || null,
        recommendation.takeProfitLevels?.[1] || null,
        recommendation.positionSize,
        recommendation.riskLevel,
        JSON.stringify(recommendation.reasoning || recommendation.keyFactors),
        JSON.stringify(recommendation.sources || []),
      ]
    );
    
    logger.info(`Stored ${recommendation.action} recommendation for ${recommendation.symbol}`);
  } catch (error) {
    logger.error(`Failed to store recommendation for ${recommendation.symbol}`, { error });
    throw error;
  }
}

/**
 * Process recommendation generation jobs
 * New workflow: Discovery → Filter → Opportunities → AI Analysis → Actionable Recommendations
 */
export async function processRecommendation(job: Job<RecommendationJobData>): Promise<void> {
  const { maxBuy = 3, maxSell = 3 } = job.data;
  
  logger.info('🚀 Processing recommendation job with new opportunity-based workflow');
  
  try {
    // Use the new intelligent opportunity finder
    // This will:
    // 1. Run discovery (or use cached results)
    // 2. Filter for buy opportunities (not in portfolio)
    // 3. Filter for sell opportunities (in portfolio)
    // 4. Send only top candidates to AI
    // 5. Only return BUY/SELL recommendations (no HOLD)
    
    const result = await generateActionableRecommendations(maxBuy, maxSell);
    
    // Store buy recommendations
    for (const rec of result.buyRecommendations) {
      await storeRecommendation(rec);
    }
    
    // Store sell recommendations
    for (const rec of result.sellRecommendations) {
      await storeRecommendation(rec);
    }
    
    logger.info(`✅ Recommendation job completed: ${result.buyRecommendations.length} BUY, ${result.sellRecommendations.length} SELL`);
    logger.info(`⏭️  Skipped ${result.skipped.buy} lower-priority buy opportunities, ${result.skipped.sell} sell opportunities`);
    
  } catch (error) {
    logger.error('❌ Recommendation job failed', { error });
    throw error;
  }
}
