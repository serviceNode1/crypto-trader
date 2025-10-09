import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { dataLogger as logger } from '../../utils/logger';

const BASE_URL = 'https://min-api.cryptocompare.com/data/v2';
const API_KEY = process.env.CRYPTOCOMPARE_API_KEY || '';

if (API_KEY) {
  logger.info('CryptoCompare API configured');
} else {
  logger.warn('CryptoCompare API key not found - using rate-limited free tier');
}

export interface CryptoCompareArticle {
  id: string;
  guid: string;
  published_on: number;
  imageurl: string;
  title: string;
  url: string;
  source: string;
  body: string;
  tags: string;
  categories: string;
  upvotes: string;
  downvotes: string;
  lang: string;
  source_info: {
    name: string;
    lang: string;
    img: string;
  };
}

interface CryptoCompareResponse {
  Type: number;
  Message: string;
  Promoted: any[];
  Data: CryptoCompareArticle[];
  RateLimit: any;
  HasWarning: boolean;
}

/**
 * Get latest crypto news from CryptoCompare
 * Free tier: 3000 calls/month (no API key needed, but recommended for higher limits)
 */
export async function getCryptoCompareNews(
  categories?: string[],
  limit: number = 50
): Promise<CryptoCompareArticle[]> {
  const cacheKey = `cryptocompare:news:${categories?.join(',') || 'all'}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    return withRetryJitter(
      async () => {
        const url = `${BASE_URL}/news/`;

        const params: any = {
          lang: 'EN',
        };

        if (API_KEY) {
          params.api_key = API_KEY;
        }

        if (categories && categories.length > 0) {
          params.categories = categories.join(',');
        }

        logger.debug('Fetching news from CryptoCompare', {
          categories,
          limit,
          hasApiKey: !!API_KEY,
        });

        const response = await axios.get<CryptoCompareResponse>(url, {
          params,
          timeout: 10000,
        });

        if (response.data.Type !== 100) {
          throw new Error(`CryptoCompare API error: ${response.data.Message}`);
        }

        const articles = response.data.Data.slice(0, limit);

        logger.info('News fetched from CryptoCompare', {
          count: articles.length,
          categories,
        });

        return articles;
      },
      { shouldRetry: isRetryableError }
    );
  });
}

/**
 * Get news for specific cryptocurrencies
 */
export async function getCryptoNewsBySymbol(
  symbols: string[],
  limit: number = 50
): Promise<CryptoCompareArticle[]> {
  const cacheKey = `cryptocompare:news:symbols:${symbols.join(',')}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    return withRetryJitter(
      async () => {
        // CryptoCompare doesn't have a symbol-specific endpoint,
        // so we fetch all news and filter by tags/body content
        const allNews = await getCryptoCompareNews(undefined, limit * 2);

        // Filter news that mentions any of the specified symbols
        const filtered = allNews.filter((article) => {
          const searchText = `${article.title} ${article.body} ${article.tags}`.toLowerCase();
          return symbols.some((symbol) =>
            searchText.includes(symbol.toLowerCase())
          );
        });

        logger.info('Filtered news by symbols', {
          symbols,
          totalFetched: allNews.length,
          filtered: filtered.length,
        });

        return filtered.slice(0, limit);
      },
      { shouldRetry: isRetryableError }
    );
  });
}

/**
 * Get trending news (most popular)
 */
export async function getTrendingNews(limit: number = 20): Promise<CryptoCompareArticle[]> {
  const cacheKey = `cryptocompare:news:trending:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    const news = await getCryptoCompareNews(undefined, limit * 2);

    // Sort by upvotes (most popular first)
    const sorted = news.sort((a, b) => {
      const upvotesA = parseInt(a.upvotes) || 0;
      const upvotesB = parseInt(b.upvotes) || 0;
      return upvotesB - upvotesA;
    });

    return sorted.slice(0, limit);
  });
}

/**
 * Calculate sentiment from upvotes/downvotes
 */
export function calculateArticleSentiment(article: CryptoCompareArticle): number {
  const upvotes = parseInt(article.upvotes) || 0;
  const downvotes = parseInt(article.downvotes) || 0;
  const total = upvotes + downvotes;

  if (total === 0) {
    return 0; // Neutral if no votes
  }

  // Return score from -1 to 1
  return (upvotes - downvotes) / total;
}

export { CryptoCompareResponse };
