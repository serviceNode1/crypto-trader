# Discovery & AI System Documentation

**Crypto AI Trading Intelligence System**  
**Last Updated:** October 27, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Pipeline](#complete-pipeline)
3. [Discovery System](#discovery-system)
4. [Opportunity Finder](#opportunity-finder)
5. [AI Recommendation Engine](#ai-recommendation-engine)
6. [Strategy Configurations](#strategy-configurations)
7. [Scoring Algorithms](#scoring-algorithms)
8. [Tuning Guide](#tuning-guide)

---

## Overview

### The Three-Stage Pipeline

```
Stage 1: DISCOVERY (Free, Fast, Broad)
  └─> Scans top N coins → Filters locally → Scores 0-100 → Stores candidates

Stage 2: OPPORTUNITY IDENTIFICATION (Free, Fast, Focused)
  └─> BUY: Candidates NOT in portfolio
  └─> SELL: Positions IN portfolio with exit signals

Stage 3: AI ANALYSIS (Paid, Slow, Deep)
  └─> Top 3 buy + 3 sell → Full analysis → AI verdict → Store BUY/SELL only
```

### Key Principles

1. **Cost Efficiency**: Discovery filters 90% locally before expensive AI
2. **Portfolio Awareness**: Separate buy (new) from sell (exit) opportunities
3. **Actionable Only**: Discard HOLD recommendations
4. **Configurable**: Conservative/moderate/aggressive strategies
5. **Cacheable**: Reuse discovery results to avoid redundant scans

---

## Complete Pipeline

### Execution Flow

**Trigger:** Every 2 hours (default) or manual API call

```
1. coinDiscovery.discoverCoins()
   ├─> Fetch top N coins from CoinGecko
   ├─> Apply filters (market cap, volume, price change)
   ├─> Calculate scores: volume, momentum, sentiment
   ├─> Calculate composite score (weighted average)
   ├─> Store candidates where score > threshold
   └─> Return sorted candidates

2. opportunityFinder.findOpportunities()
   ├─> Get user portfolio
   ├─> findBuyOpportunities(): Filter NOT owned, classify urgency
   ├─> findSellOpportunities(): Check profit/loss thresholds
   └─> Return { buyOpportunities, sellOpportunities }

3. generateActionableRecommendations(maxBuy=3, maxSell=3)
   ├─> Take top opportunities
   ├─> For each: Fetch price, candles, news, reddit, market context
   ├─> Calculate indicators, sentiment
   ├─> Send to AI with full context
   ├─> Parse response: Store BUY/SELL, discard HOLD
   └─> Return recommendations + metadata

4. Log results to ai_review_logs
```

**Timing Example:** ~95 seconds for 6 coins analyzed

---

## Discovery System

**Location:** `src/services/discovery/coinDiscovery.ts`

### Function Signature

```typescript
export async function discoverCoins(
  universe: 'top10' | 'top25' | 'top50' | 'top100',
  strategy: 'conservative' | 'moderate' | 'aggressive' | 'debug',
  forceRefresh: boolean = false
): Promise<DiscoveryResult>
```

### Universe Sizes

- **top10**: Ultra-safe, major coins only (BTC, ETH, BNB)
- **top25**: Balanced, established projects (recommended)
- **top50**: Mid-caps included, more opportunities
- **top100**: Small-caps, higher risk/reward

### Process

1. **Fetch** top N coins from CoinGecko
2. **Filter** by strategy criteria (market cap, volume, price changes)
3. **Score** each coin (volume, momentum, sentiment)
4. **Calculate** composite score (weighted average)
5. **Store** candidates above threshold in database

---

## Opportunity Finder

**Location:** `src/services/discovery/opportunityFinder.ts`

### Buy Opportunities

**Logic:** Find high-scoring coins NOT in your portfolio

```typescript
// Classify by pattern
if (momentumScore > 70 && volumeScore > 70) {
  reason = 'breakout', urgency = 'high'
} else if (momentumScore < 40 && compositeScore > 65) {
  reason = 'dip', urgency = 'medium'  // Buy the dip
} else if (compositeScore > 75) {
  reason = 'discovery', urgency = 'high'
}
```

**Types:**
- **Breakout**: High momentum + volume (urgent)
- **Dip**: Temporarily down but strong fundamentals
- **Discovery**: Newly found candidate

### Sell Opportunities

**Logic:** Analyze positions for exit signals

```typescript
if (percentGain > 25) {
  reason = 'profit_target', urgency = (>50% ? 'high' : 'medium')
} else if (percentGain < -10 && percentGain > -20) {
  reason = 'risk_management', urgency = 'medium'
} else if (percentGain < -20) {
  reason = 'risk_management', urgency = 'high'  // Cut losses
} else if (percentGain > 10) {
  reason = 'resistance', urgency = 'low'  // Check momentum
}
```

---

## AI Recommendation Engine

**Location:** `src/services/ai/aiService.ts`

### Providers

- **Primary:** Anthropic Claude Haiku (cost-effective)
- **Fallback:** OpenAI GPT-4o-mini
- **Emergency:** Local rule-based

### Input Data Package

```typescript
{
  symbol, currentPrice,
  technicalIndicators: { rsi, macd, bollingerBands, sma20, sma50, ema12, ema26, volume },
  sentiment: { overall, reddit, news, mentionVolume, velocity },
  news: [20 recent articles],
  marketContext: { btcDominance, marketRegime, riskSentiment, volatilityIndex, traditionalMarkets }
}
```

### Prompt Structure

**System:**
```
You are a professional crypto analyst. Respond in JSON:
{
  "action": "BUY" | "SELL" | "HOLD",
  "confidence": 0-100,
  "entryPrice": number,
  "stopLoss": number,
  "takeProfitLevels": [number, number],
  "positionSize": 0.01-0.05,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": { technical, sentiment, marketContext, risk }
}

Be conservative: Only BUY/SELL if confidence > 60%
```

**User:** Full context with current price, indicators, sentiment, news, market regime

### Response Handling

```typescript
const recommendation = parseAIResponse(aiResponse);

// Only store actionable recommendations
if (recommendation.action === 'HOLD') {
  logger.info('AI recommended HOLD, discarding');
  return null;
}

// Store BUY/SELL in database
await storeRecommendation(recommendation);
return recommendation;
```

---

## Strategy Configurations

### Conservative

**Target:** Safe, established coins, high liquidity

```typescript
{
  filters: {
    minMarketCap: 100_000_000,    // $100M
    minVolume24h: 10_000_000,     // $10M
    minVolumeChange: 1.1,         // 10% increase
    minPriceChange7d: -15,
    maxPriceChange7d: 100,
  },
  weights: { volume: 0.25, momentum: 0.35, sentiment: 0.40 },
  threshold: 70
}
```

**Best For:** Risk-averse, swing trading  
**Expected:** 3-5 candidates, 55-60% win rate, 8-15% avg gain

### Moderate (Default)

**Target:** Balanced mix of established and emerging

```typescript
{
  filters: {
    minMarketCap: 50_000_000,     // $50M
    minVolume24h: 2_000_000,      // $2M
    minVolumeChange: 1.3,         // 30% increase
    minPriceChange7d: -25,
    maxPriceChange7d: 200,
  },
  weights: { volume: 0.30, momentum: 0.40, sentiment: 0.30 },
  threshold: 65
}
```

**Best For:** Most users, standard risk  
**Expected:** 5-10 candidates, 50-55% win rate, 10-20% avg gain

### Aggressive

**Target:** High-risk momentum plays

```typescript
{
  filters: {
    minMarketCap: 10_000_000,     // $10M (small-caps)
    minVolume24h: 500_000,        // $500K
    minVolumeChange: 1.5,         // 50% spike
    minPriceChange7d: -30,
    maxPriceChange7d: 500,
  },
  weights: { volume: 0.35, momentum: 0.45, sentiment: 0.20 },
  threshold: 60
}
```

**Best For:** Experienced traders, short-term  
**Expected:** 10-20 candidates, 45-50% win rate, 20-50% avg gain

### Debug

**Target:** Testing only - extremely liberal filters

```typescript
{
  filters: { minMarketCap: 1_000_000, minVolume24h: 100_000, ... },
  weights: { volume: 0.33, momentum: 0.33, sentiment: 0.34 },
  threshold: 40
}
```

**⚠️ WARNING:** Only for testing auto-trading!

---

## Scoring Algorithms

### Volume Score

**Formula:** Logarithmic scale where 10x minimum volume = 100

```typescript
volumeScore = min(100, (log10(volume / minVolume) / log10(10)) * 100)
```

**Example:** $2M min → $5M = 40, $10M = 70, $20M = 100

### Momentum Score

**Formula:** Weighted combination of 24h (40%) and 7d (60%) price changes

```typescript
momentum24h = (priceChange24h + 30) / 60 * 100  // Normalize -30% to +30%
momentum7d = (priceChange7d + 50) / 100 * 100   // Normalize -50% to +50%
momentumScore = momentum24h * 0.4 + momentum7d * 0.6
```

### Sentiment Score

**Sources:** Reddit posts + news articles  
**Method:** NLP analysis with `natural` + `sentiment` libraries  
**Output:** -1 to +1 converted to 0-100 scale

### Composite Score

```typescript
compositeScore = 
  volumeScore * weights.volume +
  momentumScore * weights.momentum +
  sentimentScore * weights.sentiment
```

---

## Tuning Guide

### Problem: Too Few Candidates

**Solutions:**
1. Lower threshold: `65` → `60`
2. Expand universe: `top25` → `top50`
3. Use aggressive strategy
4. Check `analysisLog` for rejection reasons

### Problem: Too Many Low-Quality Candidates

**Solutions:**
1. Raise threshold: `65` → `75`
2. Increase minimums: `minMarketCap: 100_000_000`, `minVolume24h: 5_000_000`
3. Use conservative strategy

### Problem: Missing Emerging Trends

**Solutions:**
1. Increase momentum weight: `{ momentum: 0.50, ... }`
2. Lower `minVolumeChange`: `1.2`
3. Use `top50` or `top100` universe

### Problem: AI Too Conservative (Mostly HOLD)

**Solutions:**
1. Use `debugMode: true` in `generateActionableRecommendations()`
2. Adjust prompt: "confidence > 55%" instead of 60%
3. Try different AI provider

### Problem: Too Many False Signals

**Solutions:**
1. Filter by confidence: only store if > 70%
2. Add pre-AI filters
3. Require multi-AI consensus

### Optimization by Goal

**Maximize Win Rate:**
```typescript
strategy: 'conservative', universe: 'top25', threshold: 75, minConfidence: 70
```

**Maximize Total Return:**
```typescript
strategy: 'moderate', universe: 'top50', threshold: 65, minConfidence: 60
```

**Find Hidden Gems:**
```typescript
strategy: 'aggressive', universe: 'top100', threshold: 60, focus on momentum spikes
```

---

## Performance Tips

### Caching
- Discovery results: 2 hours
- Price data: 60 seconds
- Sentiment: 15 minutes
- News: 30 minutes

### API Cost Reduction
- Run discovery less frequently: `CRON_RECOMMENDATIONS=0 */4 * * *` (every 4h)
- Reduce `maxBuy` and `maxSell` to 2 each
- Use local sentiment first, AI only for top candidates

### Monitoring
- Check `ai_review_logs` table for success rate
- Review `analysisLog` in discovery results
- Track win rate vs strategy in `trades` table

---

## Debug Mode

**Enable:** Set `debugMode: true` when calling `generateActionableRecommendations()`

**Changes:**
- AI uses aggressive prompts
- Lower confidence threshold (50% vs 60%)
- Logs more verbose output
- Useful for testing auto-trading

**⚠️ Do NOT use in production with real money!**

---

## Next Steps

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview
- **API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md) for endpoints
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup

---

**Document Status**: Complete  
**Maintained By**: Development Team  
**Review Frequency**: After strategy changes or performance issues
