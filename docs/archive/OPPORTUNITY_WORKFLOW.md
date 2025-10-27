# 🎯 Intelligent Opportunity-Based Trading Workflow

## Overview

The new trading workflow implements a **smart discovery → filter → AI analysis** pipeline that eliminates useless "HOLD" recommendations and focuses only on **actionable BUY and SELL opportunities**.

---

## 🔄 Workflow Steps

### **1. Discovery Search (Scheduled)**
**Runs:** Every 4 hours (configurable via `CRON_RECOMMENDATIONS`)

- Fetches top coins based on user's `coinUniverse` setting (Top 10/25/50/100)
- Applies local filters based on `discoveryStrategy` (Conservative/Moderate/Aggressive)
- Calculates composite scores from:
  - Volume score (unusual trading volume)
  - Momentum score (recent price movement)
  - Sentiment score (news & social media)

**Output:** Filtered list of candidates with scores stored in `discovered_coins` table

---

### **2. Opportunity Identification (Pre-AI Filter)**

#### **Buy Opportunities:**
- **Criteria:** Coins from discovery list **NOT** in portfolio
- **Reasons tracked:**
  - `breakout`: High momentum + high volume
  - `dip`: Recent pullback with good fundamentals
  - `discovery`: Strong composite score
- **Urgency levels:** High / Medium / Low

#### **Sell Opportunities:**
- **Criteria:** Coins **IN** portfolio meeting exit signals
- **Reasons tracked:**
  - `profit_target`: Gain > 25% (consider taking profits)
  - `risk_management`: Loss > 10% (prevent further loss)
  - `resistance`: Moderate profit at resistance level
- **Includes:** Current price, entry price, P&L, % gain

---

### **3. AI Analysis (Top Candidates Only)**

**Efficient API Usage:**
- Only analyzes top 3 buy + top 3 sell opportunities (configurable)
- Skips lower-priority opportunities (saved API costs)
- Requests AI to evaluate specific action (BUY or SELL)

**AI filters out non-actionable:**
- If AI recommends "HOLD" → Not stored
- If AI confirms BUY → Stored as buy recommendation
- If AI confirms SELL → Stored as sell recommendation

---

### **4. Actionable Recommendations**

**Stored in `recommendations` table:**
- Action: "BUY" or "SELL" only (no HOLD)
- Confidence: AI confidence level (0-100%)
- Entry price, stop loss, take profit levels
- Position sizing suggestion
- Risk level assessment
- Reasoning and key factors

**Expires:** After 24 hours (recommendations are time-sensitive)

---

## 📊 Benefits Over Old System

| Old System | New System |
|------------|------------|
| Analyzed ALL symbols randomly | Analyzes only promising opportunities |
| Many "HOLD" recommendations | Only BUY/SELL recommendations |
| No pre-filtering | Local filters before AI |
| High API costs | 60-90% lower API usage |
| No portfolio context | Separate buy/sell logic |
| Generic analysis | Targeted opportunity analysis |

---

## 🔌 API Endpoints

### **GET /api/opportunities**
Find current buy and sell opportunities (pre-AI filter)

**Query params:**
- `forceRefresh=true`: Run fresh discovery scan

**Response:**
```json
{
  "buyOpportunities": [
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "reason": "breakout",
      "urgency": "high",
      "localScore": 78,
      "candidate": { ... }
    }
  ],
  "sellOpportunities": [
    {
      "symbol": "BTC",
      "reason": "profit_target",
      "urgency": "medium",
      "percentGain": 32.5,
      ...
    }
  ],
  "timestamp": "2025-10-12T22:48:00Z"
}
```

---

### **POST /api/recommendations/generate**
Generate AI recommendations for top opportunities

**Body:**
```json
{
  "maxBuy": 3,
  "maxSell": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 2 BUY and 1 SELL recommendations",
  "buyRecommendations": [ ... ],
  "sellRecommendations": [ ... ],
  "skipped": {
    "buy": 5,
    "sell": 2
  }
}
```

---

### **GET /api/recommendations**
Get current actionable recommendations (updated to filter HOLD)

**Query params:**
- `limit=10`: Max recommendations to return

**Response:** Array of BUY/SELL recommendations only

---

## ⚙️ Configuration

### **User Settings** (via Settings Modal)
- **Coin Universe:** Top 10/25/50/100 - Determines discovery scope
- **Discovery Strategy:** Conservative/Moderate/Aggressive - Affects filters and weights
- **Analysis Frequency:** How often discovery runs (1/4/8/24 hours)

### **Environment Variables**
```bash
# Recommendation schedule (default: every 4 hours)
CRON_RECOMMENDATIONS="0 */4 * * *"
```

---

## 🧪 Manual Testing

### **1. Find Opportunities Manually:**
```bash
curl http://localhost:3000/api/opportunities
```

### **2. Generate AI Recommendations:**
```bash
curl -X POST http://localhost:3000/api/opportunities/generate \
  -H "Content-Type: application/json" \
  -d '{"maxBuy": 3, "maxSell": 3}'
```

### **3. View Recommendations:**
```bash
curl http://localhost:3000/api/recommendations
```

---

## 📈 Expected Behavior

### **When Discovery Runs:**
1. ✅ Fetches top N coins by market cap
2. ✅ Applies local filters (free, fast)
3. ✅ Calculates scores and stores top candidates
4. ✅ Identifies buy opportunities (not in portfolio)
5. ✅ Identifies sell opportunities (in portfolio)
6. ✅ Sends top 3+3 to AI for confirmation
7. ✅ Stores only BUY/SELL recommendations
8. ❌ No HOLD recommendations stored

### **UI Display:**
- **Recent Recommendations:** Shows only BUY/SELL (no HOLD)
- **Action Buttons:** Quick execute or detailed analysis
- **Urgency Indicators:** High/Medium/Low priority
- **Discovery Score:** Pre-AI composite score
- **AI Confidence:** Post-AI confirmation level

---

## 🚀 Future Enhancements

### **Planned:**
- [ ] UI action buttons for quick execute
- [ ] Urgency badges (🔴 High, 🟡 Medium, 🟢 Low)
- [ ] Discovery reason tooltips
- [ ] Portfolio position size recommendations
- [ ] Historical opportunity tracking
- [ ] Opportunity win rate analytics

### **Possible:**
- [ ] Machine learning for local filters
- [ ] Multi-timeframe opportunity detection
- [ ] Correlation-based opportunity pairing
- [ ] Real-time opportunity alerts
- [ ] Backtesting opportunity signals

---

## 📝 Database Schema

### **discovered_coins**
Stores pre-filtered candidates from discovery scans
```sql
- symbol, name, market_cap_rank
- market_cap, current_price, volume_24h
- volume_score, price_momentum_score, sentiment_score, composite_score
- sparkline_data (7-day price chart)
- discovered_at, sparkline_fetched_at
```

### **recommendations**
Stores AI-confirmed actionable recommendations
```sql
- symbol, action (BUY/SELL only)
- confidence, entry_price, stop_loss
- take_profit_1, take_profit_2
- position_size, risk_level
- reasoning, sources
- created_at, expires_at (24 hours)
```

---

## 🎯 Success Metrics

- **Recommendation Quality:** % of recommendations that are BUY/SELL (target: 100%)
- **API Efficiency:** Average API calls per recommendation (target: <5)
- **Opportunity Hit Rate:** % of opportunities that become recommendations (target: 30-50%)
- **Execution Rate:** % of recommendations acted upon (user-dependent)
- **Win Rate:** % of executed recommendations that are profitable (track over time)

---

**Last Updated:** October 12, 2025
