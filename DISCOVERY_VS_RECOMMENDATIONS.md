# 🔍 Discovery vs AI Recommendations: What's the Difference?

## Quick Answer

**"Run Discovery"** and **"AI Recommendations"** are two different but complementary parts of the trading workflow:

| Feature | Run Discovery | AI Recommendations |
|---------|--------------|-------------------|
| **What it does** | Scans market for promising coins | Analyzes specific coins with AI |
| **Output** | List of candidates with scores | BUY/SELL decisions with confidence |
| **Cost** | Free (no API calls) | Uses AI API credits |
| **Frequency** | Can run anytime | Scheduled every 4 hours |
| **Speed** | Fast (<30 seconds) | Slower (2-5 minutes) |
| **Scope** | Top 10/25/50/100 coins | Top 3 buy + 3 sell candidates |

---

## 📊 The Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. DISCOVERY (Free)                          │
│  Scans top N coins → Filters by volume, momentum, sentiment    │
│  Output: Scored candidate list stored in database              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              2. OPPORTUNITY IDENTIFICATION (Free)                │
│  BUY: Candidates NOT in your portfolio                          │
│  SELL: Positions IN your portfolio with exit signals            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              3. AI ANALYSIS (Costs API credits)                  │
│  Takes top 3 buy + 3 sell opportunities                         │
│  Performs deep analysis with technical + sentiment + news       │
│  Only stores BUY/SELL recommendations (no HOLD)                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              4. RECOMMENDATIONS DISPLAYED IN UI                  │
│  Shows only actionable BUY/SELL with action buttons             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 **"Run Discovery" Button**

### What It Does:
1. **Fetches** top N coins from CoinGecko (based on your Universe setting)
2. **Filters** using local criteria:
   - Minimum market cap
   - Minimum volume
   - Price momentum (24h, 7d)
   - Basic sentiment check
3. **Scores** each coin on 0-100 scale
4. **Stores** top candidates in database
5. **Displays** them in the "Discovered Opportunities" section

### When To Use:
- ✅ Want to see what coins are hot right now
- ✅ Check if discovery is finding good candidates
- ✅ Force a refresh instead of waiting for scheduled run
- ✅ Changed your Universe (Top 10 → Top 50) and want to see new results

### Settings That Affect It:
- **Coin Universe**: Top 10/25/50/100 - How many coins to scan
- **Strategy**: Conservative/Moderate/Aggressive - Filter strictness

### What You See:
```
🔍 Discovered Opportunities
┌─────────────────────────────────────┐
│ ETH  Score: 78  ↑ 5.2%              │
│ Market Cap: $450B  Vol: $25B        │
│ [Mini sparkline chart]              │
│                                     │
│ SOL  Score: 72  ↑ 8.1%              │
│ Market Cap: $95B   Vol: $8B         │
│ [Mini sparkline chart]              │
└─────────────────────────────────────┘
```

### Cost:
- **FREE** - Uses CoinGecko's free API tier
- No AI API calls

---

## 🤖 **"AI Recommendations" (Automatic)**

### What It Does:
1. **Uses** discovery results (or runs discovery if needed)
2. **Identifies** opportunities:
   - BUY: High-scoring coins NOT in your portfolio
   - SELL: Positions at profit/loss exit points
3. **Sends** top 3 buy + 3 sell to AI for deep analysis
4. **Filters** only BUY/SELL actions (discards HOLD)
5. **Stores** recommendations in database
6. **Displays** in "AI Recommendations" section

### When It Runs:
- **Automatically**: Every 4 hours (configurable via `CRON_RECOMMENDATIONS`)
- **Manually**: Via API endpoint (future UI button)

### What The AI Analyzes:
For each opportunity, the AI receives:
- Current price and 100 candlesticks (technical analysis)
- 20 recent news articles
- 50 Reddit posts
- Technical indicators (RSI, MACD, Bollinger Bands, etc.)
- Sentiment scores
- Market context (BTC dominance, market regime, etc.)

### What You See:
```
🤖 AI Recommendations   Last analysis: 2h ago
┌─────────────────────────────────────┐
│ ETH             [BUY]               │
│ Confidence: 82% | Risk: MEDIUM      │
│ Entry: $3,245                       │
│ Stop Loss: $3,100                   │
│                                     │
│ BTC             [SELL]              │
│ Confidence: 75% | Risk: LOW         │
│ Entry: $68,500                      │
│ Stop Loss: $65,000                  │
└─────────────────────────────────────┘
```

### Cost:
- **PAID** - Uses OpenAI or Anthropic API
- Typically 6 AI calls per run (3 buy + 3 sell)
- ~$0.10-0.30 per run depending on model

---

## 🆚 Key Differences

### **Scope:**
- **Discovery**: Analyzes 10-100 coins broadly
- **AI**: Deeply analyzes 3-6 specific opportunities

### **Filtering:**
- **Discovery**: Simple filters (volume, momentum, sentiment)
- **AI**: Complex analysis (technical patterns, news sentiment, market context)

### **Output:**
- **Discovery**: "This coin looks interesting" (scored 0-100)
- **AI**: "BUY this coin" or "SELL this coin" (actionable decision)

### **Portfolio Awareness:**
- **Discovery**: Doesn't know what you own
- **AI**: Separates buy opportunities (not owned) from sell opportunities (owned)

### **Frequency:**
- **Discovery**: Can run anytime, lightweight
- **AI**: Runs every 4 hours, resource-intensive

---

## 💡 Typical User Flow

### **Scenario 1: Just Checking What's Hot**
```
1. Click "Run Discovery" with "Force Refresh" ✓
2. Review discovered coins and their scores
3. Done - no AI analysis needed
```

### **Scenario 2: Getting AI Trade Recommendations**
```
1. Discovery runs automatically (or you trigger it)
2. System identifies buy/sell opportunities
3. AI analyzes top candidates (automatic, every 4 hours)
4. Check "AI Recommendations" section
5. Execute trades based on recommendations
```

### **Scenario 3: Impatient for New Recommendations**
```
1. Discovery already ran (has cached results)
2. Trigger manual recommendation generation (future feature)
3. AI analyzes latest opportunities
4. New recommendations appear
```

---

## 🎯 Best Practices

### **Discovery:**
- ✅ Run discovery before market opens
- ✅ Use "Force Refresh" for real-time data
- ✅ Try different Universe settings (Top 10 vs Top 50)
- ✅ Check discovery scores to understand candidate quality

### **AI Recommendations:**
- ✅ Let it run automatically every 4 hours
- ✅ Check "Last analysis" timestamp
- ✅ Act on high-confidence recommendations quickly
- ✅ Review both BUY and SELL recommendations

### **Don't:**
- ❌ Run discovery every minute (wastes API calls)
- ❌ Ignore sell recommendations (risk management!)
- ❌ Execute low-confidence (<60%) recommendations
- ❌ Expect instant results (AI takes 2-5 minutes)

---

## 🔧 Configuration

### **Discovery Settings (via Settings Modal):**
```javascript
{
  "coinUniverse": "top25",        // top10, top25, top50, top100
  "analysisFrequency": 4          // Hours between runs (1, 4, 8, 24)
}
```

### **Recommendation Schedule (Environment Variable):**
```bash
CRON_RECOMMENDATIONS="0 */4 * * *"  # Every 4 hours
```

### **Manual Triggers (via API):**
```bash
# Run discovery
POST /api/discovery/run?forceRefresh=true

# Generate AI recommendations
POST /api/recommendations/generate
Body: { "maxBuy": 3, "maxSell": 3 }
```

---

## 📊 Example Timeline

```
00:00 - Discovery runs automatically
        ↓ Finds 8 candidates
        
00:05 - Opportunity identifier finds:
        • 5 buy opportunities (not owned)
        • 2 sell opportunities (owned, at exit points)
        
00:10 - AI analyzes top 3 buy + 2 sell
        ↓ Confirms 2 BUY, 1 SELL
        
00:15 - Recommendations appear in UI
        "Last analysis: Just now"
        
02:15 - UI shows "Last analysis: 2h ago"

04:00 - Next automatic discovery + AI run
```

---

## ❓ FAQ

**Q: Why don't I see any AI recommendations?**
A: Either:
1. Discovery hasn't found any good candidates yet
2. AI analyzed them but recommended HOLD (not shown)
3. No buy opportunities (you already own the good coins)
4. No sell opportunities (nothing at exit points)

**Q: Can I force AI to analyze a specific coin?**
A: Not directly via UI yet, but you can use the API:
```bash
POST /api/recommendation/:SYMBOL
```

**Q: Why does discovery show 10 coins but AI only analyzed 3?**
A: Discovery is a broad scan. AI only analyzes the *top* candidates to save API costs. Lower-priority coins are skipped.

**Q: What if I change my Universe setting?**
A: Click "Run Discovery" with "Force Refresh" to rescan with the new universe size.

**Q: How do I know if AI is working?**
A: Check "Last analysis" timestamp next to "🤖 AI Recommendations". Should update every 4 hours.

---

## 🎯 Summary

- **Discovery** = Find interesting coins (free, fast, broad)
- **AI Recommendations** = Get actionable trades (paid, slow, focused)
- **Use both together** for best results
- **Discovery feeds AI** - they're part of one workflow

Think of Discovery as the **scouting team** and AI Recommendations as the **investment committee** that makes final decisions.

---

**Last Updated:** October 12, 2025
