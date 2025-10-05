import { Router, Request, Response } from 'express';
import {
  getPortfolio,
  getTradeHistory,
  executeTrade,
  calculatePerformanceMetrics,
} from '../services/trading/paperTrading';
import { validateTrade, getRiskExposure } from '../services/trading/riskManagement';
import { getCryptoNews } from '../services/dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../services/dataCollection/redditService';
import { getCandlesticks } from '../services/dataCollection/binanceService';
import { getCurrentPrice } from '../services/dataCollection/coinGeckoService';
import { calculateAllIndicators, analyzeTrend } from '../services/analysis/technicalAnalysis';
import { aggregateSentiment } from '../services/analysis/sentimentAnalysis';
import { getMarketContext, analyzeRegime } from '../services/analysis/marketContext';
import { getAIRecommendation, getLocalRecommendation } from '../services/ai/aiService';
import { query } from '../config/database';
import { testConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { apiLogger as logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/health - Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await testConnection();
    const redisHealthy = await testRedisConnection();

    const health = {
      status: dbHealthy && redisHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
    };

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ status: 'unhealthy', error: 'Health check failed' });
  }
});

/**
 * GET /api/portfolio - Get current portfolio state
 */
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const portfolio = await getPortfolio();
    res.json(portfolio);
  } catch (error) {
    logger.error('Failed to get portfolio', { error });
    res.status(500).json({ error: 'Failed to retrieve portfolio' });
  }
});

/**
 * GET /api/portfolio/performance - Get performance metrics
 */
router.get('/portfolio/performance', async (req: Request, res: Response) => {
  try {
    const metrics = await calculatePerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get performance metrics', { error });
    res.status(500).json({ error: 'Failed to retrieve performance metrics' });
  }
});

/**
 * GET /api/portfolio/risk - Get risk exposure
 */
router.get('/portfolio/risk', async (req: Request, res: Response) => {
  try {
    const risk = await getRiskExposure();
    res.json(risk);
  } catch (error) {
    logger.error('Failed to get risk exposure', { error });
    res.status(500).json({ error: 'Failed to retrieve risk exposure' });
  }
});

/**
 * GET /api/trades - Get trade history
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await getTradeHistory(limit);
    res.json(trades);
  } catch (error) {
    logger.error('Failed to get trade history', { error });
    res.status(500).json({ error: 'Failed to retrieve trade history' });
  }
});

/**
 * POST /api/trades - Execute a trade
 */
router.post('/trades', async (req: Request, res: Response) => {
  try {
    const { symbol, side, quantity, stopLoss, reasoning, recommendationId } = req.body;

    // Validate input
    if (!symbol || !side || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, side, quantity',
      });
    }

    // Get current price
    const price = await getCurrentPrice(symbol);

    // Validate trade against risk limits
    const riskCheck = await validateTrade(symbol, side, quantity, price, stopLoss);

    if (!riskCheck.allowed) {
      return res.status(403).json({
        error: 'Trade not allowed',
        reason: riskCheck.reason,
      });
    }

    // Execute trade
    const trade = await executeTrade(
      symbol,
      side,
      quantity,
      reasoning,
      recommendationId
    );

    logger.info('Trade executed via API', { symbol, side, quantity });
    res.status(201).json(trade);
  } catch (error: any) {
    logger.error('Failed to execute trade', { error });
    res.status(500).json({ error: error.message || 'Failed to execute trade' });
  }
});

/**
 * GET /api/recommendations - Get current trade recommendations
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await query(
      `SELECT id, symbol, action, confidence, entry_price, stop_loss,
              take_profit_1, take_profit_2, position_size, risk_level,
              reasoning, sources, created_at, expires_at
       FROM recommendations
       WHERE expires_at > NOW() OR expires_at IS NULL
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    const recommendations = result.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      action: row.action,
      confidence: parseFloat(row.confidence),
      entryPrice: row.entry_price ? parseFloat(row.entry_price) : null,
      stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
      takeProfitLevels: [
        row.take_profit_1 ? parseFloat(row.take_profit_1) : null,
        row.take_profit_2 ? parseFloat(row.take_profit_2) : null,
      ].filter((tp) => tp !== null),
      positionSize: row.position_size ? parseFloat(row.position_size) : null,
      riskLevel: row.risk_level,
      reasoning: row.reasoning,
      sources: row.sources,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

    res.json(recommendations);
  } catch (error) {
    logger.error('Failed to get recommendations', { error });
    res.status(500).json({ error: 'Failed to retrieve recommendations' });
  }
});

/**
 * GET /api/analysis/:symbol - Get comprehensive analysis for a symbol
 */
router.get('/analysis/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    logger.info('Generating analysis', { symbol });

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
    const trend = analyzeTrend(technicalIndicators, currentPrice);

    // Calculate sentiment
    const sentiment = aggregateSentiment(redditPosts, news);

    // Analyze market regime
    const regime = analyzeRegime(marketContext);

    const analysis = {
      symbol,
      currentPrice,
      technical: {
        indicators: technicalIndicators,
        trend,
      },
      sentiment,
      marketContext: {
        ...marketContext,
        regime,
      },
      news: news.slice(0, 5),
      timestamp: new Date().toISOString(),
    };

    res.json(analysis);
  } catch (error) {
    logger.error('Failed to generate analysis', { error });
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

/**
 * POST /api/analyze/:symbol - Generate AI recommendation for a symbol
 */
router.post('/analyze/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const useMultipleModels = req.body.useMultipleModels || false;

    logger.info('Generating AI recommendation', { symbol });

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
    const sentiment = aggregateSentiment(redditPosts, news);

    // Get AI recommendation
    const recommendation = await getAIRecommendation(
      {
        symbol,
        currentPrice,
        technicalIndicators,
        sentiment,
        news,
        marketContext,
      },
      useMultipleModels
    );

    // Store recommendation in database
    const result = await query(
      `INSERT INTO recommendations (
        symbol, action, confidence, entry_price, stop_loss,
        take_profit_1, take_profit_2, position_size, risk_level,
        reasoning, sources, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '24 hours')
      RETURNING id`,
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

    recommendation.id = result.rows[0].id;

    res.json(recommendation);
  } catch (error: any) {
    logger.error('Failed to generate recommendation', { error });

    // Fallback to local recommendation if AI fails
    try {
      logger.warn('Using local recommendation as fallback');
      const symbol = req.params.symbol.toUpperCase();
      const currentPrice = await getCurrentPrice(symbol);
      const candlesticks = await getCandlesticks(symbol, '1h', 100);
      const technicalIndicators = calculateAllIndicators(candlesticks);

      const recommendation = getLocalRecommendation({
        symbol,
        currentPrice,
        technicalIndicators,
        sentiment: { overall: { score: 0 } },
        news: [],
        marketContext: {},
      });

      res.json(recommendation);
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to generate recommendation' });
    }
  }
});

/**
 * GET /api/sentiment/:symbol - Get sentiment analysis for a symbol
 */
router.get('/sentiment/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    const [news, redditPosts] = await Promise.all([
      getCryptoNews(symbol, 20),
      getCryptoMentions(symbol, 50),
    ]);

    const sentiment = aggregateSentiment(redditPosts, news);

    res.json({
      symbol,
      sentiment,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get sentiment', { error });
    res.status(500).json({ error: 'Failed to retrieve sentiment data' });
  }
});

/**
 * GET /api/market-context - Get current market context
 */
router.get('/market-context', async (req: Request, res: Response) => {
  try {
    const context = await getMarketContext();
    const regime = analyzeRegime(context);

    res.json({
      context,
      regime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get market context', { error });
    res.status(500).json({ error: 'Failed to retrieve market context' });
  }
});

export default router;
