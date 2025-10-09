import Parser from 'rss-parser';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL } from '../../config/constants';
import { dataLogger as logger } from '../../utils/logger';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'crypto-ai-trading-bot/1.0',
  },
});

export interface RSSArticle {
  id: string;
  title: string;
  link: string;
  content: string;
  contentSnippet: string;
  source: string;
  publishedAt: Date;
  author?: string;
  categories?: string[];
}

// Popular crypto news RSS feeds
const RSS_FEEDS = {
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  cointelegraph: 'https://cointelegraph.com/rss',
  decrypt: 'https://decrypt.co/feed',
  bitcoinMagazine: 'https://bitcoinmagazine.com/feed',
  cryptobriefing: 'https://cryptobriefing.com/feed/',
  theblock: 'https://www.theblock.co/rss.xml',
};

/**
 * Fetch news from a single RSS feed
 */
async function fetchFeed(feedUrl: string, feedName: string): Promise<RSSArticle[]> {
  try {
    logger.debug(`Fetching RSS feed: ${feedName}`, { url: feedUrl });

    const feed = await parser.parseURL(feedUrl);

    const articles: RSSArticle[] = feed.items.map((item, index) => ({
      id: item.guid || item.link || `${feedName}-${index}`,
      title: item.title || 'Untitled',
      link: item.link || '',
      content: item.content || item.contentSnippet || '',
      contentSnippet: item.contentSnippet || item.content?.substring(0, 200) || '',
      source: feedName,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      author: item.creator || item.author,
      categories: item.categories || [],
    }));

    logger.info(`RSS feed fetched: ${feedName}`, { count: articles.length });

    return articles;
  } catch (error) {
    logger.warn(`Failed to fetch RSS feed: ${feedName}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: feedUrl,
    });
    return [];
  }
}

/**
 * Aggregate news from all configured RSS feeds
 */
export async function aggregateRSSNews(limit: number = 50): Promise<RSSArticle[]> {
  const cacheKey = `rss:news:all:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    logger.info('Aggregating RSS news from all sources');

    const feedPromises = Object.entries(RSS_FEEDS).map(([name, url]) =>
      fetchFeed(url, name)
    );

    const results = await Promise.allSettled(feedPromises);

    // Combine all articles
    const allArticles: RSSArticle[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    });

    // Sort by date (most recent first)
    allArticles.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    // Remove duplicates by title similarity
    const unique = deduplicateByTitle(allArticles);

    logger.info('RSS news aggregation complete', {
      total: allArticles.length,
      unique: unique.length,
      returned: Math.min(limit, unique.length),
    });

    return unique.slice(0, limit);
  });
}

/**
 * Get news from a specific RSS source
 */
export async function getRSSNewsBySource(
  source: keyof typeof RSS_FEEDS,
  limit: number = 20
): Promise<RSSArticle[]> {
  const cacheKey = `rss:news:${source}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.NEWS, async () => {
    const feedUrl = RSS_FEEDS[source];
    const articles = await fetchFeed(feedUrl, source);
    return articles.slice(0, limit);
  });
}

/**
 * Filter RSS news by keywords (e.g., specific coins)
 */
export async function filterRSSNewsByKeywords(
  keywords: string[],
  limit: number = 50
): Promise<RSSArticle[]> {
  const allNews = await aggregateRSSNews(limit * 2);

  const filtered = allNews.filter((article) => {
    const searchText = `${article.title} ${article.contentSnippet}`.toLowerCase();
    return keywords.some((keyword) => searchText.includes(keyword.toLowerCase()));
  });

  logger.info('Filtered RSS news by keywords', {
    keywords,
    totalFetched: allNews.length,
    filtered: filtered.length,
  });

  return filtered.slice(0, limit);
}

/**
 * Remove duplicate articles by title similarity
 */
function deduplicateByTitle(articles: RSSArticle[]): RSSArticle[] {
  const seen = new Set<string>();
  const unique: RSSArticle[] = [];

  for (const article of articles) {
    // Normalize title for comparison
    const normalizedTitle = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();

    if (!seen.has(normalizedTitle)) {
      seen.add(normalizedTitle);
      unique.push(article);
    }
  }

  return unique;
}

/**
 * Get all available RSS sources
 */
export function getAvailableRSSSources(): string[] {
  return Object.keys(RSS_FEEDS);
}
