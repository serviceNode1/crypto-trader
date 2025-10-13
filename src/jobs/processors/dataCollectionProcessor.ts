import { Job } from 'bull';
import { getCurrentPrice } from '../../services/dataCollection/coinGeckoService';
import { getCryptoNews } from '../../services/dataCollection/cryptoPanicService';
import { getCryptoMentions } from '../../services/dataCollection/redditService';
import { getMarketContext } from '../../services/analysis/marketContext';
import { query } from '../../config/database';
import { SUPPORTED_SYMBOLS } from '../../config/constants';
import { logger } from '../../utils/logger';

interface DataCollectionJobData {
  type: 'prices' | 'news' | 'sentiment' | 'market-context' | 'all';
  symbol?: string;
}

/**
 * Collect price data for all supported symbols
 */
async function collectPrices(): Promise<void> {
  logger.info('Collecting price data...');
  
  for (const symbol of SUPPORTED_SYMBOLS) {
    try {
      const price = await getCurrentPrice(symbol);
      
      // Store in database
      await query(
        `INSERT INTO price_data (symbol, price, timestamp)
         VALUES ($1, $2, NOW())`,
        [symbol, price]
      );
      
      logger.debug(`Stored price for ${symbol}: $${price}`);
    } catch (error) {
      logger.error(`Failed to collect price for ${symbol}`, { error });
    }
  }
  
  logger.info(`Collected prices for ${SUPPORTED_SYMBOLS.length} symbols`);
}

/**
 * Collect news data for all supported symbols
 */
async function collectNews(): Promise<void> {
  logger.info('Collecting news data...');
  
  for (const symbol of SUPPORTED_SYMBOLS) {
    try {
      const news = await getCryptoNews(symbol, 10);
      
      // Store each news article
      for (const article of news) {
        try {
          // Truncate long fields to prevent database errors
          const safeTitle = truncate(article.title, 500);     // VARCHAR(500)
          const safeUrl = truncate(article.url, 500);         // VARCHAR(500)
          
          // Handle source - it might be an object { title, domain } or a string
          const sourceString = typeof article.source === 'object' && article.source !== null
            ? (article.source.title || article.source.domain || 'unknown')
            : String(article.source || 'unknown');
          const safeSource = truncate(sourceString, 100);     // VARCHAR(100)
          
          await query(
            `INSERT INTO news (title, url, published_at, source, sentiment, votes, symbol)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (url) DO UPDATE SET
               sentiment = EXCLUDED.sentiment,
               votes = EXCLUDED.votes`,
            [
              safeTitle,
              safeUrl,
              article.published_at,
              safeSource,
              article.sentiment,
              article.votes,
              symbol,
            ]
          );
        } catch (articleError) {
          logger.warn(`Failed to store news article for ${symbol}`, { 
            error: articleError,
            title: article.title?.substring(0, 50)
          });
          // Continue with next article
        }
      }
      
      logger.debug(`Stored ${news.length} news articles for ${symbol}`);
    } catch (error) {
      logger.error(`Failed to collect news for ${symbol}`, { error });
    }
  }
  
  logger.info('News collection completed');
}

/**
 * Safely truncate string to maximum length
 */
function truncate(str: string | null | undefined, maxLength: number): string | null {
  if (!str) return null;
  const s = String(str);
  return s.length > maxLength ? s.substring(0, maxLength) : s;
}

/**
 * Collect sentiment data from Reddit
 */
async function collectSentiment(): Promise<void> {
  logger.info('Collecting sentiment data...');
  
  for (const symbol of SUPPORTED_SYMBOLS) {
    try {
      const posts = await getCryptoMentions(symbol, 20);
      
      // Store sentiment data
      for (const post of posts) {
        try {
          // Generate post_id from URL or content hash
          const timestamp = post.createdAt ? new Date(post.createdAt).getTime() : Date.now();
          const postId = post.url || `${symbol}_${post.author}_${timestamp}`;
          
          // Truncate long fields to prevent database errors
          // Adjust these limits based on your database schema
          const safeContent = truncate(post.content, 5000);      // TEXT field, limit to 5000 chars
          const safeUrl = truncate(post.url, 500);               // VARCHAR(500)
          const safePostId = truncate(postId, 255);              // VARCHAR(255)
          const safeAuthor = truncate(post.author, 100);         // VARCHAR(100)
          
          await query(
            `INSERT INTO sentiment (
              symbol, source, content, score, author, author_karma,
              upvotes, comments, created_at, url, post_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (post_id) DO UPDATE SET
               score = EXCLUDED.score,
               upvotes = EXCLUDED.upvotes,
               comments = EXCLUDED.comments`,
            [
              symbol,
              'reddit',
              safeContent,
              post.sentiment,
              safeAuthor,
              post.authorKarma,
              post.score,
              post.numComments,
              post.createdAt,
              safeUrl,
              safePostId,
            ]
          );
        } catch (postError) {
          logger.warn(`Failed to store sentiment post for ${symbol}`, { 
            error: postError,
            author: post.author,
            contentLength: post.content?.length
          });
          // Continue with next post
        }
      }
      
      logger.debug(`Stored ${posts.length} sentiment posts for ${symbol}`);
    } catch (error) {
      logger.error(`Failed to collect sentiment for ${symbol}`, { error });
    }
  }
  
  logger.info('Sentiment collection completed');
}

/**
 * Collect market context data
 */
async function collectMarketContext(): Promise<void> {
  logger.info('Collecting market context...');
  
  try {
    const context = await getMarketContext();
    
    // Store market context
    await query(
      `INSERT INTO market_context (
        btc_dominance, total_market_cap, total_volume,
        eth_dominance, altcoin_market_cap, fear_greed_index,
        sp500_price, gold_price, dxy_price, vix_price,
        risk_sentiment, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        context.btcDominance,
        context.totalMarketCap,
        context.totalVolume,
        context.ethDominance || null,
        context.altcoinMarketCap || null,
        context.fearGreedIndex || null,
        context.sp500 || null,
        context.gold || null,
        context.dxy || null,
        context.vix || null,
        context.riskSentiment || null,
      ]
    );
    
    logger.info('Market context stored successfully');
  } catch (error) {
    logger.error('Failed to collect market context', { error });
  }
}

/**
 * Process data collection jobs
 */
export async function processDataCollection(job: Job<DataCollectionJobData>): Promise<void> {
  const { type, symbol } = job.data;
  
  logger.info(`Processing data collection job: ${type}`, { symbol });
  
  try {
    switch (type) {
      case 'prices':
        await collectPrices();
        break;
        
      case 'news':
        await collectNews();
        break;
        
      case 'sentiment':
        await collectSentiment();
        break;
        
      case 'market-context':
        await collectMarketContext();
        break;
        
      case 'all':
        await Promise.all([
          collectPrices(),
          collectNews(),
          collectSentiment(),
          collectMarketContext(),
        ]);
        break;
        
      default:
        throw new Error(`Unknown data collection type: ${type}`);
    }
    
    logger.info(`Data collection job completed: ${type}`);
  } catch (error) {
    logger.error(`Data collection job failed: ${type}`, { error });
    throw error;
  }
}
