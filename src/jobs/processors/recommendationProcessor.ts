import { Job } from 'bull';
import { generateActionableRecommendations } from '../../services/discovery/opportunityFinder';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { logAIReview, updateAIReviewLog } from '../../services/logging/aiReviewLogger';

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
  const startTime = Date.now();
  
  logger.info('🚀 Processing recommendation job with new opportunity-based workflow');
  
  // Create initial log entry
  const logId = await logAIReview({
    reviewType: 'scheduled',
    status: 'started',
    phase: 'discovery',
    timestamp: new Date()
  });
  
  try {
    // Phase 1: Discovery
    await updateAIReviewLog(logId, { phase: 'discovery', status: 'started' });
    
    // Use the new intelligent opportunity finder
    // This will:
    // 1. Run discovery (or use cached results)
    // 2. Filter for buy opportunities (not in portfolio)
    // 3. Filter for sell opportunities (in portfolio)
    // 4. Send only top candidates to AI
    // 5. Only return BUY/SELL recommendations (no HOLD)
    
    await updateAIReviewLog(logId, { phase: 'ai_analysis' });
    const result = await generateActionableRecommendations(maxBuy, maxSell);
    
    // Phase 2: Storing recommendations
    await updateAIReviewLog(logId, { phase: 'storing' });
    
    // Store buy recommendations
    for (const rec of result.buyRecommendations) {
      await storeRecommendation(rec);
    }
    
    // Store sell recommendations
    for (const rec of result.sellRecommendations) {
      await storeRecommendation(rec);
    }
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Update log with final results
    await updateAIReviewLog(logId, {
      status: 'completed',
      phase: 'completed',
      coinsAnalyzed: result.metadata.totalAnalyzed,
      buyRecommendations: result.buyRecommendations.length,
      sellRecommendations: result.sellRecommendations.length,
      skippedOpportunities: (result.skipped.buy || 0) + (result.skipped.sell || 0),
      duration,
      metadata: {
        maxBuy,
        maxSell,
        skipped: result.skipped,
        totalAnalyzed: result.metadata.totalAnalyzed,
        totalOpportunities: result.metadata.totalOpportunities,
        aiRejected: result.metadata.aiRejected
      }
    });
    
    logger.info(`✅ Recommendation job completed: ${result.buyRecommendations.length} BUY, ${result.sellRecommendations.length} SELL (${duration}ms)`);
    logger.info(`⏭️  Skipped ${result.skipped.buy} lower-priority buy opportunities, ${result.skipped.sell} sell opportunities`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log the failure
    await updateAIReviewLog(logId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      duration,
      metadata: {
        maxBuy,
        maxSell,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    logger.error('❌ Recommendation job failed', { error });
    throw error;
  }
}
