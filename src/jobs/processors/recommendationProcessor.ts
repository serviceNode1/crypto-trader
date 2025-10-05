import { Job } from 'bull';
import { getCurrentPrice } from '../../services/dataCollection/coinGeckoService';
import { getCandlesticks } from '../../services/dataCollection/binanceService';
import { getCryptoNews } from '../../services/dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../../services/dataCollection/redditService';
import { calculateAllIndicators } from '../../services/analysis/technicalAnalysis';
import { aggregateSentiment } from '../../services/analysis/sentimentAnalysis';
import { getMarketContext } from '../../services/analysis/marketContext';
import { getAIRecommendation } from '../../services/ai/aiService';
import { query } from '../../config/database';
import { SUPPORTED_SYMBOLS } from '../../config/constants';
import { logger } from '../../utils/logger';

interface RecommendationJobData {
  symbol?: string;
}

/**
 * Generate AI recommendation for a symbol
 */
async function generateRecommendation(symbol: string): Promise<void> {
  logger.info(`Generating recommendation for ${symbol}...`);
  
  try {
    // Fetch all required data
    const [currentPrice, candlesticks, news, redditPosts, marketContext] =
      await Promise.all([
        getCurrentPrice(symbol),
        getCandlesticks(symbol, '1h', 100),
        getCryptoNews(symbol, 20),
        getCryptoMentions(symbol, 50),
        getMarketContext(),
      ]);

    // Calculate technical indicators
    const technicalIndicators = calculateAllIndicators(candlesticks);
    
    // Calculate sentiment
    const sentiment = await aggregateSentiment(redditPosts, news);

    // Get AI recommendation
    const recommendation = await getAIRecommendation({
      symbol,
      currentPrice,
      technicalIndicators,
      sentiment,
      news,
      marketContext,
    });

    logger.info(`${symbol} recommendation: ${recommendation.action} (${recommendation.confidence}% confidence)`);

    // Store recommendation in database
    await query(
      `INSERT INTO recommendations (
        symbol, action, confidence, entry_price, stop_loss,
        take_profit_1, take_profit_2, position_size, risk_level,
        reasoning, sources, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '24 hours')`,
      [
        symbol,
        recommendation.action,
        recommendation.confidence,
        recommendation.entryPrice,
        recommendation.stopLoss,
        recommendation.takeProfitLevels[0] || null,
        recommendation.takeProfitLevels[1] || null,
        recommendation.positionSize,
        recommendation.riskLevel,
        JSON.stringify(recommendation.reasoning),
        recommendation.sources,
      ]
    );

    logger.info(`${symbol} recommendation stored in database`);
  } catch (error) {
    logger.error(`Failed to generate recommendation for ${symbol}`, { error });
    throw error;
  }
}

/**
 * Process recommendation generation jobs
 */
export async function processRecommendation(job: Job<RecommendationJobData>): Promise<void> {
  const { symbol } = job.data;
  
  logger.info('Processing recommendation job', { symbol });
  
  try {
    if (symbol) {
      // Generate recommendation for specific symbol
      await generateRecommendation(symbol);
    } else {
      // Generate recommendations for all supported symbols
      for (const sym of SUPPORTED_SYMBOLS) {
        await generateRecommendation(sym);
        
        // Add delay to respect rate limits and AI API quotas
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    
    logger.info('Recommendation job completed', { symbol });
  } catch (error) {
    logger.error('Recommendation job failed', { error, symbol });
    throw error;
  }
}
