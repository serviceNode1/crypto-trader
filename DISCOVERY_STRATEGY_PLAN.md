# 🎯 Discovery Strategy Feature Plan

**Goal:** Allow users to choose risk/reward profile for coin discovery

---

## 📊 Strategy Options

### **1. Conservative (Low Risk, Steady Growth)**

**Target User:** New traders, risk-averse investors, portfolio majority  
**Philosophy:** Trade established coins with high liquidity and proven track records

**Filters:**
```typescript
{
  minMarketCap: 100_000_000,     // $100M minimum (established projects)
  maxMarketCap: undefined,        // No limit (include BTC, ETH)
  minVolume24h: 10_000_000,       // $10M daily volume (high liquidity)
  minVolumeChange: 1.1,           // 10% volume increase (steady activity)
  minPriceChange7d: -15,          // Not crashing severely
  maxPriceChange7d: 100,          // Max 2x in a week (avoid extreme pumps)
}
```

**Scoring Weights:**
- Volume Score: 25%
- Momentum Score: 30%
- Sentiment Score: 25%
- Market Cap Stability: 20%

**Composite Score Threshold:** 70/100

**Expected Results:**
- Top 10-15 coins by market cap
- BTC, ETH, BNB, SOL, ADA type coins
- Lower volatility (3-10% daily moves)
- Higher success rate (70-80% wins)
- Lower potential gains (20-50% per trade)

---

### **2. Moderate (Balanced Risk/Reward)**

**Target User:** Intermediate traders, balanced portfolios  
**Philosophy:** Mix of established and emerging coins with growth potential

**Filters:**
```typescript
{
  minMarketCap: 50_000_000,      // $50M minimum (mid-caps included)
  maxMarketCap: undefined,        // No limit
  minVolume24h: 2_000_000,        // $2M daily volume (decent liquidity)
  minVolumeChange: 1.3,           // 30% volume increase (notable activity)
  minPriceChange7d: -25,          // Tolerates deeper pullbacks
  maxPriceChange7d: 200,          // Max 3x in a week
}
```

**Scoring Weights:**
- Volume Score: 30%
- Momentum Score: 35%
- Sentiment Score: 25%
- Market Cap Growth: 10%

**Composite Score Threshold:** 65/100

**Expected Results:**
- Top 15-30 coins
- Mix of blue chips and growth plays
- Moderate volatility (5-15% daily moves)
- Moderate success rate (60-70% wins)
- Moderate potential gains (30-100% per trade)

---

### **3. Aggressive (High Risk, Moonshot Potential)**

**Target User:** Experienced traders, speculation allocation  
**Philosophy:** Find emerging trends and high-momentum plays early

**Filters:**
```typescript
{
  minMarketCap: 10_000_000,      // $10M minimum (small-caps OK)
  maxMarketCap: undefined,        // No limit
  minVolume24h: 500_000,          // $500K daily volume (can trade it)
  minVolumeChange: 1.5,           // 50% volume increase (breakout signal)
  minPriceChange7d: -30,          // Tolerates volatility
  maxPriceChange7d: 500,          // Max 6x in a week (don't exclude winners)
}
```

**Scoring Weights:**
- Volume Score: 35%
- Momentum Score: 40%
- Sentiment Score: 20%
- Breakout Potential: 5%

**Composite Score Threshold:** 60/100

**Expected Results:**
- Top 30-50 coins (broader universe)
- Small-caps, new trends, DeFi plays
- High volatility (10-50% daily moves)
- Lower success rate (40-50% wins)
- Higher potential gains (100-1000% per trade)
- Higher risk of loss (rugpulls, dumps)

---

## 🔄 Implementation Plan

### **Phase 1: Backend - Discovery Service**

**File:** `src/services/discovery/coinDiscovery.ts`

1. Define strategy types:
```typescript
export type DiscoveryStrategy = 'conservative' | 'moderate' | 'aggressive';
```

2. Define strategy configurations:
```typescript
const STRATEGY_CONFIGS: Record<DiscoveryStrategy, {
  filters: DiscoveryFilters;
  weights: ScoreWeights;
  threshold: number;
}> = { ... }
```

3. Update `discoverCoins()` to accept strategy:
```typescript
export async function discoverCoins(
  universe: 'top10' | 'top25' | 'top50' | 'top100',
  strategy: DiscoveryStrategy = 'moderate',
  forceRefresh: boolean = false
): Promise<DiscoveryResult>
```

---

### **Phase 2: Database - Settings**

**File:** `src/migrations/004_add_discovery_strategy.sql`

```sql
ALTER TABLE user_settings
  ADD COLUMN discovery_strategy VARCHAR(20) DEFAULT 'moderate'
    CHECK (discovery_strategy IN ('conservative', 'moderate', 'aggressive'));
```

---

### **Phase 3: API - Routes**

**File:** `src/api/routes.ts`

Update `/api/discover` endpoint:
```typescript
router.get('/discover', async (req: Request, res: Response) => {
  const strategy = req.query.strategy as DiscoveryStrategy || 
                   settings.discoveryStrategy || 
                   'moderate';
  // ...
});
```

---

### **Phase 4: Frontend - UI**

**File:** `public/index.html`

1. **Settings Modal:** Add discovery strategy dropdown
```html
<select id="discoveryStrategy">
  <option value="conservative">🛡️ Conservative - Safe & Steady</option>
  <option value="moderate">⚖️ Moderate - Balanced Growth</option>
  <option value="aggressive">🚀 Aggressive - High Risk/Reward</option>
</select>
```

2. **Discovery Section:** Show active strategy
```html
<span>Strategy: <strong id="activeStrategy">Moderate</strong></span>
```

3. **Settings Help Text:** Explain each strategy

---

### **Phase 5: Coin Universe - Add top100**

1. **Backend:** Update type definition
```typescript
universe: 'top10' | 'top25' | 'top50' | 'top100'
```

2. **Frontend:** Add to settings dropdown
```html
<option value="top100">Top 100 - Include mid-caps</option>
```

3. **Discovery Logic:** Handle top100
```typescript
const limit = universe === 'top10' ? 10 
            : universe === 'top25' ? 25 
            : universe === 'top50' ? 50 
            : 100;
```

---

## 📈 Scoring System Updates

### **Current Composite Score:**
```typescript
compositeScore = (volumeScore + momentumScore + sentimentScore) / 3
```

### **Strategy-Weighted Composite Score:**
```typescript
compositeScore = 
  (volumeScore * weights.volume) +
  (momentumScore * weights.momentum) +
  (sentimentScore * weights.sentiment) +
  (marketCapScore * weights.marketCap)
```

**New Market Cap Score:**
- Conservative: Higher score for large caps (stability)
- Aggressive: Higher score for small caps (growth potential)

```typescript
function calculateMarketCapScore(marketCap: number, strategy: DiscoveryStrategy): number {
  if (strategy === 'conservative') {
    // Prefer $1B+ market cap
    if (marketCap > 1_000_000_000) return 100;
    if (marketCap > 500_000_000) return 80;
    return 50;
  }
  
  if (strategy === 'aggressive') {
    // Prefer $10M-$500M market cap (room to grow)
    if (marketCap < 100_000_000) return 100;
    if (marketCap < 500_000_000) return 80;
    return 50;
  }
  
  // Moderate: no strong preference
  return 75;
}
```

---

## 🎨 UI/UX Design

### **Settings Modal:**
```
┌─────────────────────────────────────────────┐
│ 🎯 Discovery Strategy                       │
├─────────────────────────────────────────────┤
│                                             │
│ [ Dropdown: Moderate ▼ ]                   │
│                                             │
│ ℹ️ Strategy Details:                        │
│                                             │
│ Moderate (Balanced Growth)                  │
│ • Min Market Cap: $50M                      │
│ • Min Volume: $2M daily                     │
│ • Focus: Mix of established + emerging      │
│ • Risk Level: Medium                        │
│ • Expected Win Rate: 60-70%                 │
│                                             │
└─────────────────────────────────────────────┘
```

### **Discovery Section:**
```
┌─────────────────────────────────────────────┐
│ 🔍 Discovered Opportunities                 │
│                                             │
│ Universe: Top 25  Strategy: Moderate        │
│ [ ] Force Refresh    [Run Discovery]       │
└─────────────────────────────────────────────┘
```

---

## ✅ Testing Plan

### **Test Cases:**

1. **Conservative Strategy:**
   - Expect mostly top 10 coins (BTC, ETH, etc.)
   - No micro-caps in results
   - High liquidity only

2. **Moderate Strategy:**
   - Mix of large and mid caps
   - Some top 20-50 coins

3. **Aggressive Strategy:**
   - Include small caps
   - More volatile coins
   - Higher composite scores for momentum

4. **Strategy Persistence:**
   - Save selection in settings
   - Load on page refresh
   - Apply to discovery runs

5. **Top 100 Universe:**
   - Fetches 100 coins from CoinGecko
   - Filters correctly
   - Performance acceptable (<5s)

---

## 📊 Success Metrics

**After Implementation:**

- [ ] Users can select strategy in settings
- [ ] Strategy persists across sessions
- [ ] Discovery results match strategy profile
- [ ] Top 100 option available
- [ ] Execution time <5s for top100 with aggressive strategy
- [ ] Clear UI feedback about active strategy

**Quality Metrics:**

- Conservative: 70%+ composite scores, 90%+ top 15 coins
- Moderate: 65%+ composite scores, 60% top 15, 40% top 50
- Aggressive: 60%+ composite scores, 30% top 15, 70% others

---

## 🚀 Rollout Plan

1. **Implement backend strategy logic** (1-2 hours)
2. **Add database migration** (15 min)
3. **Update API routes** (30 min)
4. **Add frontend UI** (1 hour)
5. **Add top100 option** (30 min)
6. **Test all combinations** (1 hour)
7. **Update documentation** (30 min)

**Total Estimated Time:** 4-5 hours

---

## 💡 Future Enhancements

1. **Custom Strategy Builder**
   - Let users define their own filters
   - Save multiple custom strategies
   - Share strategies with community

2. **Strategy Performance Tracking**
   - Track win rate per strategy
   - Show historical performance
   - Recommend best strategy for market conditions

3. **Dynamic Strategy**
   - Auto-adjust based on market regime
   - Conservative in bear markets
   - Aggressive in bull markets

4. **A/B Testing**
   - Run multiple strategies simultaneously
   - Compare results
   - Find optimal configuration

---

*Plan Created: October 9, 2025*  
*Status: ✅ IMPLEMENTED*  
*Implementation Date: October 9, 2025*

---

## ✅ Implementation Complete

All core features have been implemented:

- [x] Backend strategy logic with 3 strategies (conservative/moderate/aggressive)
- [x] Strategy-specific filters and scoring weights
- [x] API route updated to accept strategy parameter
- [x] Frontend UI with dropdown selectors
- [x] Top 100 coin universe option added
- [x] Settings persistence in localStorage

**Try it now:** Select different strategies in the discovery section and see how results change!
