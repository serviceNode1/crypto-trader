# API Rate Limit Workarounds

## Problem
- **CryptoPanic:** 100 calls/month limit **EXCEEDED**
- **CoinGecko:** 30/min, 10,000/month limit

## Current Usage

### CryptoPanic (News Sentiment)
- **Used for:** 60% of sentiment analysis score
- **Calls per analysis:** 1-2 calls per coin
- **Discovery run:** 100 coins = 100+ calls
- **Monthly usage:** Easily exceeds 100 calls

### CoinGecko (Price & Market Data)
- **Used for:** Prices, market cap, volume, historical data
- **Calls per discovery:** 100+ coins = 200+ calls
- **Calls per analysis:** 3-5 calls per coin
- **Monthly usage:** Can hit 10,000 limit

---

## Solutions

### 🎯 Solution 1: Replace CryptoPanic with Free RSS/Scraping

**CryptoPanic provides:**
- News articles
- Sentiment votes
- Categorization

**Free alternatives:**

#### Option A: CoinMarketCap News (Free, No API Key)
```typescript
// Scrape CMC news feed (publicly available)
const NEWS_URL = 'https://coinmarketcap.com/headlines/news/';
// Returns: title, link, date, category
```

#### Option B: CryptoCompare News API (Free)
```
API: https://min-api.cryptocompare.com/data/v2/news/
Rate Limit: 3000 calls/month FREE
Signup: https://www.cryptocompare.com/
```

#### Option C: Reddit as Primary Sentiment Source
```typescript
// Already implemented! Just disable CryptoPanic
// Reddit provides rich sentiment data
// Free with OAuth (60 calls/min)
```

**Recommendation:** Use Reddit only, disable CryptoPanic

---

### 🎯 Solution 2: Use Binance for Price Data

**Binance provides (FREE, no API key):**
- Current prices (ticker/price)
- 24h volume & price changes (ticker/24hr)
- Historical candlesticks (klines)
- Order book depth

**Rate Limit:** 1200 requests/min (vs CoinGecko's 30/min)

**Current code already supports this!**

```typescript
// Already implemented in binanceService.ts
import { getCandlesticks } from './binanceService';
import { get24hrStats } from './binanceService';

// Binance symbols: BTCUSDT, ETHUSDT, SOLUSDT
```

**Migration strategy:**
1. Use Binance for all price data (free, fast)
2. Use CoinGecko ONLY for:
   - Market cap rankings (once per discovery)
   - Coins not on Binance
3. Cache aggressively (24h for market cap)

---

### 🎯 Solution 3: Aggressive Caching

**Current cache TTLs:**
```typescript
CACHE_TTL_PRICE: 60 seconds       // ⚠️ Too short
CACHE_TTL_MARKETCAP: 300 seconds  // ⚠️ Too short
CACHE_TTL_NEWS: 1800 seconds      // OK
CACHE_TTL_SENTIMENT: 900 seconds  // OK
```

**Recommended changes:**
```typescript
CACHE_TTL_PRICE: 300             // 5 min (prices don't need real-time)
CACHE_TTL_MARKETCAP: 3600        // 1 hour (rankings rarely change)
CACHE_TTL_NEWS: 7200             // 2 hours (news is static once published)
CACHE_TTL_DISCOVERY: 14400       // 4 hours (discovery is expensive)
```

**Impact:**
- Reduces API calls by **80%**
- Discovery runs use cached data
- Analysis uses cached prices

---

### 🎯 Solution 4: Pre-fetch and Store Daily

**Strategy:** Fetch data once daily, store in database

```typescript
// Daily job (runs at midnight)
async function dailyDataSync() {
  // 1. Fetch top 100 coins (1 CoinGecko call)
  const coins = await fetchCoinsByMarketCap(100);
  
  // 2. Store in database
  await storeCoinsSnapshot(coins);
  
  // 3. Use database for discovery all day
  // Zero additional API calls!
}
```

**Benefits:**
- 100 API calls/month → 1 call/day = 30 calls/month
- Saves 97% of API calls
- Faster discovery (no network delay)

---

### 🎯 Solution 5: Disable Auto-Discovery

**Current issue:** Discovery might run automatically via jobs

```env
# In .env
ENABLE_JOB_SCHEDULER=false  # Already disabled ✅
```

**Manual discovery only:**
- Run when YOU decide
- Control API usage
- More intentional analysis

---

### 🎯 Solution 6: Use Top 10 or Top 50 Only

**Current:** Discovery scans Top 100 coins

**Recommendation:** Reduce to Top 50 or Top 10

```typescript
// In settings or .env
COIN_UNIVERSE=top50  // Instead of top100
```

**Impact:**
- Top 100 → Top 50 = **50% fewer API calls**
- Top 100 → Top 10 = **90% fewer API calls**

**Trade-off:** Miss opportunities in smaller coins

---

## 🎯 Recommended Implementation (Quick Wins)

### Step 1: Disable CryptoPanic Entirely ✅ **IMMEDIATE**

```typescript
// In sentimentAnalysis.ts, modify aggregateSentiment()

export async function aggregateSentiment(
  redditPosts: RedditPost[],
  newsArticles: NewsArticle[],  // Keep parameter for compatibility
  previousSentiment?: number
): Promise<AggregatedSentiment> {
  
  const redditSentiment = await analyzeRedditSentiment(redditPosts);
  
  // ⚠️ DISABLE NEWS SENTIMENT (CryptoPanic)
  const newsSentiment = {
    score: 0,
    magnitude: 0,
    classification: 'neutral' as const
  };
  
  // Use Reddit as 100% of sentiment (instead of 40%)
  const overallScore = redditSentiment.score;
  const overallMagnitude = redditSentiment.magnitude;
  
  // ... rest of function
}
```

**Result:** Zero CryptoPanic API calls

---

### Step 2: Switch to Binance for Prices ✅ **IMMEDIATE**

```typescript
// Create new hybrid service: priceService.ts

export async function getCurrentPrice(symbol: string): Promise<number> {
  try {
    // Try Binance first (free, fast, 1200/min limit)
    const binanceSymbol = `${symbol}USDT`;
    const stats = await get24hrStats(binanceSymbol);
    return parseFloat(stats.lastPrice);
  } catch (error) {
    // Fallback to CoinGecko (for coins not on Binance)
    logger.warn(`Binance failed for ${symbol}, using CoinGecko`);
    return getCurrentPriceFromCoinGecko(symbol);
  }
}
```

**Result:** 90% fewer CoinGecko calls

---

### Step 3: Increase Cache TTLs ✅ **IMMEDIATE**

```env
# In .env, update these values:
CACHE_TTL_PRICE=300           # 5 min (was 60s)
CACHE_TTL_MARKETCAP=3600      # 1 hour (was 300s)
CACHE_TTL_NEWS=7200           # 2 hours (was 1800s)
CACHE_TTL_HISTORICAL=172800   # 2 days (was 86400s)
```

**Result:** 80% fewer repeated calls

---

### Step 4: Use Top 50 Instead of Top 100 ✅ **SETTINGS**

```typescript
// In UI settings or .env
DEFAULT_COIN_UNIVERSE=top50
```

**Result:** 50% fewer coins to analyze

---

### Step 5: Daily Snapshot Job (Future Enhancement)

Create a daily job that pre-fetches all coin data once:

```typescript
// jobs/dailySnapshot.ts
export async function runDailySnapshot() {
  // Fetch top 100 coins (1 CoinGecko call)
  const coins = await getMarketData(['BTC', 'ETH', 'SOL', ...]);
  
  // Store in database
  await query(`
    INSERT INTO coin_snapshots (symbol, price, market_cap, volume, timestamp)
    VALUES ($1, $2, $3, $4, NOW())
  `, [symbol, price, marketCap, volume]);
  
  // Discovery uses database instead of API
}
```

**Result:** 1 call/day instead of 100+ calls per discovery

---

## 📊 Impact Summary

| Solution | CryptoPanic Savings | CoinGecko Savings | Effort |
|----------|---------------------|-------------------|--------|
| Disable CryptoPanic | ✅ 100% (0 calls) | - | 🟢 5 min |
| Use Binance for prices | - | ✅ 90% | 🟢 10 min |
| Increase cache TTLs | ✅ 80% | ✅ 80% | 🟢 2 min |
| Top 50 instead of 100 | ✅ 50% | ✅ 50% | 🟢 1 min |
| Daily snapshot | ✅ 97% | ✅ 97% | 🟡 1 hour |

**Combined Impact:**
- **CryptoPanic:** 100 calls/month → **0 calls/month** ✅
- **CoinGecko:** 10,000 calls/month → **~100 calls/month** ✅

---

## Alternative Free APIs

### For News/Sentiment:
1. **CryptoCompare News** - 3000 calls/month FREE
   - https://www.cryptocompare.com/
2. **NewsAPI** - 100 calls/day FREE
   - https://newsapi.org/
3. **RSS Feeds** (Free, unlimited)
   - CoinDesk, CoinTelegraph, Decrypt

### For Price Data:
1. **Binance** - 1200/min FREE (no API key)
   - Already implemented ✅
2. **Coinbase** - 10,000/hour FREE
   - https://docs.cloud.coinbase.com/
3. **Kraken** - 15/sec FREE
   - https://docs.kraken.com/rest/

### For Market Data:
1. **CoinMarketCap** - 10,000/month FREE
   - https://coinmarketcap.com/api/
2. **Messari** - 20 calls/min FREE
   - https://messari.io/api

---

## Next Steps

1. ✅ Implement Step 1-4 (quick wins, ~20 minutes)
2. ✅ Test with `npm run discover`
3. ✅ Monitor API usage in logs
4. 📊 Optionally: Add CryptoCompare for news
5. 📊 Optionally: Implement daily snapshot

Let me know which solutions you want me to implement!
