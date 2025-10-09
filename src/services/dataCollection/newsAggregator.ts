import {
  getCryptoCompareNews,
  getCryptoNewsBySymbol as getCryptoCompareBySymbol,
  calculateArticleSentiment,
  CryptoCompareArticle,
} from './cryptocompareService';
import {
  aggregateRSSNews,
  filterRSSNewsByKeywords,
  RSSArticle,
} from './rssFeedService';
import { analyzeCryptoSentiment } from '../analysis/sentimentAnalysis';
import { dataLogger as logger } from '../../utils/logger';

/**
 * Unified article format combining all news sources
 */
export interface UnifiedArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  sourceType: 'cryptocompare' | 'rss';
  publishedAt: Date;
  sentiment?: number; // -1 to 1
  sentimentMagnitude?: number; // 0 to 1
  relatedCoins?: string[];
  categories?: string[];
  upvotes?: number;
  downvotes?: number;
}

/**
 * Aggregate news from all available sources
 */
export async function getAggregatedNews(
  symbols?: string[],
  limit: number = 50
): Promise<UnifiedArticle[]> {
  logger.info('Starting news aggregation', { symbols, limit });

  const articles: UnifiedArticle[] = [];

  // Source 1: CryptoCompare (3000 calls/month FREE)
  try {
    let ccNews: CryptoCompareArticle[];
    if (symbols && symbols.length > 0) {
      ccNews = await getCryptoCompareBySymbol(symbols, 20);
    } else {
      ccNews = await getCryptoCompareNews(undefined, 20);
    }

    const ccArticles = ccNews.map(normalizeArticle);
    articles.push(...ccArticles);
    logger.info('CryptoCompare news fetched', { count: ccArticles.length });
  } catch (error) {
    logger.warn('CryptoCompare news failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Source 2: RSS Feeds (Unlimited, FREE)
  try {
    let rssNews: RSSArticle[];
    if (symbols && symbols.length > 0) {
      rssNews = await filterRSSNewsByKeywords(symbols, 30);
    } else {
      rssNews = await aggregateRSSNews(30);
    }

    const rssArticles = rssNews.map(normalizeRSSArticle);
    articles.push(...rssArticles);
    logger.info('RSS news fetched', { count: rssArticles.length });
  } catch (error) {
    logger.warn('RSS news failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Deduplicate by title similarity
  const unique = deduplicateArticles(articles);

  // Sort by date (most recent first)
  unique.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  // Analyze sentiment for each article
  const withSentiment = unique.map((article) => ({
    ...article,
    ...analyzeArticleSentiment(article),
  }));

  // Apply source reliability weighting
  const weighted = withSentiment.map((article) => ({
    ...article,
    sentiment: (article.sentiment || 0) * getSourceWeight(article.source),
  }));

  logger.info('News aggregation complete', {
    total: articles.length,
    unique: unique.length,
    returned: Math.min(limit, weighted.length),
  });

  return weighted.slice(0, limit);
}

/**
 * Get news for a specific cryptocurrency
 */
export async function getCryptoNews(
  symbol: string,
  limit: number = 50
): Promise<UnifiedArticle[]> {
  return getAggregatedNews([symbol], limit);
}

/**
 * Normalize CryptoCompare article to unified format
 */
function normalizeArticle(article: CryptoCompareArticle): UnifiedArticle {
  return {
    id: article.id || article.guid,
    title: article.title,
    content: article.body,
    url: article.url,
    source: article.source_info?.name || article.source,
    sourceType: 'cryptocompare',
    publishedAt: new Date(article.published_on * 1000),
    categories: article.categories?.split('|') || [],
    upvotes: parseInt(article.upvotes) || 0,
    downvotes: parseInt(article.downvotes) || 0,
    sentiment: calculateArticleSentiment(article),
  };
}

/**
 * Normalize RSS article to unified format
 */
function normalizeRSSArticle(article: RSSArticle): UnifiedArticle {
  return {
    id: article.id,
    title: article.title,
    content: article.content || article.contentSnippet,
    url: article.link,
    source: article.source,
    sourceType: 'rss',
    publishedAt: article.publishedAt,
    categories: article.categories || [],
  };
}

/**
 * Analyze sentiment of article content
 */
function analyzeArticleSentiment(article: UnifiedArticle): {
  sentiment: number;
  sentimentMagnitude: number;
} {
  // If we already have sentiment from votes (CryptoCompare), use that
  if (article.sentiment !== undefined) {
    return {
      sentiment: article.sentiment,
      sentimentMagnitude: Math.abs(article.sentiment),
    };
  }

  // Analyze title (weighted 60%)
  const titleSentiment = analyzeCryptoSentiment(article.title);

  // Analyze content if available (weighted 40%)
  const contentPreview = article.content.substring(0, 500);
  const contentSentiment = contentPreview
    ? analyzeCryptoSentiment(contentPreview)
    : { score: 0, magnitude: 0 };

  const combinedScore = titleSentiment.score * 0.6 + contentSentiment.score * 0.4;
  const combinedMagnitude =
    titleSentiment.magnitude * 0.6 + contentSentiment.magnitude * 0.4;

  return {
    sentiment: combinedScore,
    sentimentMagnitude: combinedMagnitude,
  };
}

/**
 * Deduplicate articles by title similarity
 */
function deduplicateArticles(articles: UnifiedArticle[]): UnifiedArticle[] {
  const seen = new Map<string, UnifiedArticle>();

  for (const article of articles) {
    // Normalize title for comparison
    const normalizedTitle = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // If we haven't seen this title, or if this version is newer, keep it
    const existing = seen.get(normalizedTitle);
    if (!existing || article.publishedAt > existing.publishedAt) {
      seen.set(normalizedTitle, article);
    }
  }

  return Array.from(seen.values());
}

/**
 * Get source reliability weight
 * More credible sources get higher weight in sentiment calculation
 */
function getSourceWeight(source: string): number {
  const weights: { [key: string]: number } = {
    // Tier 1: Highly credible
    coindesk: 1.0,
    cointelegraph: 0.95,
    decrypt: 0.95,
    'Bitcoin Magazine': 0.9,
    bitcoinMagazine: 0.9,
    'The Block': 0.95,
    theblock: 0.95,

    // Tier 2: Credible
    CryptoCompare: 0.85,
    cryptobriefing: 0.85,
    'Crypto Briefing': 0.85,

    // Default for unknown sources
    default: 0.7,
  };

  return weights[source] || weights.default;
}

/**
 * Calculate aggregate sentiment from multiple articles
 */
export function calculateAggregateSentiment(
  articles: UnifiedArticle[]
): {
  score: number;
  magnitude: number;
  classification: 'bullish' | 'bearish' | 'neutral';
  articleCount: number;
} {
  if (articles.length === 0) {
    return {
      score: 0,
      magnitude: 0,
      classification: 'neutral',
      articleCount: 0,
    };
  }

  let totalScore = 0;
  let totalMagnitude = 0;

  for (const article of articles) {
    const sentiment = article.sentiment || 0;
    const magnitude = article.sentimentMagnitude || Math.abs(sentiment);

    totalScore += sentiment;
    totalMagnitude += magnitude;
  }

  const averageScore = totalScore / articles.length;
  const averageMagnitude = totalMagnitude / articles.length;

  const classification =
    averageScore > 0.2 ? 'bullish' : averageScore < -0.2 ? 'bearish' : 'neutral';

  return {
    score: averageScore,
    magnitude: averageMagnitude,
    classification,
    articleCount: articles.length,
  };
}
