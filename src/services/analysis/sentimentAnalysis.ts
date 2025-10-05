import Sentiment from 'sentiment';
import { RedditPost, RedditComment, calculateCredibility } from '../dataCollection/redditService';
import { NewsArticle, calculateNewsSentiment } from '../dataCollection/cryptoPanicService';
import { SENTIMENT_SCORES } from '../../config/constants';
import { logger } from '../../utils/logger';

const sentimentAnalyzer = new Sentiment();

export interface SentimentScore {
  score: number; // -1 to 1
  magnitude: number; // 0 to 1 (strength of sentiment)
  classification: 'bullish' | 'bearish' | 'neutral';
}

export interface AggregatedSentiment {
  overall: SentimentScore;
  reddit: SentimentScore;
  news: SentimentScore;
  mentionVolume: number;
  credibilityWeighted: number;
  velocity: number; // Rate of change in sentiment
  sources: {
    reddit: number;
    news: number;
  };
}

/**
 * Analyze sentiment of text using local library
 */
export function analyzeText(text: string): SentimentScore {
  try {
    const result = sentimentAnalyzer.analyze(text);

    // Normalize score to -1 to 1 range
    const maxScore = 10; // Typical max absolute score
    const normalizedScore = Math.max(-1, Math.min(1, result.score / maxScore));

    // Calculate magnitude (0-1)
    const magnitude = Math.min(1, Math.abs(result.score) / maxScore);

    // Classify
    let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (normalizedScore > 0.2) {
      classification = 'bullish';
    } else if (normalizedScore < -0.2) {
      classification = 'bearish';
    }

    return {
      score: normalizedScore,
      magnitude,
      classification,
    };
  } catch (error) {
    logger.error('Text sentiment analysis failed', { error });
    return {
      score: 0,
      magnitude: 0,
      classification: 'neutral',
    };
  }
}

/**
 * Enhance sentiment analysis with crypto-specific keywords
 */
export function analyzeCryptoSentiment(text: string): SentimentScore {
  const baseSentiment = analyzeText(text);

  // Crypto-specific bullish keywords
  const bullishKeywords = [
    'moon',
    'bullish',
    'pump',
    'rally',
    'breakout',
    'hodl',
    'buy',
    'accumulate',
    'bottom',
    'undervalued',
    'gem',
    'explosive',
    'rocket',
    'lambo',
    'adoption',
    'partnership',
  ];

  // Crypto-specific bearish keywords
  const bearishKeywords = [
    'dump',
    'crash',
    'scam',
    'rug',
    'bearish',
    'sell',
    'exit',
    'bubble',
    'overvalued',
    'dead',
    'rekt',
    'liquidated',
    'ponzi',
    'fraud',
  ];

  const textLower = text.toLowerCase();

  // Count keyword occurrences
  let bullishCount = 0;
  let bearishCount = 0;

  for (const keyword of bullishKeywords) {
    if (textLower.includes(keyword)) bullishCount++;
  }

  for (const keyword of bearishKeywords) {
    if (textLower.includes(keyword)) bearishCount++;
  }

  // Adjust score based on crypto keywords
  const keywordAdjustment = (bullishCount - bearishCount) * 0.1;
  const adjustedScore = Math.max(
    -1,
    Math.min(1, baseSentiment.score + keywordAdjustment)
  );

  // Reclassify if needed
  let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (adjustedScore > 0.2) {
    classification = 'bullish';
  } else if (adjustedScore < -0.2) {
    classification = 'bearish';
  }

  return {
    score: adjustedScore,
    magnitude: Math.max(baseSentiment.magnitude, (bullishCount + bearishCount) * 0.1),
    classification,
  };
}

/**
 * Analyze sentiment from Reddit posts
 */
export async function analyzeRedditSentiment(
  posts: RedditPost[]
): Promise<SentimentScore> {
  if (posts.length === 0) {
    return { score: 0, magnitude: 0, classification: 'neutral' };
  }

  let weightedScore = 0;
  let totalWeight = 0;
  let totalMagnitude = 0;

  for (const post of posts) {
    const text = `${post.title} ${post.selftext}`;
    const sentiment = analyzeCryptoSentiment(text);

    // Calculate credibility-based weight
    const credibility = await calculateCredibility(
      post.author,
      post.score,
      post.num_comments
    );

    const weight = credibility.credibilityScore * (1 + Math.log10(post.score + 1));

    weightedScore += sentiment.score * weight;
    totalWeight += weight;
    totalMagnitude += sentiment.magnitude;
  }

  const averageScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  const averageMagnitude = totalMagnitude / posts.length;

  let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (averageScore > 0.2) {
    classification = 'bullish';
  } else if (averageScore < -0.2) {
    classification = 'bearish';
  }

  logger.debug('Reddit sentiment analyzed', {
    posts: posts.length,
    score: averageScore.toFixed(3),
    classification,
  });

  return {
    score: averageScore,
    magnitude: averageMagnitude,
    classification,
  };
}

/**
 * Analyze sentiment from news articles
 */
export function analyzeNewsSentiment(articles: NewsArticle[]): SentimentScore {
  if (articles.length === 0) {
    return { score: 0, magnitude: 0, classification: 'neutral' };
  }

  let totalScore = 0;
  let totalMagnitude = 0;

  for (const article of articles) {
    // Use CryptoPanic's voting-based sentiment
    const voteSentiment = calculateNewsSentiment(article);

    // Also analyze title text
    const textSentiment = analyzeCryptoSentiment(article.title);

    // Average both methods
    const combinedScore = (voteSentiment + textSentiment.score) / 2;

    // Weight by total votes (more votes = more reliable)
    const totalVotes = Object.values(article.votes).reduce((sum, v) => sum + v, 0);
    const weight = Math.log10(totalVotes + 10); // Log scale

    totalScore += combinedScore * weight;
    totalMagnitude += textSentiment.magnitude * weight;
  }

  const averageScore = totalScore / articles.length;
  const averageMagnitude = totalMagnitude / articles.length;

  let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (averageScore > 0.2) {
    classification = 'bullish';
  } else if (averageScore < -0.2) {
    classification = 'bearish';
  }

  logger.debug('News sentiment analyzed', {
    articles: articles.length,
    score: averageScore.toFixed(3),
    classification,
  });

  return {
    score: averageScore,
    magnitude: averageMagnitude,
    classification,
  };
}

/**
 * Aggregate sentiment from multiple sources
 */
export function aggregateSentiment(
  redditPosts: RedditPost[],
  newsArticles: NewsArticle[],
  previousSentiment?: number
): AggregatedSentiment {
  const redditSentiment = analyzeRedditSentiment(redditPosts);
  const newsSentiment = analyzeNewsSentiment(newsArticles);

  // Weight news slightly more than Reddit (news is often more reliable)
  const redditWeight = 0.4;
  const newsWeight = 0.6;

  const overallScore =
    (redditSentiment.score * redditWeight + newsSentiment.score * newsWeight);

  const overallMagnitude =
    (redditSentiment.magnitude * redditWeight + newsSentiment.magnitude * newsWeight);

  let classification: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (overallScore > 0.2) {
    classification = 'bullish';
  } else if (overallScore < -0.2) {
    classification = 'bearish';
  }

  // Calculate sentiment velocity (rate of change)
  let velocity = 0;
  if (previousSentiment !== undefined) {
    velocity = overallScore - previousSentiment;
  }

  const mentionVolume = redditPosts.length + newsArticles.length;

  // Calculate credibility-weighted sentiment
  // This is a placeholder - actual implementation would use calculated credibility
  const credibilityWeighted = overallScore;

  logger.info('Aggregated sentiment calculated', {
    overall: overallScore.toFixed(3),
    classification,
    mentions: mentionVolume,
    velocity: velocity.toFixed(3),
  });

  return {
    overall: {
      score: overallScore,
      magnitude: overallMagnitude,
      classification,
    },
    reddit: redditSentiment,
    news: newsSentiment,
    mentionVolume,
    credibilityWeighted,
    velocity,
    sources: {
      reddit: redditPosts.length,
      news: newsArticles.length,
    },
  };
}

/**
 * Detect sentiment manipulation (pump and dump indicators)
 */
export function detectManipulation(
  sentiment: AggregatedSentiment,
  priceChange: number
): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let suspicious = false;

  // Extremely positive sentiment with low mention volume (fake hype)
  if (
    sentiment.overall.score > 0.7 &&
    sentiment.mentionVolume < 10
  ) {
    reasons.push('Very positive sentiment with low mention volume');
    suspicious = true;
  }

  // Sudden spike in sentiment velocity
  if (Math.abs(sentiment.velocity) > 0.5) {
    reasons.push('Rapid sentiment change detected');
    suspicious = true;
  }

  // Sentiment-price divergence (sentiment positive, price dropping)
  if (sentiment.overall.score > 0.5 && priceChange < -5) {
    reasons.push('Bullish sentiment while price drops significantly');
    suspicious = true;
  }

  // Very high sentiment but low magnitude (weak conviction)
  if (
    Math.abs(sentiment.overall.score) > 0.6 &&
    sentiment.overall.magnitude < 0.3
  ) {
    reasons.push('Strong sentiment but low conviction');
    suspicious = true;
  }

  if (suspicious) {
    logger.warn('Potential sentiment manipulation detected', { reasons });
  }

  return { suspicious, reasons };
}

/**
 * Calculate sentiment trend over time
 */
export function calculateSentimentTrend(
  historicalSentiments: Array<{ timestamp: number; score: number }>
): {
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
} {
  if (historicalSentiments.length < 2) {
    return { trend: 'stable', slope: 0 };
  }

  // Simple linear regression
  const n = historicalSentiments.length;
  const sumX = historicalSentiments.reduce((sum, _, i) => sum + i, 0);
  const sumY = historicalSentiments.reduce((sum, s) => sum + s.score, 0);
  const sumXY = historicalSentiments.reduce(
    (sum, s, i) => sum + i * s.score,
    0
  );
  const sumX2 = historicalSentiments.reduce((sum, _, i) => sum + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (slope > 0.05) {
    trend = 'increasing';
  } else if (slope < -0.05) {
    trend = 'decreasing';
  }

  return { trend, slope };
}
