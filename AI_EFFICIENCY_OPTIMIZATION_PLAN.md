# AI Efficiency & Cost Optimization Plan
**Crypto AI Trading Platform - Scheduled Job Optimization**

**Date:** November 4, 2025  
**Status:** Planning & Implementation  
**Priority:** High - Cost Reduction & Scalability

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Optimization Strategy](#optimization-strategy)
4. [Market Conditions Dashboard](#market-conditions-dashboard)
5. [Database Schema Changes](#database-schema-changes)
6. [Implementation Phases](#implementation-phases)
7. [Premium Features](#premium-features)
8. [Success Metrics](#success-metrics)

---

## Executive Summary

### Goals

1. **Eliminate per-user AI costs** for scheduled reviews
2. **Implement strategy-based global recommendations** (Conservative, Moderate, Aggressive)
3. **Maintain effective portfolio monitoring** for sell signals
4. **Add market conditions dashboard** for transparency
5. **Foundation for premium features** (continuous monitoring)

### Key Changes

- **BUY Recommendations**: Global, strategy-based (3 strategies × 3-5 coins = 9-15 AI calls per cycle)
- **SELL Recommendations**: User-specific, triggered by portfolio thresholds
- **Dynamic Intervals**: Adjust review frequency based on market volatility (future)
- **Market Dashboard**: Display current conditions and next review time
- **Data Retention**: 1-year expiry (was 24 hours) for training/analysis

---

## Current System Analysis

### ✅ What's Working

The system **already implements cost-efficient patterns**:

1. **Global Discovery**: Runs once, not per-user
2. **Limited AI Calls**: Only top 3 BUY + 3 SELL opportunities analyzed
3. **Caching**: Redis caching reduces API costs by 80-90%
4. **HOLD Filtering**: Discards non-actionable recommendations

### ❌ Issues Identified

#### 1. Recommendations Table Has `user_id` But Runs Globally

```typescript
// recommendationProcessor.ts - Line 16
async function storeRecommendation(recommendation: any): Promise<void> {
  await query(
    `INSERT INTO recommendations (
      symbol, action, confidence, entry_price, stop_loss,
      take_profit_1, take_profit_2, position_size, risk_level,
      reasoning, sources, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '24 hours')`,
    // ❌ Missing user_id in INSERT but table requires it
```

**Impact**: Recommendations can't be stored without user_id

#### 2. User Settings Not Used in Discovery

```typescript
// opportunityFinder.ts - Line 50
const settings = await getUserSettings();

// Determine discovery strategy (default to moderate if not set)
const discoveryStrategy: DiscoveryStrategy = 'moderate'; // ❌ Hard-coded, settings ignored
```

**Impact**: User preferences (Conservative/Moderate/Aggressive) not applied

#### 3. Portfolio Checks Are User-Specific

```typescript
// opportunityFinder.ts - Line 100
const portfolio = await getPortfolio(); // ❌ Gets specific user's portfolio
const existingSymbols = new Set(portfolio.positions.map(p => p.symbol));
```

**Impact**: BUY recommendations filtered by single user's holdings (should be global)

#### 4. SELL Opportunities Are Portfolio-Specific

```typescript
// opportunityFinder.ts - Line 156
async function findSellOpportunities(): Promise<SellOpportunity[]> {
  const portfolio = await getPortfolio(); // ✅ CORRECT - needs user portfolio
  
  for (const position of portfolio.positions) {
    const percentGain = ((currentPrice - entryPrice) / entryPrice) * 100;
    // Analyze exit signals based on user's actual positions
  }
}
```

**Impact**: SELL recommendations MUST remain user-specific (this is correct)

---

## Optimization Strategy

### Architecture: Split BUY vs SELL

```
┌─────────────────────────────────────────────────────────┐
│   GLOBAL: Discovery-Based BUY Recommendations           │
│   (Scheduled - Every 2 hours, adjustable)               │
│                                                          │
│   For each strategy (Conservative, Moderate, Aggressive):│
│     1. Run discovery (no portfolio needed)              │
│     2. Find top 3-5 opportunities                       │
│     3. AI analysis for BUY signals                      │
│     4. Store globally with strategy tag                 │
│                                                          │
│   Cost: 9-15 AI calls per run (3 strategies × 3-5)     │
│   Frequency: Dynamic based on market conditions         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│   PER-USER: Portfolio Monitoring SELL Recommendations   │
│   (Triggered by conditions OR user request)             │
│                                                          │
│   Triggers:                                             │
│     - User has active positions                         │
│     - Position P&L crosses thresholds (±10%, ±25%)     │
│     - High volatility detected in held coins            │
│     - User manually requests review                     │
│     - Premium: Continuous monitoring                    │
│                                                          │
│   Process:                                              │
│     1. Get user's portfolio                             │
│     2. Check each position for exit signals             │
│     3. AI analysis ONLY for flagged positions           │
│     4. Store user-specific SELL recommendations         │
│                                                          │
│   Cost: Variable, only for active users with positions  │
└─────────────────────────────────────────────────────────┘
```

### Cost Comparison

**Current (Broken) System:**
- Attempts to run per-user but fails due to missing user_id
- Would cost: N users × 6 AI calls = unsustainable

**Optimized System:**
- Global BUY: 9-15 AI calls per cycle (fixed cost)
- User SELL: Only when triggered (minimal cost)
- **Scales to unlimited users at fixed cost**

---

## Market Conditions Dashboard

### Display Location

**File**: `public/js/ui/recommendations.js` (Line ~201)

**Position**: Above recommendations list, in header area

### Market Conditions Interface

```typescript
interface MarketConditions {
  volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
  volumeChange: number;           // % change from 24h average
  priceMovements: number;         // % of top coins with >5% moves
  newsActivity: number;           // News articles per hour
  btcDominance: number;           // Bitcoin market dominance %
  marketRegime: 'bull' | 'bear' | 'sideways' | 'volatile';
  lastUpdated: Date;
}
```

### Calculation Logic (No AI Cost)

```typescript
async function calculateMarketConditions(): Promise<MarketConditions> {
  // Fetch from existing cached data (no new API calls)
  const topCoins = await getTopCoinsFromCache(10);
  const marketContext = await getMarketContext(); // Already cached
  
  // Calculate volatility
  const priceMovements = topCoins.filter(c => 
    Math.abs(c.priceChange24h) > 5
  ).length / topCoins.length * 100;
  
  // Calculate volume change
  const avgVolumeChange = topCoins.reduce((sum, c) => 
    sum + c.volumeChange24h, 0
  ) / topCoins.length;
  
  // Determine volatility level
  let volatilityLevel: 'low' | 'medium' | 'high' | 'extreme';
  if (priceMovements > 70 || avgVolumeChange > 100) {
    volatilityLevel = 'extreme';
  } else if (priceMovements > 50 || avgVolumeChange > 50) {
    volatilityLevel = 'high';
  } else if (priceMovements > 30 || avgVolumeChange > 25) {
    volatilityLevel = 'medium';
  } else {
    volatilityLevel = 'low';
  }
  
  return {
    volatilityLevel,
    volumeChange: avgVolumeChange,
    priceMovements,
    newsActivity: await getNewsActivityRate(),
    btcDominance: marketContext.btcDominance,
    marketRegime: marketContext.regime,
    lastUpdated: new Date()
  };
}
```

### Dynamic Review Interval

```typescript
function calculateReviewInterval(conditions: MarketConditions): number {
  // Base intervals (in minutes)
  const intervals = {
    extreme: 15,   // Every 15 minutes
    high: 30,      // Every 30 minutes
    medium: 60,    // Every hour
    low: 120       // Every 2 hours (default)
  };
  
  return intervals[conditions.volatilityLevel];
}

function getNextScheduledAnalysisTime(conditions: MarketConditions): Date {
  const lastRun = new Date(localStorage.getItem('lastAIAnalysisRun') || Date.now());
  const intervalMinutes = calculateReviewInterval(conditions);
  return new Date(lastRun.getTime() + intervalMinutes * 60 * 1000);
}
```

### UI Component

```html
<!-- Insert above recommendations list -->
<div class="market-conditions-banner" style="margin-bottom: 20px; padding: 15px; border-radius: 8px; background: var(--card-bg-secondary); border: 1px solid var(--border-color);">
  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
    
    <!-- Market Status -->
    <div style="flex: 1; min-width: 200px;">
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 5px;">Market Conditions</div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span id="volatility-indicator" class="badge badge-medium">Medium Volatility</span>
        <span id="regime-indicator" style="font-size: 13px; color: var(--text-secondary);">Sideways</span>
      </div>
    </div>
    
    <!-- Key Metrics -->
    <div style="display: flex; gap: 20px; flex-wrap: wrap;">
      <div>
        <div style="font-size: 11px; color: var(--text-muted);">Price Moves</div>
        <div id="price-movements" style="font-size: 16px; font-weight: 600; color: var(--text-primary);">35%</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--text-muted);">Volume Change</div>
        <div id="volume-change" style="font-size: 16px; font-weight: 600; color: var(--text-primary);">+42%</div>
      </div>
      <div>
        <div style="font-size: 11px; color: var(--text-muted);">BTC Dominance</div>
        <div id="btc-dominance" style="font-size: 16px; font-weight: 600; color: var(--text-primary);">54.2%</div>
      </div>
    </div>
    
    <!-- Next Review -->
    <div style="text-align: right; min-width: 150px;">
      <div style="font-size: 11px; color: var(--text-muted);">Next AI Review</div>
      <div id="next-review-time" style="font-size: 16px; font-weight: 600; color: var(--text-primary);">
        <span id="review-countdown">1h 23m</span>
      </div>
      <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">
        <span id="review-interval-reason">Standard interval</span>
      </div>
    </div>
    
  </div>
</div>
```

### Badge Styling

```css
.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge-low { background: var(--success-bg); color: var(--success-text); }
.badge-medium { background: var(--warning-bg); color: var(--warning-text); }
.badge-high { background: var(--danger-bg); color: var(--danger-text); }
.badge-extreme { background: #ff0000; color: white; animation: pulse 2s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## Database Schema Changes

### 1. Split Recommendations Table

```sql
-- Global BUY recommendations (discovery-based)
CREATE TABLE discovery_recommendations (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  strategy VARCHAR(20) NOT NULL,           -- 'conservative' | 'moderate' | 'aggressive'
  coin_universe VARCHAR(20) NOT NULL,      -- 'top10' | 'top50' | 'top100'
  confidence NUMERIC(5,2) NOT NULL,
  entry_price NUMERIC(20,8),
  stop_loss NUMERIC(20,8),
  take_profit_1 NUMERIC(20,8),
  take_profit_2 NUMERIC(20,8),
  position_size NUMERIC(5,4),
  risk_level VARCHAR(10),
  reasoning JSONB,
  sources TEXT[],
  discovery_score NUMERIC(5,2),            -- Original composite score
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 year',  -- Changed from 24 hours
  
  INDEX idx_strategy_universe (strategy, coin_universe, created_at DESC),
  INDEX idx_expires (expires_at)
);

-- User-specific SELL recommendations (portfolio monitoring)
CREATE TABLE portfolio_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  current_price NUMERIC(20,8),
  entry_price NUMERIC(20,8),
  stop_loss NUMERIC(20,8),
  take_profit_1 NUMERIC(20,8),
  take_profit_2 NUMERIC(20,8),
  unrealized_pnl NUMERIC(20,8),
  percent_gain NUMERIC(10,2),
  sell_reason VARCHAR(50),                 -- 'profit_target' | 'risk_management' | 'momentum_loss'
  reasoning JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 year',
  
  INDEX idx_user_active (user_id, expires_at),
  INDEX idx_user_symbol (user_id, symbol)
);

-- Market conditions log (for dashboard and analysis)
CREATE TABLE market_conditions_log (
  id SERIAL PRIMARY KEY,
  volatility_level VARCHAR(20) NOT NULL,   -- 'low' | 'medium' | 'high' | 'extreme'
  volume_change NUMERIC(10,2),
  price_movements NUMERIC(5,2),
  news_activity INTEGER,
  btc_dominance NUMERIC(5,2),
  market_regime VARCHAR(20),               -- 'bull' | 'bear' | 'sideways' | 'volatile'
  review_interval_minutes INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_created (created_at DESC)
);
```

### 2. Migration Strategy

```sql
-- Step 1: Create new tables
-- (Run CREATE TABLE statements above)

-- Step 2: Migrate existing recommendations
-- Assume all existing recommendations are "moderate" strategy
INSERT INTO discovery_recommendations (
  symbol, strategy, coin_universe, confidence, entry_price,
  stop_loss, take_profit_1, take_profit_2, position_size,
  risk_level, reasoning, sources, created_at
)
SELECT 
  symbol, 
  'moderate' as strategy,
  'top50' as coin_universe,
  confidence, 
  entry_price,
  stop_loss, 
  take_profit_1, 
  take_profit_2, 
  position_size,
  risk_level, 
  reasoning, 
  sources, 
  created_at
FROM recommendations
WHERE action = 'BUY' AND user_id IS NOT NULL;

-- Step 3: Keep old table for reference (optional)
-- ALTER TABLE recommendations RENAME TO recommendations_legacy;

-- Step 4: Update application code to use new tables
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1) - IN PROGRESS

**Goal**: Split BUY/SELL logic, fix current issues

#### Tasks

- [x] Create new database tables (`discovery_recommendations`, `portfolio_recommendations`, `market_conditions_log`)
  - Created migration: `003_ai_efficiency_optimization.sql`
  - Added tier column to users table
  - Extended expiry to 1 year for data retention
- [x] Create TypeScript type definitions
  - Created `src/types/recommendations.ts`
  - Reuses existing types from `UserSettings` to avoid duplication
- [x] Update `recommendationProcessor.ts`:
  - [x] Generate recommendations for all 3 strategies (conservative, moderate, aggressive)
  - [x] Store BUY in `discovery_recommendations` table
  - [x] Export `storePortfolioRecommendation()` for portfolio monitoring
  - [x] Remove user_id dependency for BUY recommendations
- [x] Update `opportunityFinder.ts`:
  - [x] Add strategy/coinUniverse parameters to `generateActionableRecommendations()`
  - [x] Add `skipPortfolioFilter` parameter to `findBuyOpportunities()`
  - [x] Keep `findSellOpportunities()` user-specific
  - [x] Pass strategy parameters through the call chain
- [x] Update API endpoints:
  - [x] `GET /api/recommendations` - Filter by user's strategy setting from `discovery_recommendations`
  - [x] `GET /api/recommendations/sell` - User-specific sell recommendations from `portfolio_recommendations`
  - [x] Added authentication middleware to both endpoints
  - [x] Proper error handling and logging
- [x] Run migration on database
  - Migration `20251104_0950_ai_efficiency_optimization.sql` executed successfully
  - New tables created: `discovery_recommendations`, `portfolio_recommendations`, `market_conditions_log`
  - `tier` and `tier_updated_at` columns added to `users` table
  - All indexes and constraints created
  - Migration uses timestamp-based naming for production compatibility
- [x] Test with multiple strategy settings
  - [x] Trigger recommendation job manually
  - [x] Verify recommendations stored in new tables (architecture working correctly)
  - [x] Test API endpoints with different user strategies
  - [x] Verify strategy filtering works correctly
  - [x] Added automatic price data population on startup (`src/utils/startup.ts`)
  - [x] System correctly identifies market regime (bear market detected)
  - [x] AI making appropriate conservative decisions in current market conditions

**Deliverables:**
- Global BUY recommendations working for all strategies
- User-specific SELL recommendations working
- No per-user AI costs for scheduled reviews

**Implementation Notes:**
- Avoided creating duplicate service files - modified existing `recommendationProcessor.ts` instead
- Reused types from `UserSettings` to maintain single source of truth
- `storePortfolioRecommendation()` exported for future portfolio monitoring service
- Automatic price data population added to startup sequence
- Migration strategy established: timestamp-based naming (`YYYYMMDD_HHMM_description.sql`)
- Test scripts organized in `/tests/` directory, operational scripts in `/scripts/`

**Phase 1 Status:** ✅ **COMPLETE** (November 4, 2025)

**Key Achievements:**
1. ✅ Database schema updated with new tables and tier system
2. ✅ Multi-strategy recommendation generation (Conservative, Moderate, Aggressive)
3. ✅ Global BUY recommendations (no per-user AI costs)
4. ✅ User-specific SELL recommendations architecture
5. ✅ API endpoints with strategy filtering
6. ✅ Automatic historical data population on startup
7. ✅ Market regime detection working correctly
8. ✅ Production-ready migration strategy established

**Deployment Notes:**
- On first startup, system automatically populates 90 days of BTC/ETH price history
- Subsequent startups check for recent data and only update if needed (< 2 days old)
- No manual intervention required for production deployment

---

### Phase 2: Market Conditions Dashboard (Week 1-2)

**Goal**: Add transparency and dynamic interval foundation

#### Tasks

- [x] Create `marketConditionsService.ts`:
  - [x] `calculateMarketConditions()` function
  - [x] `calculateReviewInterval()` function
  - [x] `logMarketConditions()` to database
  - [x] `getLatestMarketConditions()` for caching
  - [x] `calculateVolatility()` from BTC price data
- [x] Create API endpoint `GET /api/market/conditions`
  - [x] 5-minute caching to reduce database load
  - [x] Automatic logging to `market_conditions_log` table
- [x] Update `recommendations.js`:
  - [x] Add market conditions banner component
  - [x] Fetch and display current conditions
  - [x] Display market regime, volatility, risk sentiment, BTC dominance
  - [x] Show recommended review interval with reasoning
  - [x] Color-coded indicators for quick visual assessment
- [x] Update `index.html` with market conditions banner
- [x] Integrate into main.js initialization
- [x] Log market conditions on each API call

**Deliverables:**
- Market conditions visible on dashboard
- Next review time dynamically calculated
- Foundation for dynamic intervals (not yet active)

**Phase 2 Status:** ✅ **COMPLETE** (November 4, 2025)

**Key Achievements:**
1. ✅ Market conditions service with intelligent interval calculation
2. ✅ Volatility calculation from 7-day BTC price data
3. ✅ Dynamic review interval recommendations (6-24 hours based on conditions)
4. ✅ API endpoint with 5-minute caching
5. ✅ Beautiful UI dashboard with color-coded indicators
6. ✅ Automatic logging to database for historical tracking
7. ✅ Reasoning displayed to users for transparency

**Implementation Notes:**
- Interval logic: 1-4 hours (never 24h), baseline 2h
- Bull+High Vol=1h, Bear+Medium Vol=2h, Sideways+Low Vol=4h
- Risk-off sentiment extends intervals (more cautious, max 4h)
- Risk-on sentiment in bull markets shortens intervals (more aggressive, min 1h)
- **Smart Execution Implemented:** Cron runs every 2h but checks conditions and skips if not time yet
- Job processor checks last run time vs recommended interval before executing

---

### Phase 3: Portfolio Monitoring (Week 2-3)

**Goal**: Implement triggered SELL recommendations

#### Tasks

- [ ] Update `positionMonitor.ts`:
  - [ ] Check portfolio positions every 5 minutes
  - [ ] Detect threshold crossings (±10%, ±25%, ±50%)
  - [ ] Detect high volatility in held coins
  - [ ] Trigger AI analysis for flagged positions
- [ ] Create `portfolioAnalysisService.ts`:
  - [ ] `analyzePositionForExit(userId, symbol)` function
  - [ ] Store in `portfolio_recommendations` table
- [ ] Add API endpoints:
  - [ ] `POST /api/portfolio/analyze` - Manual trigger
  - [ ] `GET /api/portfolio/recommendations` - Get user's sell recommendations
- [ ] Update UI to show sell recommendations separately
- [ ] Add "Analyze My Portfolio" button (rate limited: 3/day for free tier)

**Deliverables:**
- Automatic SELL recommendations when thresholds crossed
- Manual portfolio analysis available
- User-specific exit signals working

---

### Phase 4: Premium Features (Week 3-4)

**Goal**: Foundation for monetization

#### Tasks

- [ ] Create `user_tiers` table:
  ```sql
  CREATE TABLE user_tiers (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    tier VARCHAR(20) DEFAULT 'free',  -- 'free' | 'premium'
    portfolio_monitoring BOOLEAN DEFAULT false,
    on_demand_limit INTEGER DEFAULT 3,
    custom_alerts BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Implement tier checking in portfolio monitor
- [ ] Add continuous monitoring for premium users
- [ ] Create account upgrade UI
- [ ] Add usage tracking for free tier limits
- [ ] Create admin panel for tier management

**Deliverables:**
- Free tier: View global recommendations, basic monitoring, 3 manual analyses/day
- Premium tier: Continuous monitoring, unlimited analyses, custom alerts

---

### Phase 5: Dynamic Intervals (Future)

**Goal**: Optimize review frequency based on market activity

#### Tasks

- [ ] Update scheduler to use dynamic intervals
- [ ] Implement interval adjustment logic
- [ ] Add safety limits (min 15 min, max 4 hours)
- [ ] Monitor cost impact
- [ ] Add user notification when interval changes
- [ ] Create analytics dashboard for interval effectiveness

**Deliverables:**
- Reviews run more frequently during high volatility
- Cost stays controlled during quiet periods
- Users informed of system responsiveness

---

## Premium Features

### Tier Structure

#### Free Tier
- ✅ View global BUY recommendations (filtered by strategy)
- ✅ Basic portfolio monitoring (threshold alerts)
- ✅ Manual "Analyze My Portfolio" (rate limited: 3/day)
- ✅ Market conditions dashboard
- ✅ Standard review intervals

#### Premium Tier ($19.99/month)
- ✅ All Free tier features
- ✅ Continuous portfolio monitoring
- ✅ AI-powered SELL recommendations included in global cycle
- ✅ Unlimited on-demand analysis
- ✅ Custom alert thresholds
- ✅ Position-specific AI insights
- ✅ Priority during high-volatility periods
- ✅ Email/SMS notifications
- ✅ Advanced analytics

### Implementation

```typescript
interface UserTier {
  tier: 'free' | 'premium';
  portfolioMonitoring: boolean;
  onDemandLimit: number;
  customAlerts: boolean;
}

async function shouldRunPortfolioAnalysis(userId: number): Promise<boolean> {
  const user = await getUserTier(userId);
  const portfolio = await getPortfolio(userId);
  
  // No positions = no analysis needed
  if (portfolio.positions.length === 0) return false;
  
  // Premium users: Always include in global cycle
  if (user.tier === 'premium') return true;
  
  // Free users: Only on threshold triggers or manual request
  const hasThresholdTrigger = await checkThresholdTriggers(userId);
  return hasThresholdTrigger;
}
```

---

## Success Metrics

### Cost Efficiency

**Target**: Fixed AI cost regardless of user count

- **Current (broken)**: Would be N users × 6 calls = unsustainable
- **Optimized**: 9-15 calls per cycle + triggered SELL calls
- **Scaling**: 1,000 users = same cost as 10 users

### User Value

- **Recommendation Freshness**: Updated every 15 min to 2 hours (dynamic)
- **Portfolio Monitoring**: Real-time threshold detection
- **Transparency**: Market conditions visible
- **Personalization**: Strategy-based filtering

### Technical Performance

- **Review Cycle Time**: < 2 minutes for 9-15 coins
- **Dashboard Load Time**: < 500ms
- **Market Conditions Update**: Every 30 seconds
- **Database Query Time**: < 100ms for recommendations

### Business Metrics

- **Free Tier Conversion**: Target 5% to premium
- **Premium Retention**: Target 80% monthly
- **Cost per User**: < $0.10/month (AI costs)
- **Revenue per Premium User**: $19.99/month

---

## Risk Mitigation

### Technical Risks

1. **AI Provider Outage**
   - Mitigation: Fallback to local rule-based recommendations
   - Impact: Reduced quality but system continues

2. **Database Performance**
   - Mitigation: Proper indexing, query optimization
   - Monitoring: Track query times, add alerts

3. **Market Conditions Calculation Failure**
   - Mitigation: Default to 2-hour interval
   - Fallback: Use last known conditions

### Business Risks

1. **User Confusion** (global vs personal recommendations)
   - Mitigation: Clear UI labels, tooltips, help section
   - Education: Onboarding guide explaining system

2. **Premium Adoption**
   - Mitigation: Free tier provides value, premium adds convenience
   - Strategy: 30-day free trial for premium

3. **Cost Overrun** (too many triggered analyses)
   - Mitigation: Rate limiting, threshold tuning
   - Monitoring: Track AI call volume, add alerts

---

## Next Steps

1. **Review and approve** this plan
2. **Prioritize phases** based on business needs
3. **Begin Phase 1** implementation
4. **Set up monitoring** for cost and performance
5. **Create user documentation** for new features

---

**Document Status**: Active Plan  
**Owner**: Development Team  
**Review Frequency**: Weekly during implementation  
**Last Updated**: November 4, 2025
