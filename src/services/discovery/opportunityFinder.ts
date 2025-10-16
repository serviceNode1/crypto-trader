import { discoverCoins, CoinCandidate, getTopDiscoveries, DiscoveryStrategy } from './coinDiscovery';
import { getPortfolio } from '../trading/paperTrading';
import { getUserSettings } from '../settings/settingsService';
import { getAIRecommendation } from '../ai/aiService';
import { logger } from '../../utils/logger';
import { getCurrentPrice } from '../dataCollection/coinGeckoService';
import { getCandlesticks } from '../dataCollection/coinbaseService';
import { getCryptoNews } from '../dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../dataCollection/redditService';
import { calculateAllIndicators } from '../analysis/technicalAnalysis';
import { aggregateSentiment } from '../analysis/sentimentAnalysis';
import { getMarketContext } from '../analysis/marketContext';

export interface BuyOpportunity {
  symbol: string;
  name: string;
  reason: 'discovery' | 'breakout' | 'dip';
  urgency: 'high' | 'medium' | 'low';
  localScore: number; // Pre-AI composite score
  candidate: CoinCandidate;
}

export interface SellOpportunity {
  symbol: string;
  name: string;
  reason: 'profit_target' | 'resistance' | 'momentum_loss' | 'risk_management';
  urgency: 'high' | 'medium' | 'low';
  currentPrice: number;
  entryPrice: number;
  unrealizedPnL: number;
  percentGain: number;
}

export interface OpportunityResult {
  buyOpportunities: BuyOpportunity[];
  sellOpportunities: SellOpportunity[];
  timestamp: Date;
}

/**
 * Find actionable buy and sell opportunities
 * This runs the complete discovery → filter → opportunity pipeline
 */
export async function findOpportunities(
  forceRefresh: boolean = false
): Promise<OpportunityResult> {
  try {
    logger.info('🔍 Finding trading opportunities...');

    // Get user settings to determine discovery parameters
    const settings = await getUserSettings();
    
    // Determine discovery strategy (default to moderate if not set)
    const discoveryStrategy: DiscoveryStrategy = 'moderate'; // Could be made configurable in settings
    
    // Run discovery if forced or if cache is old
    let discoveries: CoinCandidate[] = [];
    if (forceRefresh) {
      logger.info('Running fresh discovery scan...');
      const discoveryResult = await discoverCoins(
        settings.coinUniverse,
        discoveryStrategy,
        true
      );
      discoveries = discoveryResult.candidates;
    } else {
      // Use cached discoveries from database
      discoveries = await getTopDiscoveries(20);
    }

    logger.info(`Found ${discoveries.length} discovered coins`);

    // Find buy opportunities (coins NOT in portfolio)
    const buyOpportunities = await findBuyOpportunities(discoveries);
    
    // Find sell opportunities (coins IN portfolio)
    const sellOpportunities = await findSellOpportunities();

    logger.info(`📊 Opportunities found: ${buyOpportunities.length} BUY, ${sellOpportunities.length} SELL`);

    return {
      buyOpportunities,
      sellOpportunities,
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to find opportunities', { error });
    throw error;
  }
}

/**
 * Find buy opportunities from discovered coins
 * Filters for coins NOT already in portfolio
 */
async function findBuyOpportunities(
  discoveries: CoinCandidate[]
): Promise<BuyOpportunity[]> {
  try {
    const portfolio = await getPortfolio();
    const existingSymbols = new Set(portfolio.positions.map(p => p.symbol));

    const opportunities: BuyOpportunity[] = [];

    for (const candidate of discoveries) {
      // Skip if already in portfolio
      if (existingSymbols.has(candidate.symbol)) {
        continue;
      }

      // Determine urgency and reason based on scores
      let reason: 'discovery' | 'breakout' | 'dip' = 'discovery';
      let urgency: 'high' | 'medium' | 'low' = 'medium';

      // High momentum + high volume = breakout
      if (candidate.momentumScore > 70 && candidate.volumeScore > 70) {
        reason = 'breakout';
        urgency = 'high';
      }
      // Recent dip with good fundamentals
      else if (candidate.momentumScore < 40 && candidate.compositeScore > 65) {
        reason = 'dip';
        urgency = 'medium';
      }
      // Strong overall score
      else if (candidate.compositeScore > 75) {
        urgency = 'high';
      }

      opportunities.push({
        symbol: candidate.symbol,
        name: candidate.name,
        reason,
        urgency,
        localScore: candidate.compositeScore,
        candidate,
      });
    }

    // Sort by local score (descending)
    opportunities.sort((a, b) => b.localScore - a.localScore);

    logger.info(`Found ${opportunities.length} buy opportunities (not in portfolio)`);
    
    return opportunities;
  } catch (error) {
    logger.error('Failed to find buy opportunities', { error });
    return [];
  }
}

/**
 * Find sell opportunities from current portfolio
 * Analyzes existing positions for exit signals
 */
async function findSellOpportunities(): Promise<SellOpportunity[]> {
  try {
    const portfolio = await getPortfolio();
    const opportunities: SellOpportunity[] = [];

    for (const position of portfolio.positions) {
      // Get current price
      const currentPrice = await getCurrentPrice(position.symbol);
      const entryPrice = position.averagePrice;
      const percentGain = ((currentPrice - entryPrice) / entryPrice) * 100;
      const unrealizedPnL = position.unrealizedPnL;

      let shouldConsider = false;
      let reason: SellOpportunity['reason'] = 'profit_target';
      let urgency: 'high' | 'medium' | 'low' = 'low';

      // Large profit - consider taking
      if (percentGain > 25) {
        shouldConsider = true;
        reason = 'profit_target';
        urgency = percentGain > 50 ? 'high' : 'medium';
      }
      // Small loss but might get worse
      else if (percentGain < -10 && percentGain > -20) {
        shouldConsider = true;
        reason = 'risk_management';
        urgency = 'medium';
      }
      // Large loss - urgent review
      else if (percentGain < -20) {
        shouldConsider = true;
        reason = 'risk_management';
        urgency = 'high';
      }
      // Moderate profit - check momentum
      else if (percentGain > 10) {
        shouldConsider = true;
        reason = 'resistance';
        urgency = 'low';
      }

      if (shouldConsider) {
        opportunities.push({
          symbol: position.symbol,
          name: position.symbol, // We don't have name in position, using symbol
          reason,
          urgency,
          currentPrice,
          entryPrice,
          unrealizedPnL,
          percentGain,
        });
      }
    }

    // Sort by urgency and then by percent gain
    const urgencyOrder = { high: 3, medium: 2, low: 1 };
    opportunities.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      }
      return Math.abs(b.percentGain) - Math.abs(a.percentGain);
    });

    logger.info(`Found ${opportunities.length} sell opportunities in portfolio`);

    return opportunities;
  } catch (error) {
    logger.error('Failed to find sell opportunities', { error });
    return [];
  }
}

/**
 * Generate AI recommendations for top opportunities
 * Only analyzes the most promising candidates to save API costs
 */
export async function generateActionableRecommendations(
  maxBuyRecommendations: number = 3,
  maxSellRecommendations: number = 3,
  debugMode: boolean = false
): Promise<{
  buyRecommendations: any[];
  sellRecommendations: any[];
  skipped: { buy: number; sell: number };
  metadata: { 
    totalAnalyzed: number; 
    totalOpportunities: number;
    aiRejected: { buy: number; sell: number };
  };
}> {
  try {
    if (debugMode) {
      logger.warn('⚠️ DEBUG MODE - AI will use aggressive/risky prompts');
    }
    logger.info('🤖 Generating AI recommendations for top opportunities...');

    const opportunities = await findOpportunities(false);

    // Take top N buy opportunities
    const topBuyOpportunities = opportunities.buyOpportunities.slice(0, maxBuyRecommendations);
    
    // Take top N sell opportunities
    const topSellOpportunities = opportunities.sellOpportunities.slice(0, maxSellRecommendations);

    const buyRecommendations = [];
    const sellRecommendations = [];
    let aiRejectedBuy = 0;
    let aiRejectedSell = 0;

    // Generate AI recommendations for top buy opportunities
    for (const opp of topBuyOpportunities) {
      try {
        logger.info(`🔍 Analyzing BUY opportunity: ${opp.symbol} (score: ${opp.localScore.toFixed(0)})`);
        
        // Fetch all required data for AI analysis
        const [currentPrice, candlesticks, news, redditPosts, marketContext] = await Promise.all([
          getCurrentPrice(opp.symbol),
          getCandlesticks(opp.symbol, '1h', 100).catch(() => []),
          getCryptoNews(opp.symbol, 20),
          getCryptoMentions(opp.symbol, 50),
          getMarketContext(),
        ]);

        const technicalIndicators = calculateAllIndicators(candlesticks);
        const sentiment = await aggregateSentiment(redditPosts, news);

        const recommendation = await getAIRecommendation({
          symbol: opp.symbol,
          currentPrice,
          technicalIndicators,
          sentiment,
          news,
          marketContext,
        }, 'anthropic', debugMode);
        
        // Only store if AI agrees it's a BUY
        if (recommendation.action === 'BUY') {
          buyRecommendations.push({
            ...recommendation,
            discoveryScore: opp.localScore,
            discoveryReason: opp.reason,
            urgency: opp.urgency,
          });
          
          logger.info(`✅ AI confirmed BUY for ${opp.symbol} (confidence: ${recommendation.confidence}%)`);
        } else {
          aiRejectedBuy++;
          logger.info(`⚠️  AI recommended ${recommendation.action} for ${opp.symbol}, not storing (rejected)`);
        }
      } catch (error) {
        logger.error(`Failed to generate recommendation for ${opp.symbol}`, { error });
      }
    }

    // Generate AI recommendations for top sell opportunities
    for (const opp of topSellOpportunities) {
      try {
        logger.info(`🔍 Analyzing SELL opportunity: ${opp.symbol} (${opp.percentGain > 0 ? '+' : ''}${opp.percentGain.toFixed(1)}%)`);
        
        // Fetch all required data for AI analysis
        const [currentPrice, candlesticks, news, redditPosts, marketContext] = await Promise.all([
          getCurrentPrice(opp.symbol),
          getCandlesticks(opp.symbol, '1h', 100).catch(() => []),
          getCryptoNews(opp.symbol, 20),
          getCryptoMentions(opp.symbol, 50),
          getMarketContext(),
        ]);

        const technicalIndicators = calculateAllIndicators(candlesticks);
        const sentiment = await aggregateSentiment(redditPosts, news);

        const recommendation = await getAIRecommendation({
          symbol: opp.symbol,
          currentPrice,
          technicalIndicators,
          sentiment,
          news,
          marketContext,
        }, 'anthropic', debugMode);
        
        // Only store if AI agrees it's a SELL
        if (recommendation.action === 'SELL') {
          sellRecommendations.push({
            ...recommendation,
            currentGain: opp.percentGain,
            sellReason: opp.reason,
            urgency: opp.urgency,
          });
          
          logger.info(`✅ AI confirmed SELL for ${opp.symbol} (confidence: ${recommendation.confidence}%)`);
        } else {
          aiRejectedSell++;
          logger.info(`⚠️  AI recommended ${recommendation.action} for ${opp.symbol}, not storing (rejected)`);
        }
      } catch (error) {
        logger.error(`Failed to generate recommendation for ${opp.symbol}`, { error });
      }
    }

    const skipped = {
      buy: opportunities.buyOpportunities.length - topBuyOpportunities.length,
      sell: opportunities.sellOpportunities.length - topSellOpportunities.length,
    };
    
    const totalAnalyzed = topBuyOpportunities.length + topSellOpportunities.length;
    const totalOpportunities = opportunities.buyOpportunities.length + opportunities.sellOpportunities.length;

    logger.info(`📊 AI Analysis Complete: ${buyRecommendations.length} BUY, ${sellRecommendations.length} SELL confirmed`);
    logger.info(`⏭️  Analyzed ${totalAnalyzed} coins, AI rejected ${aiRejectedBuy + aiRejectedSell}, skipped ${skipped.buy + skipped.sell} lower-priority`);

    return {
      buyRecommendations,
      sellRecommendations,
      skipped,
      metadata: {
        totalAnalyzed,
        totalOpportunities,
        aiRejected: {
          buy: aiRejectedBuy,
          sell: aiRejectedSell,
        },
      },
    };
  } catch (error) {
    logger.error('Failed to generate actionable recommendations', { error });
    throw error;
  }
}
