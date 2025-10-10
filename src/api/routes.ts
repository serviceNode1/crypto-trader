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
import { getCandlesticks } from '../services/dataCollection/coinbaseService';
import { getCurrentPrice } from '../services/dataCollection/coinGeckoService';
import { calculateAllIndicators, analyzeTrend } from '../services/analysis/technicalAnalysis';
import { aggregateSentiment } from '../services/analysis/sentimentAnalysis';
import { getMarketContext, analyzeRegime } from '../services/analysis/marketContext';
import { getAIRecommendation, getLocalRecommendation } from '../services/ai/aiService';
import { getUserSettings, updateUserSettings, resetUserSettings } from '../services/settings/settingsService';
import { discoverCoins, getTopDiscoveries } from '../services/discovery/coinDiscovery';
import { getAutoExecutionStats } from '../services/trading/autoExecutor';
import { getMonitoringStats } from '../services/trading/positionMonitor';
import { query } from '../config/database';
import { testConnection } from '../config/database';
import { testRedisConnection } from '../config/redis';
import { apiLogger as logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/health - Health check endpoint
 */
router.get('/health', async (_req: Request, res: Response) => {
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
router.get('/portfolio', async (_req: Request, res: Response) => {
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
router.get('/portfolio/performance', async (_req: Request, res: Response) => {
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
router.get('/portfolio/risk', async (_req: Request, res: Response) => {
  try {
    const risk = await getRiskExposure();
    res.json(risk);
  } catch (error) {
    logger.error('Failed to get risk exposure', { error });
    res.status(500).json({ error: 'Failed to retrieve risk exposure' });
  }
});

/**
 * GET /api/price/:symbol - Get current price for a symbol
 */
router.get('/price/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    logger.info('Fetching current price', { symbol });
    
    const price = await getCurrentPrice(symbol);
    res.json({ symbol, price });
  } catch (error) {
    logger.error('Failed to get current price', { symbol: req.params.symbol, error });
    res.status(500).json({ error: `Failed to fetch price for ${req.params.symbol}` });
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
 * POST /api/trade - Execute a trade (alias for /api/trades)
 * This endpoint is used for MANUAL trades and has relaxed risk limits
 */
router.post('/trade', async (req: Request, res: Response) => {
  try {
    const { symbol, side, quantity, stopLoss, takeProfit, reasoning, recommendationId } = req.body;

    // Validate input
    if (!symbol || !side || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, side, quantity',
      });
    }

    // Get current price
    const price = await getCurrentPrice(symbol);

    // Validate trade against risk limits (with relaxed rules for manual trades)
    const riskCheck = await validateTrade(symbol, side, quantity, price, stopLoss, true);

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

    logger.info('Manual trade executed via API', { symbol, side, quantity, stopLoss, takeProfit });
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

    const recommendations = result.rows.map((row: any) => ({
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
    const sentiment = await aggregateSentiment(redditPosts, news);

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
 * GET /api/analyze/:symbol - Get comprehensive analysis WITH AI recommendation
 * Query params: ?model=local|anthropic|openai|both (default: anthropic)
 */
router.get('/analyze/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const modelChoice = (req.query.model as string || 'anthropic') as 'local' | 'anthropic' | 'openai' | 'both';

    logger.info('Generating complete analysis with AI recommendation', { symbol, modelChoice });

    // Fetch data with graceful fallbacks and explicit logging
    logger.info('Starting data collection', { symbol });
    
    const [currentPrice, news, redditPosts, marketContext] = await Promise.all([
      getCurrentPrice(symbol).then(price => {
        logger.info('Price fetched', { symbol, price });
        return price;
      }),
      getCryptoNews(symbol, 20).then(newsData => {
        logger.info('News fetched', { symbol, count: newsData.length });
        return newsData;
      }).catch(error => {
        logger.error('News fetching failed, using empty array', { symbol, error: error.message });
        return []; // Graceful fallback
      }),
      getCryptoMentions(symbol, 50).then(posts => {
        logger.info('Reddit posts fetched', { symbol, count: posts.length });
        return posts;
      }).catch(error => {
        logger.error('Reddit fetching failed, using empty array', { symbol, error: error.message });
        return []; // Graceful fallback
      }),
      getMarketContext().then(context => {
        logger.info('Market context fetched', { symbol });
        return context;
      }),
    ]);
    
    logger.info('Data collection complete', { symbol, newsCount: news.length, redditCount: redditPosts.length });

    // Try Binance first, fallback to CoinGecko if blocked
    let candlesticks;
    try {
      logger.debug('Attempting to fetch candlesticks from Binance', { symbol });
      candlesticks = await getCandlesticks(symbol, '1h', 100);
      logger.info('Successfully fetched candlesticks from Binance', { symbol });
    } catch (binanceError: any) {
      logger.warn('Binance unavailable, using CoinGecko fallback', {
        symbol,
        error: binanceError.message,
        status: binanceError.status,
      });
      
      // Fallback to CoinGecko OHLC
      const { getCandlesticksFromCoinGecko } = await import('../services/dataCollection/coinGeckoService');
      candlesticks = await getCandlesticksFromCoinGecko(symbol, 7);
      logger.info('Successfully fetched candlesticks from CoinGecko', { symbol });
    }

    // Calculate technical indicators
    let technicalIndicators, trend, sentiment, regime;
    
    try {
      logger.info('Calculating technical indicators', { symbol, candles: candlesticks.length });
      technicalIndicators = calculateAllIndicators(candlesticks);
      logger.info('Technical indicators calculated', { symbol });
    } catch (error) {
      logger.error('Technical indicators calculation failed', { symbol, error });
      throw new Error(`Technical analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      logger.info('Analyzing trend', { symbol });
      trend = analyzeTrend(technicalIndicators, currentPrice);
      logger.info('Trend analyzed', { symbol, trend: trend.trend });
    } catch (error) {
      logger.error('Trend analysis failed', { symbol, error });
      throw new Error(`Trend analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Calculate sentiment
    try {
      logger.info('Aggregating sentiment', { symbol, redditPosts: redditPosts.length, newsArticles: news.length });
      sentiment = await aggregateSentiment(redditPosts, news);
      logger.info('Sentiment aggregated', { symbol });
    } catch (error) {
      logger.error('Sentiment aggregation failed', { symbol, error });
      throw new Error(`Sentiment analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Analyze market regime
    try {
      logger.info('Analyzing market regime', { symbol });
      regime = analyzeRegime(marketContext);
      logger.info('Market regime analyzed', { symbol });
    } catch (error) {
      logger.error('Market regime analysis failed', { symbol, error });
      throw new Error(`Market regime analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Get AI recommendation (or local if specified)
    let recommendation;
    try {
      recommendation = await getAIRecommendation(
        {
          symbol,
          currentPrice,
          technicalIndicators,
          sentiment,
          news,
          marketContext,
        },
        modelChoice
      );
    } catch (aiError) {
      logger.warn('AI recommendation failed, using local fallback', { 
        symbol, 
        modelChoice,
        error: aiError instanceof Error ? aiError.message : 'Unknown error'
      });
      recommendation = getLocalRecommendation({
        symbol,
        currentPrice,
        technicalIndicators,
        sentiment,
        news,
        marketContext,
      });
    }

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
      recommendation,
      news: news.slice(0, 5),
      candlesticks: candlesticks.slice(-30), // Last 30 candles for chart
      timestamp: new Date().toISOString(),
    };

    res.json(analysis);
  } catch (error) {
    logger.error('Failed to generate complete analysis', { error });
    res.status(500).json({ 
      error: 'Failed to generate analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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
    const sentiment = await aggregateSentiment(redditPosts, news);

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

    const sentiment = await aggregateSentiment(redditPosts, news);

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
router.get('/market-context', async (_req: Request, res: Response) => {
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

/**
 * GET /api/settings - Get user settings
 */
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getUserSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Failed to get settings', { error });
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/settings - Update user settings
 */
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    logger.info('Updating settings', { settings });
    
    const updatedSettings = await updateUserSettings(settings);
    
    logger.info('Settings updated successfully');
    res.json(updatedSettings);
  } catch (error) {
    logger.error('Failed to update settings', { error });
    res.status(400).json({ 
      error: 'Failed to update settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/settings/reset - Reset settings to defaults
 */
router.post('/settings/reset', async (_req: Request, res: Response) => {
  try {
    const settings = await resetUserSettings();
    logger.info('Settings reset to defaults');
    res.json(settings);
  } catch (error) {
    logger.error('Failed to reset settings', { error });
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});

/**
 * GET /api/discover - Discover trading opportunities
 * Query params: ?universe=top10|top25|top50|top100&strategy=conservative|moderate|aggressive&forceRefresh=true
 */
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const universe = (req.query.universe as 'top10' | 'top25' | 'top50' | 'top100') || 'top25';
    const strategy = (req.query.strategy as 'conservative' | 'moderate' | 'aggressive') || 'moderate';
    const forceRefresh = req.query.forceRefresh === 'true';
    
    logger.info('Starting coin discovery', { universe, strategy, forceRefresh });
    
    const startTime = Date.now();
    const result = await discoverCoins(universe, strategy, forceRefresh);
    const executionTime = Date.now() - startTime;
    
    res.json({
      universe,
      count: result.candidates.length,
      candidates: result.candidates.slice(0, 20), // Return top 20 candidates
      analysisLog: result.analysisLog, // Full analysis log
      summary: result.summary, // Summary statistics
      timestamp: new Date().toISOString(), // When this discovery was run
      executionTime, // How long it took in ms
      forceRefresh, // Whether cache was bypassed
    });
  } catch (error) {
    logger.error('Failed to discover coins', { error });
    res.status(500).json({ error: 'Failed to discover coins' });
  }
});

/**
 * GET /api/discover/top - Get top discovered coins from database
 */
router.get('/discover/top', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const discoveries = await getTopDiscoveries(limit);
    
    res.json({
      count: discoveries.length,
      discoveries,
    });
  } catch (error) {
    logger.error('Failed to get top discoveries', { error });
    res.status(500).json({ error: 'Failed to get top discoveries' });
  }
});

/**
 * GET /api/auto-trading/stats - Get auto-trading statistics
 */
router.get('/auto-trading/stats', async (_req: Request, res: Response) => {
  try {
    const [execStats, monitorStats] = await Promise.all([
      getAutoExecutionStats(),
      getMonitoringStats(),
    ]);
    
    res.json({
      execution: execStats,
      monitoring: monitorStats,
    });
  } catch (error) {
    logger.error('Failed to get auto-trading stats', { error });
    res.status(500).json({ error: 'Failed to get auto-trading stats' });
  }
});

/**
 * GET /api/approvals - Get pending trade approvals
 */
router.get('/approvals', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT 
        ta.*,
        r.confidence,
        r.risk_level,
        EXTRACT(EPOCH FROM (ta.expires_at - NOW())) as seconds_remaining
       FROM trade_approvals ta
       LEFT JOIN recommendations r ON ta.recommendation_id = r.id
       WHERE ta.status = 'pending'
         AND ta.expires_at > NOW()
       ORDER BY ta.created_at DESC`
    );
    
    res.json({
      count: result.rows.length,
      approvals: result.rows,
    });
  } catch (error) {
    logger.error('Failed to get pending approvals', { error });
    res.status(500).json({ error: 'Failed to get pending approvals' });
  }
});

/**
 * POST /api/approvals/:id/approve - Approve a trade
 */
router.post('/approvals/:id/approve', async (req: Request, res: Response) => {
  try {
    const approvalId = parseInt(req.params.id);
    
    await query(
      `UPDATE trade_approvals
       SET status = 'approved', approved_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [approvalId]
    );
    
    logger.info('Trade approved', { approvalId });
    res.json({ success: true, message: 'Trade approved and will be executed shortly' });
  } catch (error) {
    logger.error('Failed to approve trade', { error });
    res.status(500).json({ error: 'Failed to approve trade' });
  }
});

/**
 * POST /api/approvals/:id/reject - Reject a trade
 */
router.post('/approvals/:id/reject', async (req: Request, res: Response) => {
  try {
    const approvalId = parseInt(req.params.id);
    const reason = req.body.reason || 'Rejected by user';
    
    await query(
      `UPDATE trade_approvals
       SET status = 'rejected', rejected_at = NOW(), rejection_reason = $2
       WHERE id = $1 AND status = 'pending'`,
      [approvalId, reason]
    );
    
    logger.info('Trade rejected', { approvalId, reason });
    res.json({ success: true, message: 'Trade rejected' });
  } catch (error) {
    logger.error('Failed to reject trade', { error });
    res.status(500).json({ error: 'Failed to reject trade' });
  }
});

export default router;
