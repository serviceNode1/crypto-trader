import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';

const BASE_URL = 'https://cryptopanic.com/api/v1';

// Feature flag: Disable CryptoPanic to save API calls (100/month limit exceeded)
// Set CRYPTOPANIC_ENABLED=true in .env to re-enable
const CRYPTOPANIC_ENABLED = process.env.CRYPTOPANIC_ENABLED === 'true';

if (!CRYPTOPANIC_ENABLED) {
  logger.warn('⚠️  CryptoPanic is DISABLED (to save API calls). Set CRYPTOPANIC_ENABLED=true to re-enable.');
}

interface NewsArticle {
  id: number;
  title: string;
  url: string;
  source: {
    title: string;
    domain: string;
  };
  published_at: string;
  domain: string;
  currencies: Array<{
    code: string;
    title: string;
  }>;
  votes: {
    negative: number;
    positive: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
    comments: number;
  };
  // Computed field (calculated from votes)
  sentiment?: number;  // Sentiment score (-1 to 1)
}

interface NewsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NewsArticle[];
}

/**
 * Get latest news posts
 */
export async function getLatestNews(
  filter: 'rising' | 'hot' | 'bullish' | 'bearish' | 'important' = 'hot',
  currencies?: string[],
  limit: number = 50
): Promise<NewsArticle[]> {
  // Return empty array if CryptoPanic is disabled
  if (!CRYPTOPANIC_ENABLED) {
    logger.debug('CryptoPanic is disabled, returning empty news array');
    return [];
  }

  const currencyParam = currencies?.join(',') || '';
  const cacheKey = `news:latest:${filter}:${currencyParam}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    return withRateLimit(
      rateLimiters.cryptoPanic,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/posts/`;

            const params: any = {
              auth_token: process.env.CRYPTOPANIC_API_KEY,
              filter,
              public: 'true',
            };

            if (currencies && currencies.length > 0) {
              params.currencies = currencies.join(',');
            }

            logger.debug('Fetching news from CryptoPanic', {
              filter,
              currencies: currencyParam,
              limit,
            });

            const response = await axios.get<NewsResponse>(url, { params });

            const articles = response.data.results.slice(0, limit);

            logger.info('News articles fetched', {
              filter,
              count: articles.length,
            });
            return articles;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CryptoPanic'
    );
  });
}

/**
 * Get news for a specific cryptocurrency
 */
export async function getCryptoNews(
  symbol: string,
  limit: number = 50
): Promise<NewsArticle[]> {
  // Return empty array if CryptoPanic is disabled
  if (!CRYPTOPANIC_ENABLED) {
    logger.debug('CryptoPanic is disabled, returning empty news array', { symbol });
    return [];
  }

  const cacheKey = `news:crypto:${symbol}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    return withRateLimit(
      rateLimiters.cryptoPanic,
      async () => {
        return withRetryJitter(
          async () => {
            const url = `${BASE_URL}/posts/`;

            logger.debug('Fetching crypto-specific news', { symbol, limit });

            const response = await axios.get<NewsResponse>(url, {
              params: {
                auth_token: process.env.CRYPTOPANIC_API_KEY,
                currencies: symbol.toUpperCase(),
                public: 'true',
              },
            });

            const articles = response.data.results.slice(0, limit);

            logger.info('Crypto news fetched', {
              symbol,
              count: articles.length,
            });
            return articles;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'CryptoPanic'
    );
  });
}

/**
 * Calculate news sentiment score based on votes
 */
export function calculateNewsSentiment(article: NewsArticle): number {
  // Defensive: Handle missing votes
  if (!article.votes) {
    return 0;
  }

  const { positive = 0, negative = 0, important = 0, toxic = 0 } = article.votes;

  // Weight important news more heavily
  const importanceMultiplier = important > 0 ? 1.5 : 1;

  // Calculate sentiment (-1 to 1)
  const totalVotes = positive + negative + toxic;
  if (totalVotes === 0) return 0;

  const sentimentScore =
    ((positive - negative - toxic * 1.5) / totalVotes) * importanceMultiplier;

  return Math.max(-1, Math.min(1, sentimentScore));
}

/**
 * Filter news by sentiment
 */
export function filterNewsBySentiment(
  articles: NewsArticle[],
  minSentiment: number = 0
): NewsArticle[] {
  return articles.filter((article) => {
    const sentiment = calculateNewsSentiment(article);
    return sentiment >= minSentiment;
  });
}

/**
 * Get trending news (most voted)
 */
export async function getTrendingNews(limit: number = 20): Promise<NewsArticle[]> {
  const allNews = await getLatestNews('hot', undefined, limit * 2);

  // Sort by total votes
  const sorted = allNews.sort((a, b) => {
    const votesA = Object.values(a.votes).reduce((sum, val) => sum + val, 0);
    const votesB = Object.values(b.votes).reduce((sum, val) => sum + val, 0);
    return votesB - votesA;
  });

  return sorted.slice(0, limit);
}

/**
 * Get important news only
 */
export async function getImportantNews(
  currencies?: string[],
  limit: number = 20
): Promise<NewsArticle[]> {
  return getLatestNews('important', currencies, limit);
}

/**
 * Detect if news is about a price movement
 */
export function isPriceMovementNews(article: NewsArticle): boolean {
  const priceKeywords = [
    'surge',
    'pump',
    'rally',
    'crash',
    'dump',
    'drop',
    'plunge',
    'soar',
    'spike',
    'breakout',
    'breakdown',
    'all-time high',
    'ath',
    'new high',
    'new low',
    '%',
  ];

  const titleLower = article.title.toLowerCase();
  return priceKeywords.some((keyword) => titleLower.includes(keyword));
}

/**
 * Detect if news is regulatory/legal
 */
export function isRegulatoryNews(article: NewsArticle): boolean {
  const regulatoryKeywords = [
    'sec',
    'regulation',
    'regulatory',
    'legal',
    'lawsuit',
    'ban',
    'banned',
    'government',
    'compliance',
    'license',
    'approval',
    'approved',
  ];

  const titleLower = article.title.toLowerCase();
  return regulatoryKeywords.some((keyword) => titleLower.includes(keyword));
}

/**
 * Detect if news is about partnerships/adoption
 */
export function isAdoptionNews(article: NewsArticle): boolean {
  const adoptionKeywords = [
    'partnership',
    'partners',
    'adoption',
    'integrate',
    'integration',
    'accept',
    'launch',
    'launches',
    'support',
    'add',
    'adds',
  ];

  const titleLower = article.title.toLowerCase();
  return adoptionKeywords.some((keyword) => titleLower.includes(keyword));
}

/**
 * Categorize news article
 */
export function categorizeNews(article: NewsArticle): string[] {
  const categories: string[] = [];

  if (isPriceMovementNews(article)) categories.push('price_movement');
  if (isRegulatoryNews(article)) categories.push('regulatory');
  if (isAdoptionNews(article)) categories.push('adoption');

  const sentiment = calculateNewsSentiment(article);
  if (sentiment > 0.3) categories.push('bullish');
  else if (sentiment < -0.3) categories.push('bearish');
  else categories.push('neutral');

  if (article.votes.important > 0) categories.push('important');

  return categories.length > 0 ? categories : ['general'];
}

/**
 * Get news summary for multiple cryptocurrencies
 */
export async function getMultiCryptoNewsSummary(
  symbols: string[]
): Promise<Map<string, NewsArticle[]>> {
  const newsMap = new Map<string, NewsArticle[]>();

  for (const symbol of symbols) {
    try {
      const news = await getCryptoNews(symbol, 10);
      newsMap.set(symbol, news);
    } catch (error) {
      logger.warn('Failed to fetch news for symbol', { symbol, error });
      newsMap.set(symbol, []);
    }
  }

  return newsMap;
}

export { NewsArticle, NewsResponse };
