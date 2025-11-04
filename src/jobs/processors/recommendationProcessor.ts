import { Job } from 'bull';
import { generateActionableRecommendations } from '../../services/discovery/opportunityFinder';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { logAIReview, updateAIReviewLog } from '../../services/logging/aiReviewLogger';
import type { DiscoveryStrategy, CoinUniverse } from '../../types/recommendations';

interface RecommendationJobData {
  symbol?: string;
  maxBuy?: number;
  maxSell?: number;
  strategy?: DiscoveryStrategy;
  coinUniverse?: CoinUniverse;
}

/**
 * Store BUY recommendation in discovery_recommendations table (global, strategy-based)
 */
async function storeDiscoveryRecommendation(
  recommendation: any,
  strategy: DiscoveryStrategy,
  coinUniverse: CoinUniverse
): Promise<void> {
  try {
    await query(
      `INSERT INTO discovery_recommendations (
        symbol, strategy, coin_universe, confidence, entry_price, stop_loss,
        take_profit_1, take_profit_2, position_size, risk_level,
        reasoning, sources, discovery_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        recommendation.symbol,
        strategy,
        coinUniverse,
        recommendation.confidence,
        recommendation.entryPrice,
        recommendation.stopLoss,
        recommendation.takeProfitLevels?.[0] || null,
        recommendation.takeProfitLevels?.[1] || null,
        recommendation.positionSize,
        recommendation.riskLevel,
        JSON.stringify(recommendation.reasoning || recommendation.keyFactors),
        JSON.stringify(recommendation.sources || []),
        recommendation.discoveryScore || null,
      ]
    );
    
    logger.info(`Stored discovery BUY recommendation for ${recommendation.symbol}`, {
      strategy,
      coinUniverse,
      confidence: recommendation.confidence,
    });
  } catch (error) {
    logger.error(`Failed to store discovery recommendation for ${recommendation.symbol}`, { error });
    throw error;
  }
}

/**
 * Store SELL recommendation in portfolio_recommendations table (user-specific)
 * Note: This function is exported for use by portfolio monitoring service
 * Not used in scheduled global jobs
 */
export async function storePortfolioRecommendation(
  recommendation: any,
  userId: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO portfolio_recommendations (
        user_id, symbol, confidence, current_price, entry_price,
        stop_loss, take_profit_1, take_profit_2,
        unrealized_pnl, percent_gain, sell_reason, risk_level, reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        userId,
        recommendation.symbol,
        recommendation.confidence,
        recommendation.currentPrice || recommendation.entryPrice,
        recommendation.entryPrice,
        recommendation.stopLoss,
        recommendation.takeProfitLevels?.[0] || null,
        recommendation.takeProfitLevels?.[1] || null,
        recommendation.unrealizedPnL || 0,
        recommendation.percentGain || 0,
        recommendation.sellReason || 'risk_management',
        recommendation.riskLevel,
        JSON.stringify(recommendation.reasoning || recommendation.keyFactors),
      ]
    );
    
    logger.info(`Stored portfolio SELL recommendation for ${recommendation.symbol}`, {
      userId,
      confidence: recommendation.confidence,
    });
  } catch (error) {
    logger.error(`Failed to store portfolio recommendation for ${recommendation.symbol}`, { error });
    throw error;
  }
}

/**
 * Process recommendation generation jobs
 * Phase 1: Generate global BUY recommendations for all strategies
 * SELL recommendations are handled separately via portfolio monitoring
 */
export async function processRecommendation(job: Job<RecommendationJobData>): Promise<void> {
  const { maxBuy = 3, maxSell = 0 } = job.data; // maxSell = 0 for global jobs
  const startTime = Date.now();
  
  // Define strategies to run
  const strategies: DiscoveryStrategy[] = ['conservative', 'moderate', 'aggressive'];
  const coinUniverses: CoinUniverse[] = ['top50']; // Can be expanded to ['top10', 'top50', 'top100']
  
  logger.info('🚀 Processing global recommendation job for all strategies');
  
  // Create initial log entry
  const logId = await logAIReview({
    reviewType: 'scheduled',
    status: 'started',
    phase: 'discovery',
    timestamp: new Date()
  });
  
  try {
    let totalBuyRecommendations = 0;
    let totalAnalyzed = 0;
    let totalSkipped = 0;
    
    // Run for each strategy
    for (const strategy of strategies) {
      for (const coinUniverse of coinUniverses) {
        logger.info(`🔍 Generating recommendations for ${strategy} strategy, ${coinUniverse} universe`);
        
        await updateAIReviewLog(logId, { 
          phase: 'discovery',
          status: 'started',
          metadata: { strategy, coinUniverse }
        });
        
        // Generate recommendations for this strategy
        // skipPortfolioFilter = true for global BUY recommendations
        const result = await generateActionableRecommendations(
          maxBuy,
          0, // 0 sell for global jobs
          false, // debugMode
          strategy,
          coinUniverse,
          true // skipPortfolioFilter - don't filter by portfolio for global recommendations
        );
        
        await updateAIReviewLog(logId, { phase: 'ai_analysis' });
        
        // Phase 2: Storing BUY recommendations only
        await updateAIReviewLog(logId, { phase: 'storing' });
        
        // Store buy recommendations with strategy tag
        for (const rec of result.buyRecommendations) {
          await storeDiscoveryRecommendation(rec, strategy, coinUniverse);
          totalBuyRecommendations++;
        }
        
        totalAnalyzed += result.metadata.totalAnalyzed;
        totalSkipped += result.skipped.buy;
        
        logger.info(`✅ Stored ${result.buyRecommendations.length} BUY recommendations for ${strategy}/${coinUniverse}`);
      }
    }
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Update log with final results
    await updateAIReviewLog(logId, {
      status: 'completed',
      phase: 'completed',
      coinsAnalyzed: totalAnalyzed,
      buyRecommendations: totalBuyRecommendations,
      sellRecommendations: 0, // SELL handled separately
      skippedOpportunities: totalSkipped,
      duration,
      metadata: {
        strategies,
        coinUniverses,
        maxBuy,
        totalBuyRecommendations,
        totalAnalyzed,
        totalSkipped,
      }
    });
    
    logger.info(`✅ Global recommendation job completed: ${totalBuyRecommendations} BUY across ${strategies.length} strategies (${duration}ms)`);
    logger.info(`⏭️  Analyzed ${totalAnalyzed} coins, skipped ${totalSkipped} lower-priority opportunities`);
    
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
