import { Router, Request, Response } from 'express';
import {
  getPortfolio,
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
import { findOpportunities, generateActionableRecommendations } from '../services/discovery/opportunityFinder';
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
 * GET /api/portfolio/history - Get portfolio value history
 */
router.get('/portfolio/history', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        DATE(executed_at) as date,
        MAX(executed_at) as timestamp,
        (SELECT SUM(
          CASE 
            WHEN t2.side = 'BUY' THEN -t2.total_cost
            WHEN t2.side = 'SELL' THEN t2.total_cost - t2.fee
          END
        ) FROM trades t2 WHERE t2.executed_at <= MAX(t1.executed_at)
        ) as cash_flow
      FROM trades t1
      GROUP BY DATE(executed_at)
      ORDER BY date ASC
    `);

    // Calculate portfolio value at each point
    const portfolio = await getPortfolio();
    const startingCapital = 10000;
    let runningCash = startingCapital;

    const history = result.rows.map((row: any) => {
      runningCash = startingCapital + parseFloat(row.cash_flow || 0);
      return {
        timestamp: row.timestamp,
        totalValue: runningCash
      };
    });

    // If no trades yet, return starting point
    if (history.length === 0) {
      history.push({
        timestamp: new Date().toISOString(),
        totalValue: portfolio.totalValue
      });
    } else {
      // Add current value as latest point
      history.push({
        timestamp: new Date().toISOString(),
        totalValue: portfolio.totalValue
      });
    }

    res.json(history);
  } catch (error) {
    logger.error('Failed to get portfolio history', { error });
    res.status(500).json({ error: 'Failed to retrieve portfolio history' });
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
 * GET /api/trades - Get trade history with pagination
 * Returns trades + total count in one response for efficiency
 */
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Execute both queries in parallel
    const [tradesResult, countResult] = await Promise.all([
      query(`
        SELECT * FROM trades 
        ORDER BY executed_at DESC 
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      query('SELECT COUNT(*) as count FROM trades')
    ]);
    
    res.json({
      trades: tradesResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: Math.floor(offset / limit) + 1,
      perPage: limit
    });
  } catch (error) {
    logger.error('Failed to get trade history', { error });
    res.status(500).json({ error: 'Failed to retrieve trade history' });
  }
});

/**
 * GET /api/trades/count - Get total number of trades (legacy endpoint)
 */
router.get('/trades/count', async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT COUNT(*) as count FROM trades');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    logger.error('Failed to get trade count', { error });
    res.status(500).json({ error: 'Failed to retrieve trade count' });
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
    const { symbol, side, quantity, stopLoss, takeProfit, reasoning, recommendationId, confirmWarnings } = req.body;

    // Validate input
    if (!symbol || !side || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Please provide symbol, side, and quantity for the trade.',
      });
    }

    // Get current price
    const price = await getCurrentPrice(symbol);

    // Validate trade against risk limits (with relaxed rules for manual trades)
    const riskCheck = await validateTrade(symbol, side, quantity, price, stopLoss, true);

    if (!riskCheck.allowed) {
      return res.status(403).json({
        error: 'Trade not allowed',
        message: riskCheck.reason,
      });
    }

    // If there are warnings and user hasn't confirmed, return them for confirmation
    if (riskCheck.warnings && riskCheck.warnings.length > 0 && !confirmWarnings) {
      return res.status(200).json({
        requiresConfirmation: true,
        warnings: riskCheck.warnings,
        message: 'This trade has risk warnings. Please review and confirm.',
      });
    }

    // Execute trade with stop loss and take profit
    const trade = await executeTrade(
      symbol,
      side,
      quantity,
      reasoning,
      recommendationId,
      stopLoss,
      takeProfit
    );

    logger.info('Manual trade executed via API', { symbol, side, quantity, stopLoss, takeProfit, hadWarnings: !!riskCheck.warnings });
    res.status(201).json(trade);
  } catch (error: any) {
    logger.error('Failed to execute trade', { error });
    res.status(500).json({ 
      error: 'Trade execution failed',
      message: error.message || 'An unexpected error occurred while executing the trade.',
    });
  }
});

/**
 * GET /api/recommendations - Get current trade recommendations (BUY/SELL only, no HOLD)
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await query(
      `SELECT id, symbol, action, confidence, entry_price, stop_loss,
              take_profit_1, take_profit_2, position_size, risk_level,
              reasoning, sources, created_at, expires_at
       FROM recommendations
       WHERE (expires_at > NOW() OR expires_at IS NULL)
         AND action IN ('BUY', 'SELL')
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
 * GET /api/opportunities - Find buy and sell opportunities
 */
router.get('/opportunities', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.forceRefresh === 'true';
    
    logger.info('Finding opportunities', { forceRefresh });
    const result = await findOpportunities(forceRefresh);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to find opportunities', { error });
    res.status(500).json({ error: 'Failed to find opportunities' });
  }
});

/**
 * POST /api/recommendations/generate - Generate AI recommendations for top opportunities
 */
router.post('/recommendations/generate', async (req: Request, res: Response) => {
  try {
    const maxBuy = parseInt(req.body.maxBuy as string) || 3;
    const maxSell = parseInt(req.body.maxSell as string) || 3;
    
    logger.info('Generating actionable AI recommendations', { maxBuy, maxSell });
    
    const result = await generateActionableRecommendations(maxBuy, maxSell);
    
    res.json({
      success: true,
      message: `Generated ${result.buyRecommendations.length} BUY and ${result.sellRecommendations.length} SELL recommendations`,
      ...result,
    });
  } catch (error) {
    logger.error('Failed to generate actionable recommendations', { error });
    res.status(500).json({ error: 'Failed to generate recommendations' });
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
      const { getOHLCData } = await import('../services/dataCollection/coinGeckoService');
      const ohlcData = await getOHLCData(symbol, 7);
      
      // Convert OHLCData to Candlestick format
      candlesticks = ohlcData.map((ohlc) => ({
        openTime: ohlc.timestamp,
        open: ohlc.open,
        high: ohlc.high,
        low: ohlc.low,
        close: ohlc.close,
        volume: 0, // CoinGecko OHLC doesn't provide volume in this endpoint
        closeTime: ohlc.timestamp + 3600000, // Assume 1 hour candles
        quoteAssetVolume: 0,
        trades: 0,
      }));
      
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
        sentiment: { 
          overall: { score: 0, magnitude: 0, classification: 'neutral' },
          reddit: { score: 0, magnitude: 0, classification: 'neutral' },
          news: { score: 0, magnitude: 0, classification: 'neutral' },
          mentionVolume: 0,
          velocity: 0,
          credibilityWeighted: 0,
          sources: { reddit: 0, news: 0 }
        },
        news: [],
        marketContext: {
          btcDominance: 0,
          totalMarketCap: 0,
          marketRegime: 'sideways',
          riskSentiment: 'neutral',
          volatilityIndex: 0,
          traditionalMarkets: {
            sp500: 0,
            sp500Change: 0,
            gold: 0,
            vix: 20
          }
        },
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

/**
 * PUT /api/holdings/:symbol/protection - Update stop loss and take profit for a position
 */
router.put('/holdings/:symbol/protection', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { stopLoss, takeProfit } = req.body;

    // Validate inputs
    if (stopLoss !== undefined && stopLoss !== null && (typeof stopLoss !== 'number' || stopLoss <= 0)) {
      return res.status(400).json({
        error: 'Invalid stop loss',
        message: 'Stop loss must be a positive number or null to remove'
      });
    }

    if (takeProfit !== undefined && takeProfit !== null && (typeof takeProfit !== 'number' || takeProfit <= 0)) {
      return res.status(400).json({
        error: 'Invalid take profit',
        message: 'Take profit must be a positive number or null to remove'
      });
    }

    // Check if holding exists and get current protection levels
    const holdingCheck = await query('SELECT * FROM holdings WHERE symbol = $1', [symbol]);
    if (holdingCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Position not found',
        message: `No open position for ${symbol}`
      });
    }

    const currentPrice = await getCurrentPrice(symbol);
    const holding = holdingCheck.rows[0];

    // Preserve existing values if not being updated (convert to number or null)
    const finalStopLoss = stopLoss !== undefined 
      ? stopLoss 
      : (holding.stop_loss ? parseFloat(holding.stop_loss) : null);
    
    const finalTakeProfit = takeProfit !== undefined 
      ? takeProfit 
      : (holding.take_profit ? parseFloat(holding.take_profit) : null);

    // Validate stop loss is below current price
    if (finalStopLoss !== null && finalStopLoss >= currentPrice) {
      return res.status(400).json({
        error: 'Invalid stop loss',
        message: `Stop loss ($${finalStopLoss.toFixed(2)}) must be below current price ($${currentPrice.toFixed(2)})`
      });
    }

    // Validate take profit is above current price
    if (finalTakeProfit !== null && finalTakeProfit <= currentPrice) {
      return res.status(400).json({
        error: 'Invalid take profit',
        message: `Take profit ($${finalTakeProfit.toFixed(2)}) must be above current price ($${currentPrice.toFixed(2)})`
      });
    }

    // Update protection levels (preserving existing values)
    await query(`
      UPDATE holdings 
      SET 
        stop_loss = $1,
        take_profit = $2,
        protection_updated_at = NOW()
      WHERE symbol = $3
      RETURNING *
    `, [finalStopLoss, finalTakeProfit, symbol]);

    logger.info('Position protection updated', {
      symbol,
      stopLoss,
      takeProfit,
      currentPrice
    });

    res.json({
      success: true,
      symbol,
      stopLoss,
      takeProfit,
      currentPrice,
      stopLossPercent: stopLoss ? (((currentPrice - stopLoss) / currentPrice) * 100).toFixed(2) : null,
      takeProfitPercent: takeProfit ? (((takeProfit - currentPrice) / currentPrice) * 100).toFixed(2) : null
    });
  } catch (error: any) {
    logger.error('Failed to update position protection', { error });
    res.status(500).json({
      error: 'Update failed',
      message: error.message || 'Failed to update position protection'
    });
  }
});

export default router;
