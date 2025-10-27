# Auto-Trading Implementation Plan

## ✅ Completed: Settings UI

### What We Built:
1. **⚙️ Settings Modal** - Beautiful UI with toggles, sliders, and dropdowns
2. **💾 LocalStorage Persistence** - Settings saved in browser
3. **🎨 Professional Design** - Matches existing dashboard aesthetic

### Settings Available:
- **Auto-Execution**: Toggle on/off
- **Confidence Threshold**: 70-90% slider (step: 5%)
- **Human-in-the-Loop**: Manual approval toggle
- **Position Sizing**: Equal weight vs Confidence-based
- **Max Position Size**: 2-10% slider
- **Take Profit Strategy**: Full/Partial/Trailing
- **Auto Stop-Loss**: Toggle on/off
- **Coin Universe**: Top 10/50/100
- **Analysis Frequency**: 1/4/8/24 hours

---

## 🚧 Next Phase: Backend Implementation

### Phase 1: Auto-Executor Service (Week 1)

#### File: `src/services/trading/autoExecutor.ts`

**Purpose**: Monitor AI recommendations and auto-execute based on settings

```typescript
interface AutoExecutorConfig {
  enabled: boolean;
  confidenceThreshold: number;
  humanApproval: boolean;
  positionSizingStrategy: 'equal' | 'confidence';
  maxPositionSize: number;
}

// Main executor function
export async function processRecommendations() {
  // 1. Get pending recommendations from database
  // 2. Load user settings (from database, not localStorage)
  // 3. Filter by confidence threshold
  // 4. Check risk management rules
  // 5. Calculate position size
  // 6. Execute trade OR queue for approval
  // 7. Update recommendation status
}
```

**Key Functions:**
- `getPendingRecommendations()` - Fetch unexecuted recommendations
- `shouldAutoExecute(rec, settings)` - Check if should execute
- `calculatePositionSize(rec, settings)` - Size based on strategy
- `executeOrQueue(rec, settings)` - Execute or notify user

---

### Phase 2: Position Monitor Service (Week 1)

#### File: `src/services/trading/positionMonitor.ts`

**Purpose**: Monitor open positions for stop-loss & take-profit triggers

```typescript
export async function monitorPositions() {
  // 1. Get all open positions from portfolio
  // 2. Fetch current prices
  // 3. Check stop-loss levels
  // 4. Check take-profit levels
  // 5. Execute exit trades
  // 6. Log actions
}

// Check every 5 minutes via Bull queue
```

**Key Functions:**
- `checkStopLoss(position, currentPrice)` - Auto-sell if hit
- `checkTakeProfit(position, currentPrice, strategy)` - Partial/full exit
- `implementTrailingStop(position, currentPrice)` - Move stop up

---

### Phase 3: User Settings Database (Week 1)

#### Migration: Add settings table

```sql
CREATE TABLE user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER DEFAULT 1, -- For future multi-user
  auto_execute BOOLEAN DEFAULT FALSE,
  confidence_threshold INTEGER DEFAULT 75,
  human_approval BOOLEAN DEFAULT TRUE,
  position_sizing_strategy VARCHAR(20) DEFAULT 'equal',
  max_position_size DECIMAL(5,2) DEFAULT 5.0,
  take_profit_strategy VARCHAR(20) DEFAULT 'partial',
  auto_stop_loss BOOLEAN DEFAULT TRUE,
  coin_universe VARCHAR(20) DEFAULT 'top50',
  analysis_frequency INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO user_settings (user_id) VALUES (1);
```

---

### Phase 4: Settings API Endpoints (Week 1)

#### File: `src/api/routes.ts`

```typescript
// GET /api/settings - Fetch current settings
router.get('/settings', async (req, res) => {
  const settings = await getUserSettings();
  res.json(settings);
});

// PUT /api/settings - Update settings
router.put('/settings', async (req, res) => {
  const settings = req.body;
  await updateUserSettings(settings);
  res.json({ success: true });
});

// POST /api/settings/reset - Reset to defaults
router.post('/settings/reset', async (req, res) => {
  await resetUserSettings();
  res.json({ success: true });
});
```

**Update Frontend:**
- Save settings to backend instead of localStorage
- Fetch settings on page load
- Show loading state during save

---

### Phase 5: Approval Queue (Week 2)

#### File: `src/services/trading/approvalQueue.ts`

**Purpose**: Queue trades that need human approval

```sql
CREATE TABLE trade_approvals (
  id SERIAL PRIMARY KEY,
  recommendation_id INTEGER REFERENCES recommendations(id),
  symbol VARCHAR(10),
  action VARCHAR(10),
  quantity DECIMAL(20,8),
  entry_price DECIMAL(20,8),
  stop_loss DECIMAL(20,8),
  reasoning TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, expired
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);
```

**Frontend Component:**
- "🔔 Pending Approvals" badge in header
- Modal to approve/reject trades
- Auto-refresh every 30 seconds

---

### Phase 6: Coin Discovery Service (Week 2)

#### File: `src/services/discovery/coinDiscovery.ts`

**Purpose**: Automatically discover and rank trading opportunities

```typescript
export async function discoverCoins(universe: 'top10' | 'top50' | 'top100') {
  // 1. Fetch coins by market cap rank
  // 2. Filter by volume (min $1M)
  // 3. Calculate momentum score
  // 4. Check sentiment velocity
  // 5. Rank by composite score
  // 6. Return top 10 candidates
}

// Screening criteria
interface CoinScore {
  symbol: string;
  marketCapRank: number;
  volumeChange24h: number;
  priceChange7d: number;
  sentimentScore: number;
  compositeScore: number;
}
```

**Run daily via Bull queue**

---

### Phase 7: Testing & Safety (Week 3)

#### Safety Checklist:
- [ ] Dry-run mode (log trades, don't execute)
- [ ] Maximum trades per day limit
- [ ] Circuit breaker if 3 consecutive losses
- [ ] Email/notification on execution
- [ ] Detailed execution logs
- [ ] Emergency "STOP ALL TRADING" button
- [ ] Backtesting before live deployment

#### Testing Scenarios:
1. **Normal Operation**: Recommendation → Auto-execute → Success
2. **Risk Block**: Recommendation → Risk check fails → Skip
3. **Approval Queue**: Recommendation → Human approval → Execute
4. **Stop Loss**: Position opened → Price drops → Auto-sell
5. **Take Profit**: Position opened → Target reached → Partial exit
6. **Circuit Breaker**: 3 losses → Trading halted → Alert sent

---

## 🎯 Implementation Priority

### Week 1 (Essential):
1. ✅ Settings database schema
2. ✅ Settings API endpoints
3. ✅ Update frontend to use backend settings
4. ✅ Auto-executor service (basic)
5. ✅ Position monitor service (stop-loss only)

### Week 2 (Important):
6. ✅ Approval queue system
7. ✅ Take-profit strategies
8. ✅ Coin discovery service
9. ✅ Notification system

### Week 3 (Polish):
10. ✅ Comprehensive testing
11. ✅ Safety mechanisms
12. ✅ Performance monitoring
13. ✅ Documentation

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│            Frontend (index.html)                     │
│  ┌──────────────┐                                   │
│  │ Settings UI  │ ─────> Save to Backend            │
│  └──────────────┘                                   │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│         Backend API (routes.ts)                      │
│  • GET/PUT /api/settings                            │
│  • GET /api/approvals (pending trades)              │
│  • POST /api/approvals/:id/approve                  │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│         Bull Queue (scheduledJobs.ts)                │
│  ┌─────────────────────────────────────────┐       │
│  │  Every 5 min: Process Recommendations    │       │
│  │  Every 5 min: Monitor Positions          │       │
│  │  Every 4 hrs: Discover New Coins         │       │
│  └─────────────────────────────────────────┘       │
└────────────┬────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────┐
│         Trading Services                             │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Auto-Executor    │  │ Position Monitor │        │
│  │                  │  │                  │        │
│  │ • Get settings   │  │ • Check prices   │        │
│  │ • Filter recs    │  │ • Trigger exits  │        │
│  │ • Execute trades │  │ • Trailing stops │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Approval Queue   │  │ Coin Discovery   │        │
│  │                  │  │                  │        │
│  │ • Queue trades   │  │ • Screen coins   │        │
│  │ • Await approval │  │ • Rank by score  │        │
│  │ • Execute on OK  │  │ • Generate recs  │        │
│  └──────────────────┘  └──────────────────┘        │
└─────────────────────────────────────────────────────┘
```

---

## 💾 Database Schema Updates

### New Tables:
1. **`user_settings`** - Trading preferences
2. **`trade_approvals`** - Pending manual approvals
3. **`execution_logs`** - Detailed execution history
4. **`circuit_breakers`** - Trading halt events

### Modified Tables:
- **`recommendations`**: Add `execution_status` field
- **`trades`**: Add `auto_executed` boolean field

---

## 🔔 Notification System

### Notification Events:
- ✅ Trade auto-executed
- ⚠️ Trade queued for approval
- 🛑 Stop-loss triggered
- 🎯 Take-profit reached
- 🚨 Circuit breaker activated
- 📊 Daily performance summary

### Delivery Methods:
1. **In-App** (Priority 1): Badge + modal
2. **Browser Push** (Priority 2): Native notifications
3. **Email** (Priority 3): Via SendGrid/Mailgun
4. **Telegram** (Future): Bot integration

---

## ⚙️ Configuration Management

### Environment Variables to Add:
```env
# Auto-Trading
AUTO_TRADING_ENABLED=false              # Master kill switch
MAX_TRADES_PER_DAY=10                   # Safety limit
CIRCUIT_BREAKER_CONSECUTIVE_LOSSES=3    # Auto-halt threshold
DRY_RUN_MODE=true                       # Test without executing

# Notifications
NOTIFICATION_EMAIL=user@example.com
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

## 🧪 Testing Strategy

### Unit Tests:
- Auto-executor logic
- Position sizing calculations
- Risk management validation
- Approval queue flow

### Integration Tests:
- End-to-end recommendation → execution
- Stop-loss triggering
- Take-profit strategies
- Settings persistence

### Manual Testing:
- UI settings save/load
- Modal interactions
- Approval workflow
- Error handling

---

## 📚 Documentation Needed

1. **User Guide**: How to enable auto-trading safely
2. **API Docs**: Settings endpoints
3. **Risk Disclaimer**: Auto-trading warnings
4. **Troubleshooting**: Common issues

---

## 🎯 Success Metrics

After 2 weeks of testing:
- Settings persistence: 100% success rate
- Auto-execution latency: <30 seconds from recommendation
- Stop-loss accuracy: 100% (must never miss)
- False positive rate: <5% (unnecessary stops)
- System uptime: >99.5%

---

## 🚨 Emergency Procedures

### If Auto-Trading Goes Wrong:

1. **Immediate**: Set `AUTO_TRADING_ENABLED=false` in `.env`
2. **Restart**: `npm run restart`
3. **Review Logs**: Check `logs/app.log` for errors
4. **Close Positions**: Manually exit if needed
5. **Post-Mortem**: Analyze what went wrong

### Kill Switch Locations:
- Environment variable: `AUTO_TRADING_ENABLED`
- Database: `UPDATE user_settings SET auto_execute = FALSE`
- Frontend: Toggle in Settings Modal

---

## 📝 Next Steps

**Immediate Action Items:**
1. Review this plan with team/stakeholders
2. Create database migration for settings table
3. Implement settings API endpoints
4. Build auto-executor service (dry-run mode first)
5. Test thoroughly before enabling real execution

**Questions to Answer:**
- How to handle failed executions? Retry or skip?
- What happens to queued approvals if user logs out?
- Should there be position-level kill switches?
- How to handle API rate limits during high activity?

---

**Status**: 📋 Planning Complete - Ready for Implementation  
**Created**: 2025-10-08  
**Last Updated**: 2025-10-08
