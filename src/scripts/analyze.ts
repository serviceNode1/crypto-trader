import dotenv from 'dotenv';
import { initRedis } from '../config/redis';
import { testConnection } from '../config/database';
import { getCurrentPrice } from '../services/dataCollection/coinGeckoService';
import { getCandlesticks } from '../services/dataCollection/binanceService';
import { getCryptoNews } from '../services/dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../services/dataCollection/redditService';
import { calculateAllIndicators, analyzeTrend } from '../services/analysis/technicalAnalysis';
import { aggregateSentiment } from '../services/analysis/sentimentAnalysis';
import { getMarketContext, analyzeRegime } from '../services/analysis/marketContext';
import { getAIRecommendation } from '../services/ai/aiService';
import { query } from '../config/database';
import { SUPPORTED_SYMBOLS } from '../config/constants';
import { logger } from '../utils/logger';

dotenv.config();

/**
 * Analyze a specific cryptocurrency and generate recommendation
 */
async function analyzeCrypto(symbol: string): Promise<void> {
  try {
    logger.info(`Analyzing ${symbol}...`);

    // Fetch all required data
    const [currentPrice, candlesticks, news, redditPosts, marketContext] =
      await Promise.all([
        getCurrentPrice(symbol),
        getCandlesticks(symbol, '1h', 100),
        getCryptoNews(symbol, 20),
        getCryptoMentions(symbol, 50),
        getMarketContext(),
      ]);

    logger.info(`Current price: $${currentPrice.toFixed(2)}`);

    // Calculate technical indicators
    const technicalIndicators = calculateAllIndicators(candlesticks);
    const trend = analyzeTrend(technicalIndicators, currentPrice);

    logger.info(`Trend: ${trend.trend} (strength: ${trend.strength.toFixed(1)})`);

    // Calculate sentiment
    const sentiment = await aggregateSentiment(redditPosts, news);

    logger.info(
      `Sentiment: ${sentiment.overall.classification} (score: ${sentiment.overall.score.toFixed(3)})`
    );
    logger.info(`Mentions: ${sentiment.mentionVolume} (Reddit: ${sentiment.sources.reddit}, News: ${sentiment.sources.news})`);

    // Analyze market regime
    const regime = analyzeRegime(marketContext);

    logger.info(`Market regime: ${regime.current} (confidence: ${(regime.confidence * 100).toFixed(0)}%)`);

    // Get AI recommendation
    logger.info('Generating AI recommendation...');

    const recommendation = await getAIRecommendation({
      symbol,
      currentPrice,
      technicalIndicators,
      sentiment,
      news,
      marketContext,
    });

    logger.info('=== AI RECOMMENDATION ===');
    logger.info(`Action: ${recommendation.action}`);
    logger.info(`Confidence: ${recommendation.confidence}%`);
    logger.info(`Risk Level: ${recommendation.riskLevel}`);
    
    if (recommendation.entryPrice) {
      logger.info(`Entry Price: $${recommendation.entryPrice.toFixed(2)}`);
    }
    if (recommendation.stopLoss) {
      logger.info(`Stop Loss: $${recommendation.stopLoss.toFixed(2)}`);
    }
    if (recommendation.takeProfitLevels.length > 0) {
      logger.info(
        `Take Profit: $${recommendation.takeProfitLevels.map(tp => tp.toFixed(2)).join(', $')}`
      );
    }
    if (recommendation.positionSize) {
      logger.info(`Position Size: ${(recommendation.positionSize * 100).toFixed(1)}%`);
    }

    logger.info('\n=== REASONING ===');
    logger.info(`Bull Case: ${recommendation.reasoning.bullCase}`);
    logger.info(`Bear Case: ${recommendation.reasoning.bearCase}`);
    logger.info(`Conclusion: ${recommendation.reasoning.conclusion}`);

    logger.info('\n=== KEY FACTORS ===');
    recommendation.keyFactors.forEach((factor, i) => {
      logger.info(`${i + 1}. ${factor}`);
    });

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

    logger.info('\n✓ Recommendation stored in database');
  } catch (error) {
    logger.error(`Failed to analyze ${symbol}`, { error });
    throw error;
  }
}

/**
 * Analyze all supported cryptocurrencies
 */
async function analyzeAll(): Promise<void> {
  logger.info('Starting analysis for all supported cryptocurrencies...');

  for (const symbol of SUPPORTED_SYMBOLS) {
    try {
      await analyzeCrypto(symbol);
      logger.info(`\n${'='.repeat(60)}\n`);

      // Add delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      logger.error(`Skipping ${symbol} due to error`, { error });
    }
  }

  logger.info('Analysis complete for all symbols');
}

/**
 * Main execution
 */
async function main() {
  try {
    logger.info('Crypto AI Trading - Analysis Script');
    logger.info('====================================\n');

    // Initialize connections
    logger.info('Initializing connections...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    await initRedis();
    logger.info('✓ Connections initialized\n');

    // Get symbol from command line args
    const symbol = process.argv[2]?.toUpperCase();

    if (symbol && symbol !== 'ALL') {
      // Analyze specific symbol
      await analyzeCrypto(symbol);
    } else if (symbol === 'ALL') {
      // Analyze all supported symbols
      await analyzeAll();
    } else {
      // Show usage
      console.log('Usage:');
      console.log('  npm run analyze BTC         # Analyze Bitcoin');
      console.log('  npm run analyze ETH         # Analyze Ethereum');
      console.log('  npm run analyze ALL         # Analyze all supported coins');
      console.log('\nSupported symbols:', SUPPORTED_SYMBOLS.join(', '));
      process.exit(0);
    }

    logger.info('\n✓ Analysis completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Analysis script failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { analyzeCrypto, analyzeAll };
