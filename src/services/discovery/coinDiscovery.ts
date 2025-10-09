import { getCurrentPrice, getTrendingCoins } from '../dataCollection/coinGeckoService';
import { getCryptoNews } from '../dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../dataCollection/redditService';
import { aggregateSentiment } from '../analysis/sentimentAnalysis';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import axios from 'axios';

export interface CoinCandidate {
  symbol: string;
  name: string;
  marketCapRank: number;
  marketCap: number;
  currentPrice: number;
  volume24h: number;
  priceChange24h: number;
  priceChange7d: number;
  volumeScore: number;
  momentumScore: number;
  sentimentScore: number;
  compositeScore: number;
}

export interface CoinAnalysisLog {
  symbol: string;
  name: string;
  rank: number;
  timestamp: Date;
  passed: boolean;
  compositeScore?: number;
  reason: string;
  details: {
    marketCap?: number;
    volume24h?: number;
    volumeScore?: number;
    momentumScore?: number;
    sentimentScore?: number;
    priceChange24h?: number;
    priceChange7d?: number;
  };
}

export interface DiscoveryResult {
  candidates: CoinCandidate[];
  analysisLog: CoinAnalysisLog[];
  summary: {
    totalAnalyzed: number;
    passed: number;
    rejected: number;
    topRejectionReasons: { reason: string; count: number }[];
  };
}

export interface DiscoveryFilters {
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume24h?: number;
  minVolumeChange?: number;
  minPriceChange7d?: number;
  maxPriceChange7d?: number;
}

const DEFAULT_FILTERS: DiscoveryFilters = {
  minMarketCap: 10_000_000,      // $10M minimum (filter out micro-caps with low liquidity)
  maxMarketCap: undefined,       // No maximum (let coin universe setting control this)
  minVolume24h: 1_000_000,        // $1M minimum daily volume
  minVolumeChange: 1.5,            // 50% volume increase minimum
  minPriceChange7d: -20,           // Not dumping too hard
  maxPriceChange7d: 200,           // Not pumped too hard (likely dump)
};

/**
 * Discover trading opportunities based on user's coin universe setting
 */
export async function discoverCoins(
  universe: 'top10' | 'top25' | 'top50' = 'top25',
  customFilters?: DiscoveryFilters,
  forceRefresh: boolean = false
): Promise<DiscoveryResult> {
  try {
    logger.info('Starting coin discovery', { universe, forceRefresh });

    const filters = { ...DEFAULT_FILTERS, ...customFilters };

    // Determine market cap range based on universe
    const limit = universe === 'top10' ? 10 : universe === 'top25' ? 25 : 50;

    // Fetch coin list from CoinGecko
    const coins = await fetchCoinsByMarketCap(limit, forceRefresh);

    logger.info(`Fetched ${coins.length} coins, now screening...`);

    // Screen coins based on filters
    const candidates: CoinCandidate[] = [];
    const analysisLog: CoinAnalysisLog[] = [];
    const rejectionReasons: { [key: string]: number } = {};

    for (const coin of coins) {
      try {
        const logEntry: CoinAnalysisLog = {
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          rank: coin.market_cap_rank,
          timestamp: new Date(),
          passed: false,
          reason: '',
          details: {
            marketCap: coin.market_cap,
            volume24h: coin.total_volume,
            priceChange24h: coin.price_change_percentage_24h || 0,
            priceChange7d: coin.price_change_percentage_7d || 0,
          },
        };

        // Apply filters with detailed rejection reasons
        if (filters.minMarketCap && coin.market_cap < filters.minMarketCap) {
          logEntry.reason = `Market cap too low ($${(coin.market_cap / 1e6).toFixed(1)}M < $${(filters.minMarketCap / 1e6).toFixed(0)}M minimum)`;
          rejectionReasons[logEntry.reason] = (rejectionReasons[logEntry.reason] || 0) + 1;
          analysisLog.push(logEntry);
          continue;
        }

        if (filters.maxMarketCap && coin.market_cap > filters.maxMarketCap) {
          logEntry.reason = `Market cap too high ($${(coin.market_cap / 1e9).toFixed(1)}B > $${(filters.maxMarketCap / 1e9).toFixed(1)}B maximum)`;
          rejectionReasons[logEntry.reason] = (rejectionReasons[logEntry.reason] || 0) + 1;
          analysisLog.push(logEntry);
          continue;
        }

        if (filters.minVolume24h && coin.total_volume < filters.minVolume24h) {
          logEntry.reason = `Volume too low ($${(coin.total_volume / 1e6).toFixed(1)}M < $${(filters.minVolume24h / 1e6).toFixed(0)}M minimum)`;
          rejectionReasons[logEntry.reason] = (rejectionReasons[logEntry.reason] || 0) + 1;
          analysisLog.push(logEntry);
          continue;
        }

        // Calculate scores
        const volumeScore = calculateVolumeScore(coin);
        const momentumScore = calculateMomentumScore(coin);
        
        logEntry.details.volumeScore = volumeScore;
        logEntry.details.momentumScore = momentumScore;

        // Get sentiment (with fallback)
        let sentimentScore = 50; // Default neutral
        try {
          const sentiment = await getQuickSentiment(coin.symbol);
          sentimentScore = sentiment * 100;
        } catch (error) {
          logger.warn(`Failed to get sentiment for ${coin.symbol}, using neutral`);
        }

        logEntry.details.sentimentScore = sentimentScore;

        const compositeScore = calculateCompositeScore(
          volumeScore,
          momentumScore,
          sentimentScore
        );

        logEntry.compositeScore = compositeScore;

        // Only include coins with decent composite score
        if (compositeScore >= 60) {
          logEntry.passed = true;
          logEntry.reason = `✅ Passed screening (score: ${compositeScore.toFixed(0)})`;
          
          candidates.push({
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            marketCapRank: coin.market_cap_rank,
            marketCap: coin.market_cap,
            currentPrice: coin.current_price,
            volume24h: coin.total_volume,
            priceChange24h: coin.price_change_percentage_24h || 0,
            priceChange7d: coin.price_change_percentage_7d || 0,
            volumeScore,
            momentumScore,
            sentimentScore,
            compositeScore,
          });
        } else {
          const reasons = [];
          if (volumeScore < 30) reasons.push('weak volume');
          if (momentumScore < 30) reasons.push('poor momentum');
          if (sentimentScore < 40) reasons.push('negative sentiment');
          
          logEntry.reason = `Composite score too low (${compositeScore.toFixed(0)}/100): ${reasons.join(', ')}`;
          rejectionReasons['Low composite score'] = (rejectionReasons['Low composite score'] || 0) + 1;
        }

        analysisLog.push(logEntry);
      } catch (error) {
        logger.warn(`Failed to process coin ${coin.symbol}`, { error });
        const errorReason = `Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`;
        rejectionReasons[errorReason] = (rejectionReasons[errorReason] || 0) + 1;
        analysisLog.push({
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          rank: coin.market_cap_rank,
          timestamp: new Date(),
          passed: false,
          reason: errorReason,
          details: {},
        });
        continue;
      }
    }

    // Sort by composite score (descending)
    candidates.sort((a, b) => b.compositeScore - a.compositeScore);

    // Store top candidates in database
    if (candidates.length > 0) {
      await storeDiscoveredCoins(candidates.slice(0, 10));
    }

    // Calculate summary
    const topRejectionReasons = Object.entries(rejectionReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Verify rejection count matches
    const totalRejections = Object.values(rejectionReasons).reduce((sum, count) => sum + count, 0);
    const expectedRejections = coins.length - candidates.length;
    
    if (totalRejections !== expectedRejections) {
      logger.warn('Rejection count mismatch', {
        totalRejections,
        expectedRejections,
        difference: expectedRejections - totalRejections
      });
    }

    const result: DiscoveryResult = {
      candidates,
      analysisLog,
      summary: {
        totalAnalyzed: coins.length,
        passed: candidates.length,
        rejected: totalRejections, // Use actual count from rejectionReasons
        topRejectionReasons,
      },
    };

    logger.info(`Discovery complete: Found ${candidates.length} candidates out of ${coins.length}`, {
      topSymbols: candidates.slice(0, 5).map(c => c.symbol),
      topRejections: topRejectionReasons,
    });

    return result;
  } catch (error) {
    logger.error('Coin discovery failed', { error });
    throw error;
  }
}

/**
 * Fetch coins by market cap from CoinGecko
 */
async function fetchCoinsByMarketCap(limit: number, forceRefresh: boolean = false): Promise<any[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets`;
    const params: any = {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: limit,
      page: 1,
      sparkline: false,
      price_change_percentage: '24h,7d',
    };
    
    // Add cache-busting parameter if force refresh
    if (forceRefresh) {
      params._t = Date.now();
    }

    const response = await axios.get(url, {
      params,
      headers: {
        'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
      },
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to fetch coins from CoinGecko', { error });
    throw error;
  }
}

/**
 * Calculate volume score (0-100)
 * Higher score = Unusual volume spike
 */
function calculateVolumeScore(coin: any): number {
  // Volume/Market Cap ratio
  const volumeRatio = coin.total_volume / coin.market_cap;
  
  // Normalize to 0-100 scale
  // Typical ratio is 0.01-0.5, anything above 0.3 is significant
  const score = (volumeRatio / 0.3) * 100;
  
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Calculate momentum score (0-100)
 * Higher score = Strong recent momentum
 */
function calculateMomentumScore(coin: any): number {
  const change24h = coin.price_change_percentage_24h || 0;
  const change7d = coin.price_change_percentage_7d || 0;
  
  // Weight recent changes more heavily
  const weightedMomentum = (change24h * 0.6) + (change7d * 0.4);
  
  // Normalize to 0-100
  // -10% to +10% maps to 0-100
  const score = ((weightedMomentum + 10) / 20) * 100;
  
  return Math.min(Math.max(score, 0), 100);
}

/**
 * Calculate composite score from all factors
 */
function calculateCompositeScore(
  volumeScore: number,
  momentumScore: number,
  sentimentScore: number
): number {
  // Weighted average
  const weights = {
    volume: 0.4,      // Volume is most important (shows interest)
    momentum: 0.35,   // Price momentum is next
    sentiment: 0.25,  // Sentiment can be manipulated, lower weight
  };

  const composite =
    volumeScore * weights.volume +
    momentumScore * weights.momentum +
    sentimentScore * weights.sentiment;

  return Math.round(composite);
}

/**
 * Get quick sentiment estimate (lightweight, no deep analysis)
 */
async function getQuickSentiment(symbol: string): Promise<number> {
  try {
    // Just get recent news count and basic sentiment
    const news = await getCryptoNews(symbol, 5);
    
    if (news.length === 0) return 0.5; // Neutral

    // Simple positive/negative count
    let positive = 0;
    let negative = 0;

    for (const article of news) {
      const votes = article.votes;
      if (votes) {
        positive += votes.positive || 0;
        negative += votes.negative || 0;
      }
    }

    const total = positive + negative;
    if (total === 0) return 0.5;

    return positive / total;
  } catch (error) {
    logger.warn(`Quick sentiment failed for ${symbol}`, { error });
    return 0.5; // Neutral fallback
  }
}

/**
 * Store discovered coins in database
 */
async function storeDiscoveredCoins(candidates: CoinCandidate[]): Promise<void> {
  try {
    for (const coin of candidates) {
      await query(
        `INSERT INTO discovered_coins (
          symbol, name, market_cap_rank, market_cap, current_price,
          volume_24h, volume_score, price_momentum_score, sentiment_score, composite_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (symbol) DO UPDATE SET
          market_cap = EXCLUDED.market_cap,
          current_price = EXCLUDED.current_price,
          volume_24h = EXCLUDED.volume_24h,
          volume_score = EXCLUDED.volume_score,
          price_momentum_score = EXCLUDED.price_momentum_score,
          sentiment_score = EXCLUDED.sentiment_score,
          composite_score = EXCLUDED.composite_score,
          discovered_at = NOW()`,
        [
          coin.symbol,
          coin.name,
          coin.marketCapRank,
          coin.marketCap,
          coin.currentPrice,
          coin.volume24h,
          coin.volumeScore,
          coin.momentumScore,
          coin.sentimentScore,
          coin.compositeScore,
        ]
      );
    }

    logger.info(`Stored ${candidates.length} discovered coins in database`);
  } catch (error) {
    logger.error('Failed to store discovered coins', { error });
    throw error;
  }
}

/**
 * Get top discovered coins from database
 */
export async function getTopDiscoveries(limit: number = 10): Promise<CoinCandidate[]> {
  try {
    const result = await query(
      `SELECT * FROM discovered_coins
       WHERE discovered_at > NOW() - INTERVAL '7 days'
       ORDER BY composite_score DESC, discovered_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      marketCapRank: row.market_cap_rank,
      marketCap: parseFloat(row.market_cap),
      currentPrice: parseFloat(row.current_price),
      volume24h: parseFloat(row.volume_24h),
      priceChange24h: 0, // Not stored
      priceChange7d: 0,  // Not stored
      volumeScore: parseFloat(row.volume_score),
      momentumScore: parseFloat(row.price_momentum_score),
      sentimentScore: parseFloat(row.sentiment_score),
      compositeScore: parseFloat(row.composite_score),
    }));
  } catch (error) {
    logger.error('Failed to get top discoveries', { error });
    throw error;
  }
}

/**
 * Mark coin as analyzed
 */
export async function markAsAnalyzed(symbol: string): Promise<void> {
  try {
    await query(
      'UPDATE discovered_coins SET analyzed = TRUE WHERE symbol = $1',
      [symbol]
    );
  } catch (error) {
    logger.error('Failed to mark coin as analyzed', { symbol, error });
  }
}
