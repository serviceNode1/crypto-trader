import axios from 'axios';
import { cacheAside } from '../../config/redis';
import { CACHE_TTL, REDDIT_SUBREDDITS, CREDIBILITY_FACTORS } from '../../config/constants';
import { withRetryJitter, isRetryableError } from '../../utils/retry';
import { withRateLimit, rateLimiters } from '../../utils/rateLimiter';
import { dataLogger as logger } from '../../utils/logger';

const BASE_URL = 'https://oauth.reddit.com';
const AUTH_URL = 'https://www.reddit.com/api/v1/access_token';

let accessToken: string | null = null;
let tokenExpiry: number = 0;

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  created_utc: number;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  permalink: string;
  url: string;
  // Processed/computed fields (added during analysis)
  content?: string;        // Combined title + selftext for analysis
  sentiment?: number;      // Sentiment score (-1 to 1)
  authorKarma?: number;    // Author credibility score
  numComments?: number;    // Alias for num_comments (camelCase)
  createdAt?: Date;        // Converted created_utc as Date object
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  created_utc: number;
  score: number;
  permalink: string;
}

interface AuthorCredibility {
  accountAge: number;
  karma: number;
  credibilityScore: number;
}

/**
 * Get Reddit OAuth access token
 */
async function getAccessToken(): Promise<string> {
  // Check if token is still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const auth = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
    ).toString('base64');

    logger.debug('Requesting Reddit access token');

    const response = await axios.post(
      AUTH_URL,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': process.env.REDDIT_USER_AGENT || 'crypto-trader:v1.0.0',
        },
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000; // Refresh 1 min early

    logger.info('Reddit access token obtained');
    return accessToken!;
  } catch (error) {
    logger.error('Failed to get Reddit access token', { error });
    throw error;
  }
}

/**
 * Get posts from a subreddit
 */
export async function getSubredditPosts(
  subreddit: string,
  limit: number = 100,
  timeFilter: 'hour' | 'day' | 'week' = 'day'
): Promise<RedditPost[]> {
  const cacheKey = `reddit:posts:${subreddit}:${timeFilter}:${limit}`;

  return cacheAside(cacheKey, CACHE_TTL.SENTIMENT, async () => {
    return withRateLimit(
      rateLimiters.reddit,
      async () => {
        return withRetryJitter(
          async () => {
            const token = await getAccessToken();
            const url = `${BASE_URL}/r/${subreddit}/hot`;

            logger.debug('Fetching subreddit posts', {
              subreddit,
              limit,
              timeFilter,
            });

            const response = await axios.get(url, {
              params: {
                limit,
                t: timeFilter,
              },
              headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': process.env.REDDIT_USER_AGENT || 'crypto-trader:v1.0.0',
              },
            });

            const posts: RedditPost[] = response.data.data.children.map(
              (child: any) => ({
                id: child.data.id,
                title: child.data.title,
                selftext: child.data.selftext,
                author: child.data.author,
                subreddit: child.data.subreddit,
                created_utc: child.data.created_utc,
                score: child.data.score,
                upvote_ratio: child.data.upvote_ratio,
                num_comments: child.data.num_comments,
                permalink: child.data.permalink,
                url: child.data.url,
              })
            );

            logger.info('Subreddit posts fetched', {
              subreddit,
              count: posts.length,
            });
            return posts;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Reddit'
    );
  });
}

/**
 * Search posts in a subreddit by keyword
 */
export async function searchSubreddit(
  subreddit: string,
  query: string,
  limit: number = 50
): Promise<RedditPost[]> {
  return withRateLimit(
    rateLimiters.reddit,
    async () => {
      return withRetryJitter(
        async () => {
          const token = await getAccessToken();
          const url = `${BASE_URL}/r/${subreddit}/search`;

          logger.debug('Searching subreddit', { subreddit, query, limit });

          const response = await axios.get(url, {
            params: {
              q: query,
              restrict_sr: true,
              limit,
              sort: 'relevance',
              t: 'week',
            },
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': process.env.REDDIT_USER_AGENT || 'crypto-trader:v1.0.0',
            },
          });

          const posts: RedditPost[] = response.data.data.children.map(
            (child: any) => ({
              id: child.data.id,
              title: child.data.title,
              selftext: child.data.selftext,
              author: child.data.author,
              subreddit: child.data.subreddit,
              created_utc: child.data.created_utc,
              score: child.data.score,
              upvote_ratio: child.data.upvote_ratio,
              num_comments: child.data.num_comments,
              permalink: child.data.permalink,
              url: child.data.url,
            })
          );

          logger.info('Subreddit search completed', {
            subreddit,
            query,
            count: posts.length,
          });
          return posts;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'Reddit'
  );
}

/**
 * Get comments from a post
 */
export async function getPostComments(
  subreddit: string,
  postId: string,
  limit: number = 100
): Promise<RedditComment[]> {
  return withRateLimit(
    rateLimiters.reddit,
    async () => {
      return withRetryJitter(
        async () => {
          const token = await getAccessToken();
          const url = `${BASE_URL}/r/${subreddit}/comments/${postId}`;

          logger.debug('Fetching post comments', { subreddit, postId, limit });

          const response = await axios.get(url, {
            params: { limit },
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': process.env.REDDIT_USER_AGENT || 'crypto-trader:v1.0.0',
            },
          });

          // Comments are in the second element of the response array
          const commentData = response.data[1]?.data?.children || [];

          const comments: RedditComment[] = commentData
            .filter((child: any) => child.kind === 't1')
            .map((child: any) => ({
              id: child.data.id,
              body: child.data.body,
              author: child.data.author,
              created_utc: child.data.created_utc,
              score: child.data.score,
              permalink: child.data.permalink,
            }));

          logger.info('Post comments fetched', {
            postId,
            count: comments.length,
          });
          return comments;
        },
        { shouldRetry: isRetryableError }
      );
    },
    'Reddit'
  );
}

/**
 * Get user information for credibility scoring
 */
export async function getUserInfo(username: string): Promise<any> {
  const cacheKey = `reddit:user:${username}`;

  return cacheAside(cacheKey, CACHE_TTL.HISTORICAL, async () => {
    return withRateLimit(
      rateLimiters.reddit,
      async () => {
        return withRetryJitter(
          async () => {
            const token = await getAccessToken();
            const url = `${BASE_URL}/user/${username}/about`;

            logger.debug('Fetching user info', { username });

            const response = await axios.get(url, {
              headers: {
                Authorization: `Bearer ${token}`,
                'User-Agent': process.env.REDDIT_USER_AGENT || 'crypto-trader:v1.0.0',
              },
            });

            logger.info('User info fetched', { username });
            return response.data.data;
          },
          { shouldRetry: isRetryableError }
        );
      },
      'Reddit'
    );
  });
}

/**
 * Calculate author credibility score
 */
export async function calculateCredibility(
  username: string,
  postScore: number,
  numComments: number
): Promise<AuthorCredibility> {
  try {
    const userInfo = await getUserInfo(username);

    const accountAge =
      (Date.now() / 1000 - userInfo.created_utc) / (24 * 60 * 60); // Days
    const karma = userInfo.total_karma || 0;

    // Normalize factors
    const ageScore = Math.min(
      accountAge / CREDIBILITY_FACTORS.MIN_ACCOUNT_AGE_DAYS,
      1
    );
    const karmaScore = Math.min(karma / (CREDIBILITY_FACTORS.MIN_KARMA * 10), 1);
    const engagementScore = Math.min(
      (postScore + numComments) / 100,
      1
    );

    // Weighted average
    const credibilityScore =
      ageScore * CREDIBILITY_FACTORS.AGE_WEIGHT +
      karmaScore * CREDIBILITY_FACTORS.KARMA_WEIGHT +
      engagementScore * CREDIBILITY_FACTORS.ENGAGEMENT_WEIGHT;

    logger.debug('Credibility calculated', {
      username,
      accountAge: Math.round(accountAge),
      karma,
      credibilityScore: credibilityScore.toFixed(2),
    });

    return {
      accountAge: Math.round(accountAge),
      karma,
      credibilityScore,
    };
  } catch (error) {
    logger.warn('Failed to calculate credibility, using default', {
      username,
      error,
    });
    return {
      accountAge: 0,
      karma: 0,
      credibilityScore: 0.5, // Default to neutral credibility
    };
  }
}

/**
 * Get posts mentioning a specific cryptocurrency across monitored subreddits
 */
export async function getCryptoMentions(
  symbol: string,
  limit: number = 50
): Promise<RedditPost[]> {
  const searchTerms = [
    symbol.toUpperCase(),
    `$${symbol.toUpperCase()}`,
    symbol.toLowerCase(),
  ];

  const allPosts: RedditPost[] = [];

  for (const subreddit of REDDIT_SUBREDDITS) {
    for (const term of searchTerms) {
      try {
        const posts = await searchSubreddit(subreddit, term, limit);
        allPosts.push(...posts);
      } catch (error) {
        logger.warn('Failed to search subreddit', { subreddit, term, error });
      }
    }
  }

  // Remove duplicates by post ID
  const uniquePosts = Array.from(
    new Map(allPosts.map((post) => [post.id, post])).values()
  );

  logger.info('Crypto mentions collected', {
    symbol,
    totalPosts: uniquePosts.length,
  });

  return uniquePosts;
}

export { RedditPost, RedditComment, AuthorCredibility };
