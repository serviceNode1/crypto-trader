# 📋 API Integration & Optimization - Implementation Plan

## Overview
Replace CryptoPanic with free alternatives, optimize API usage, and implement daily data snapshots.

---

## 🎯 Goals
1. ✅ **Zero CryptoPanic API calls** (save 100 calls/month)
2. ✅ **Reduce CoinGecko calls by 90%** (from 1000s/day → ~50/day)
3. ✅ **Use Binance.US** for US compliance
4. ✅ **Add free news sources** (CryptoCompare + RSS feeds)
5. ✅ **Implement sentiment analysis** on scraped articles
6. ✅ **Daily market snapshot** at optimal time
7. ✅ **Aggressive caching** to minimize API calls

---

## 📊 News Sentiment Architecture

### Current (CryptoPanic):
```
CryptoPanic API → News with votes → Sentiment score (60% weight)
Reddit API → Posts → Sentiment score (40% weight)
→ Combined sentiment
```

### New (Multi-Source):
```
Source 1: CryptoCompare API (3000 calls/month FREE)
Source 2: CoinMarketCap Scraper (unlimited, no API key)
Source 3: Reddit API (60 calls/min)
Source 4: RSS Feeds (CoinDesk, CoinTelegraph, Decrypt)

→ All sources → Unified article format
→ Sentiment analysis using existing analyzeCryptoSentiment()
→ Weight by source credibility
→ Combined sentiment score
```

### Sentiment Analysis Strategy:
**We already have the tools!** Our `analyzeCryptoSentiment()` function:
1. Analyzes text for positive/negative words
2. Detects crypto-specific keywords (moon, pump, dump, scam, etc.)
3. Returns score (-1 to 1), magnitude, and classification

**For scraped articles:**
```typescript
// Article from any source
const article = {
  title: "Bitcoin Surges to New All-Time High",
  content: "Bitcoin broke through $50,000 today...",
  source: "CoinDesk"
};

// Analyze sentiment
const titleSentiment = analyzeCryptoSentiment(article.title);
const contentSentiment = analyzeCryptoSentiment(article.content);

// Combine (title weighted more, it's usually clearer)
const sentiment = (titleSentiment.score * 0.6 + contentSentiment.score * 0.4);
```

---

## 🔧 Implementation Steps

### Step 1: Fix Binance.US Endpoint ✅

**Issue:** Currently using global Binance (restricted for US users)

**Solution:**
```typescript
// binanceService.ts - Line 8
// OLD:
const BASE_URL = 'https://api.binance.com/api/v3';

// NEW (with US detection):
const BASE_URL = process.env.BINANCE_REGION === 'US' 
  ? 'https://api.binance.us/api/v3'
  : 'https://api.binance.com/api/v3';
```

**Add to .env:**
```env
BINANCE_REGION=US  # or 'GLOBAL' for non-US users
```

**Note:** Binance.US has fewer trading pairs than global Binance.
- ✅ Available: BTC, ETH, SOL, ADA, DOT, AVAX, MATIC, etc.
- ❌ Not available: Some smaller altcoins

---

### Step 2: Disable CryptoPanic (Keep Code)

**Approach:** Add feature flag, keep all functions intact

```typescript
// cryptoPanicService.ts - Add at top
const CRYPTOPANIC_ENABLED = process.env.CRYPTOPANIC_ENABLED === 'true';

// Modify each function:
export async function getCryptoNews(symbol: string, limit: number = 50) {
  if (!CRYPTOPANIC_ENABLED) {
    logger.info('CryptoPanic is disabled, returning empty results');
    return [];
  }
  // ... existing code
}
```

**Add to .env:**
```env
CRYPTOPANIC_ENABLED=false  # Disable to save API calls
```

**Result:** Zero CryptoPanic calls, but easy to re-enable later

---

### Step 3: CryptoCompare News API Service

**API:** https://min-api.cryptocompare.com/data/v2/news/
**Rate Limit:** 3000 calls/month FREE (no credit card!)
**Signup:** https://www.cryptocompare.com/

**Create new service: `cryptocompareService.ts`**

```typescript
interface CryptoCompareArticle {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  published_on: number;
  categories: string;
  tags: string;
  imageurl: string;
}

export async function getCryptoCompareNews(
  symbols?: string[],
  limit: number = 50
): Promise<CryptoCompareArticle[]> {
  const url = 'https://min-api.cryptocompare.com/data/v2/news/';
  
  const response = await axios.get(url, {
    params: {
      api_key: process.env.CRYPTOCOMPARE_API_KEY, // Optional for free tier
      categories: symbols?.join(','),
      lang: 'EN'
    }
  });
  
  return response.data.Data.slice(0, limit);
}
```

**Advantages:**
- ✅ 3000 calls/month (vs CryptoPanic's 100)
- ✅ Article full text (not just titles)
- ✅ Categorized by coin
- ✅ Reliable source metadata

---

### Step 4: CoinMarketCap News Scraper

**Approach:** Scrape public news feed (no API key needed)

**URL:** `https://coinmarketcap.com/headlines/news/`

**Create: `coinMarketCapScraper.ts`**

```typescript
import axios from 'axios';
import * as cheerio from 'cheerio'; // Need to install: npm install cheerio

export async function scrapeCMCNews(limit: number = 50) {
  const url = 'https://coinmarketcap.com/headlines/news/';
  
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const articles = [];
  
  $('.sc-4984dd93-0').each((i, elem) => {
    if (i >= limit) return false;
    
    const title = $(elem).find('.news-title').text().trim();
    const url = $(elem).find('a').attr('href');
    const source = $(elem).find('.news-source').text().trim();
    const time = $(elem).find('.news-time').text().trim();
    
    articles.push({
      title,
      url,
      source,
      publishedAt: time,
      content: title // CMC doesn't show full content on list page
    });
  });
  
  return articles;
}
```

**Note:** Web scraping can break if CMC changes their HTML structure. Need error handling.

---

### Step 5: RSS Feed Aggregator

**Sources (All FREE, no signup):**
- CoinDesk: `https://www.coindesk.com/arc/outboundfeeds/rss/`
- CoinTelegraph: `https://cointelegraph.com/rss`
- Decrypt: `https://decrypt.co/feed`
- Bitcoin Magazine: `https://bitcoinmagazine.com/feed`

**Create: `rssFeedService.ts`**

```typescript
import Parser from 'rss-parser'; // npm install rss-parser

const parser = new Parser();

const RSS_FEEDS = [
  'https://www.coindesk.com/arc/outboundfeeds/rss/',
  'https://cointelegraph.com/rss',
  'https://decrypt.co/feed'
];

export async function aggregateRSSNews(limit: number = 50) {
  const allArticles = [];
  
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      
      feed.items.forEach(item => {
        allArticles.push({
          title: item.title,
          url: item.link,
          content: item.contentSnippet || item.content,
          source: feed.title,
          publishedAt: item.pubDate
        });
      });
    } catch (error) {
      logger.warn(`Failed to fetch RSS feed: ${feedUrl}`, { error });
    }
  }
  
  // Sort by date, return most recent
  return allArticles
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}
```

**Advantages:**
- ✅ Unlimited, free
- ✅ No API keys
- ✅ Multiple sources
- ✅ Full article content (usually)

---

### Step 6: Unified News Aggregator

**Create: `newsAggregator.ts`**

This service combines all news sources into one unified interface:

```typescript
interface UnifiedArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  source: string;
  publishedAt: Date;
  sentiment?: number;
  categories?: string[];
  relatedCoins?: string[];
}

export async function getAggregatedNews(
  symbols?: string[],
  limit: number = 50
): Promise<UnifiedArticle[]> {
  const articles: UnifiedArticle[] = [];
  
  // Source 1: CryptoCompare (if API key available)
  try {
    if (process.env.CRYPTOCOMPARE_API_KEY) {
      const ccNews = await getCryptoCompareNews(symbols, 20);
      articles.push(...ccNews.map(normalizeArticle));
    }
  } catch (error) {
    logger.warn('CryptoCompare news failed', { error });
  }
  
  // Source 2: RSS Feeds (always available)
  try {
    const rssNews = await aggregateRSSNews(20);
    articles.push(...rssNews.map(normalizeArticle));
  } catch (error) {
    logger.warn('RSS news failed', { error });
  }
  
  // Source 3: CoinMarketCap (scraping, might fail)
  try {
    const cmcNews = await scrapeCMCNews(10);
    articles.push(...cmcNews.map(normalizeArticle));
  } catch (error) {
    logger.warn('CMC scraping failed', { error });
  }
  
  // Deduplicate by title similarity
  const unique = deduplicateArticles(articles);
  
  // Filter by symbols if provided
  const filtered = symbols 
    ? unique.filter(a => matchesSymbols(a, symbols))
    : unique;
  
  // Analyze sentiment for each article
  const withSentiment = filtered.map(article => ({
    ...article,
    sentiment: analyzeArticleSentiment(article)
  }));
  
  // Sort by date, return most recent
  return withSentiment
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

function analyzeArticleSentiment(article: UnifiedArticle): number {
  // Analyze title (weighted 60%)
  const titleSentiment = analyzeCryptoSentiment(article.title);
  
  // Analyze content if available (weighted 40%)
  const contentSentiment = article.content 
    ? analyzeCryptoSentiment(article.content.substring(0, 500))
    : { score: 0 };
  
  return (titleSentiment.score * 0.6 + contentSentiment.score * 0.4);
}
```

**Benefits:**
- ✅ **Redundancy:** If one source fails, others continue
- ✅ **More data:** 3+ sources vs 1 (CryptoPanic)
- ✅ **Better sentiment:** Full article content analysis
- ✅ **Free:** No API costs

---

### Step 7: Update Sentiment Analysis

**Modify `sentimentAnalysis.ts`:**

```typescript
export async function aggregateSentiment(
  redditPosts: RedditPost[],
  newsArticles: UnifiedArticle[], // Now from aggregator
  previousSentiment?: number
): Promise<AggregatedSentiment> {
  
  const redditSentiment = await analyzeRedditSentiment(redditPosts);
  
  // NEW: Analyze aggregated news with full content
  const newsSentiment = analyzeUnifiedNewsSentiment(newsArticles);
  
  // Weight: 40% Reddit, 60% News (more sources = more reliable)
  const overallScore = (
    redditSentiment.score * 0.4 + 
    newsSentiment.score * 0.6
  );
  
  // ... rest of function
}

function analyzeUnifiedNewsSentiment(
  articles: UnifiedArticle[]
): SentimentScore {
  if (articles.length === 0) {
    return { score: 0, magnitude: 0, classification: 'neutral' };
  }
  
  let totalScore = 0;
  let totalMagnitude = 0;
  
  for (const article of articles) {
    // Use pre-calculated sentiment if available
    const sentiment = article.sentiment !== undefined
      ? article.sentiment
      : analyzeArticleSentiment(article);
    
    // Weight by source reliability
    const sourceWeight = getSourceWeight(article.source);
    
    totalScore += sentiment * sourceWeight;
    totalMagnitude += Math.abs(sentiment) * sourceWeight;
  }
  
  const averageScore = totalScore / articles.length;
  const averageMagnitude = totalMagnitude / articles.length;
  
  return {
    score: averageScore,
    magnitude: averageMagnitude,
    classification: averageScore > 0.2 ? 'bullish' 
                   : averageScore < -0.2 ? 'bearish' 
                   : 'neutral'
  };
}

function getSourceWeight(source: string): number {
  // More credible sources get higher weight
  const weights: { [key: string]: number } = {
    'CoinDesk': 1.0,
    'CoinTelegraph': 0.9,
    'Decrypt': 0.9,
    'Bitcoin Magazine': 0.8,
    'CoinMarketCap': 0.7,
    'Unknown': 0.5
  };
  
  return weights[source] || weights['Unknown'];
}
```

---

### Step 8: Aggressive Caching

**Update `.env`:**

```env
# OLD (current):
CACHE_TTL_PRICE=60              # 1 minute
CACHE_TTL_MARKETCAP=300         # 5 minutes
CACHE_TTL_SENTIMENT=900         # 15 minutes
CACHE_TTL_NEWS=1800             # 30 minutes
CACHE_TTL_HISTORICAL=86400      # 1 day

# NEW (aggressive):
CACHE_TTL_PRICE=300             # 5 minutes (prices change slowly)
CACHE_TTL_MARKETCAP=3600        # 1 hour (rankings rarely change)
CACHE_TTL_SENTIMENT=1800        # 30 minutes (sentiment evolves slowly)
CACHE_TTL_NEWS=7200             # 2 hours (news is static once published)
CACHE_TTL_HISTORICAL=172800     # 2 days (historical data doesn't change)
CACHE_TTL_DISCOVERY=14400       # 4 hours (NEW: cache discovery results)
```

**Impact:**
- Price calls: 60s → 300s = **80% fewer API calls**
- Market cap calls: 300s → 3600s = **92% fewer API calls**
- News calls: 1800s → 7200s = **75% fewer API calls**

**Trade-off:** Data is 5 minutes old instead of 1 minute (acceptable for non-HFT trading)

---

### Step 9: Daily Market Snapshot

**Crypto Market Hours:**
- **Crypto markets:** 24/7 (never close)
- **US stock markets:** 9:30 AM - 4:00 PM ET (Mon-Fri)
- **Peak trading volume:** 8 AM - 12 PM ET (overlap with Europe)

**Recommended snapshot time: 6:00 AM ET**

**Why 6 AM ET?**
- ✅ Before US market open (get fresh data)
- ✅ After Asian markets active (captures overnight moves)
- ✅ Low server load (most users sleeping)
- ✅ Data ready for 9:30 AM analysis

**Create: `jobs/dailySnapshotJob.ts`**

```typescript
import { query } from '../../config/database';
import { getMarketData } from '../../services/dataCollection/coinGeckoService';
import { logger } from '../../utils/logger';

const TOP_COINS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK',
  'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'ALGO', 'VET', 'ICP', 'FIL', 'TRX',
  'HBAR', 'APT', 'ARB', 'OP', 'NEAR', 'STX', 'INJ', 'TIA', 'SUI', 'SEI',
  'IMX', 'RUNE', 'AAVE', 'MKR', 'SNX', 'CRV', 'LDO', 'RPL', 'FXS', 'DYDX',
  'RNDR', 'GRT', 'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'CHZ', 'FLOW', 'APE'
]; // Top 50 coins

export async function runDailySnapshot(): Promise<void> {
  logger.info('Starting daily market snapshot...');
  
  try {
    // Fetch market data for top 50 coins (1 CoinGecko API call)
    const marketData = await getMarketData(TOP_COINS);
    
    // Store in database
    for (const coin of marketData) {
      await query(`
        INSERT INTO daily_snapshots (
          symbol, name, price, market_cap, volume_24h, 
          price_change_24h, price_change_7d, rank, 
          snapshot_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
        ON CONFLICT (symbol, snapshot_date) 
        DO UPDATE SET
          price = EXCLUDED.price,
          market_cap = EXCLUDED.market_cap,
          volume_24h = EXCLUDED.volume_24h,
          price_change_24h = EXCLUDED.price_change_24h,
          price_change_7d = EXCLUDED.price_change_7d,
          rank = EXCLUDED.rank,
          updated_at = NOW()
      `, [
        coin.symbol.toUpperCase(),
        coin.name,
        coin.current_price,
        coin.market_cap,
        coin.total_volume,
        coin.price_change_percentage_24h,
        coin.price_change_percentage_7d || null,
        coin.market_cap_rank
      ]);
    }
    
    logger.info(`Daily snapshot complete: ${marketData.length} coins stored`);
  } catch (error) {
    logger.error('Daily snapshot failed', { error });
    throw error;
  }
}

// Schedule for 6:00 AM ET every day
export const SNAPSHOT_SCHEDULE = '0 6 * * *'; // Cron format: 6 AM daily
```

**Create migration for snapshot table:**

```sql
-- migrations/003_daily_snapshots.sql
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  price DECIMAL(20, 8),
  market_cap BIGINT,
  volume_24h BIGINT,
  price_change_24h DECIMAL(10, 4),
  price_change_7d DECIMAL(10, 4),
  rank INTEGER,
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(symbol, snapshot_date)
);

CREATE INDEX idx_snapshots_symbol ON daily_snapshots(symbol);
CREATE INDEX idx_snapshots_date ON daily_snapshots(snapshot_date);
```

**Benefits:**
- ✅ 1 CoinGecko call/day instead of 100s
- ✅ Fast discovery (database query vs API call)
- ✅ Historical comparison (yesterday vs today)
- ✅ Saves ~97% of CoinGecko API calls

---

### Step 10: Update Coin Universe Options

**Modify settings interface:**

```typescript
// Remove 'top100', add 'top25'
type CoinUniverse = 'top10' | 'top25' | 'top50';

// Update defaults
const DEFAULT_COIN_UNIVERSE = 'top25';
```

**Update discovery logic:**

```typescript
export async function discoverCoins(
  universe: 'top10' | 'top25' | 'top50' = 'top25'
): Promise<DiscoveryResult> {
  const limit = universe === 'top10' ? 10 
              : universe === 'top25' ? 25 
              : 50;
  
  // ... rest of function
}
```

**Update UI (index.html):**

```html
<select id="coinUniverse">
  <option value="top10">Top 10 (Bitcoin, Ethereum, etc.)</option>
  <option value="top25" selected>Top 25 (Recommended)</option>
  <option value="top50">Top 50 (More opportunities)</option>
</select>
```

---

## 📦 Required Dependencies

```bash
npm install cheerio        # For web scraping
npm install rss-parser     # For RSS feed parsing
npm install @types/cheerio --save-dev
```

---

## 🎯 Implementation Order

**Phase 1: Quick Wins (30 minutes)**
1. ✅ Fix Binance.US endpoint
2. ✅ Disable CryptoPanic (feature flag)
3. ✅ Update cache TTLs in .env
4. ✅ Update coin universe options

**Phase 2: New News Sources (1-2 hours)**
5. ✅ CryptoCompare API service
6. ✅ RSS feed aggregator
7. ✅ Unified news aggregator
8. ✅ Update sentiment analysis

**Phase 3: Daily Snapshot (1 hour)**
9. ✅ Create migration for snapshots table
10. ✅ Create daily snapshot job
11. ✅ Schedule with cron
12. ✅ Update discovery to use snapshots

**Phase 4: Optional Enhancements**
13. CoinMarketCap scraper (if needed)
14. Source reliability scoring
15. News deduplication logic

---

## 📊 Expected Results

**API Calls - Before:**
- CryptoPanic: 100+ calls/month → ❌ EXCEEDED
- CoinGecko: ~30,000 calls/month (1000/day)
- Reddit: ~1,500 calls/month (50/day)

**API Calls - After:**
- CryptoPanic: **0 calls/month** ✅
- CoinGecko: **~30 calls/month** (1/day for snapshot) ✅
- CryptoCompare: **~100 calls/month** (3-4/day)
- RSS: **Unlimited** (no API)
- Reddit: **~1,500 calls/month** (unchanged)

**Cost Savings:**
- CryptoPanic: $0/month (was free tier, but maxed out)
- CoinGecko: Stay in free tier ✅
- CryptoCompare: Free tier ✅
- **Total: $0/month** 🎉

---

## ⏰ Daily Schedule

```
6:00 AM ET - Daily market snapshot runs (1 CoinGecko call)
            └─ Fetches top 50 coins
            └─ Stores in database
            
9:00 AM ET - Discovery can run using snapshot data
            └─ Zero additional CoinGecko calls
            └─ Uses cached/snapshot data
            
User triggers - Manual discovery/analysis anytime
              └─ Uses cached data (5-min to 4-hour cache)
              └─ Minimal API calls
```

---

Let me know if you'd like me to start implementing! I recommend starting with **Phase 1** (quick wins) to see immediate results, then moving to **Phase 2** (news sources).
