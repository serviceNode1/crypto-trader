# 🚀 Quick Start Guide - Crypto AI Trading System

Get your AI-powered crypto paper trading system running in under 10 minutes!

---

## Step 1: Prerequisites Check

Before starting, ensure you have:

- ✅ Node.js 18+ installed (`node --version`)
- ✅ Docker Desktop installed and running
- ✅ Git installed (optional)
- ✅ Text editor (VS Code recommended)

---

## Step 2: Install Dependencies

```bash
cd crypto_traider
npm install
```

**Expected time**: 2-3 minutes

---

## Step 3: Get Your API Keys

### Free APIs (5 minutes total)

1. **Alpha Vantage** (Required)
   - Visit: https://www.alphavantage.co/support/#api-key
   - Click "Get your free API key"
   - Takes 30 seconds

2. **CryptoPanic** (Required)
   - Visit: https://cryptopanic.com/developers/api/
   - Sign up and get free API key
   - Takes 1 minute

3. **Reddit API** (Required)
   - Visit: https://www.reddit.com/prefs/apps
   - Click "Create App"
   - Select "script"
   - Note your client_id and client_secret
   - Takes 2 minutes

4. **Etherscan** (Optional but recommended)
   - Visit: https://etherscan.io/apis
   - Sign up for free API key
   - Takes 1 minute

### Paid APIs (Required - ~$3/month)

5. **OpenAI** (Required)
   - Visit: https://platform.openai.com/api-keys
   - Create new API key
   - Add $5-10 credit to account
   - Takes 2 minutes

6. **Anthropic** (Optional - fallback AI)
   - Visit: https://console.anthropic.com/
   - Create API key
   - Add $5-10 credit
   - Takes 2 minutes

---

## Step 4: Configure Environment

```bash
# Copy the example file
copy .env.example .env

# Edit .env with your favorite text editor
notepad .env
```

**Minimal configuration** (paste your keys):

```bash
# Database (Docker will handle this)
DATABASE_URL=postgresql://crypto_user:crypto_pass@localhost:5432/crypto_ai
REDIS_URL=redis://localhost:6379

# Your API Keys
ALPHA_VANTAGE_API_KEY=your_key_here
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USER_AGENT=crypto-trader:v1.0.0:by /u/your_username
CRYPTOPANIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Optional but recommended
ETHERSCAN_API_KEY=your_key_here

# Keep defaults for everything else
```

---

## Step 5: Start Infrastructure

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Wait 10 seconds for databases to initialize
timeout /t 10

# Check if containers are running
docker ps
```

You should see:
- `crypto-postgres` (running)
- `crypto-redis` (running)

---

## Step 6: Initialize Database

```bash
npm run migrate
```

**Expected output**:
```
✓ Running migration: 001_initial_schema.sql
✓ All migrations completed
```

---

## Step 7: Start the Application

**Option A: With Job Scheduler (Recommended)**

```bash
npm run dev
```

This will:
- Start the web server on port 3000
- Start automated data collection
- Generate AI recommendations every 4 hours
- Create daily reports

**Option B: Manual Mode (Testing)**

```bash
# Disable scheduler in .env
ENABLE_JOB_SCHEDULER=false

# Then start
npm run dev
```

Use this for testing or if you want to run analysis manually.

---

## Step 8: Verify It's Working

### Check the Dashboard

Open your browser to: **http://localhost:3000**

You should see:
- Portfolio overview (starting at $10,000)
- Performance metrics
- Empty holdings (you haven't traded yet)

### Check the API

```bash
# Health check
curl http://localhost:3000/api/health

# Portfolio status
curl http://localhost:3000/api/portfolio
```

### Check Logs

```powershell
# View live logs
Get-Content logs\combined.log -Wait -Tail 20
```

Look for:
- ✓ Database connected
- ✓ Redis initialized
- ✓ Job scheduler initialized
- 🚀 Server running on port 3000

---

## Step 9: Generate Your First Analysis

### Manual Analysis (Immediate)

```bash
# Analyze Bitcoin
npm run analyze BTC

# Analyze Ethereum
npm run analyze ETH

# Analyze all supported coins
npm run analyze ALL
```

This will:
1. Fetch current price
2. Get technical indicators
3. Analyze sentiment
4. Check market context
5. Generate AI recommendation

**Expected output**:
```
=== AI RECOMMENDATION ===
Action: BUY
Confidence: 72%
Risk Level: MEDIUM
Entry Price: $45,123.45
Stop Loss: $43,500.00
...
```

### Automated Analysis (Every 4 hours)

If you enabled the job scheduler, analysis runs automatically. Check logs:

```powershell
Get-Content logs\combined.log -Wait | Select-String "recommendation"
```

---

## Step 10: Execute Your First Trade

### Via API

```bash
curl -X POST http://localhost:3000/api/trades ^
  -H "Content-Type: application/json" ^
  -d "{\"symbol\": \"BTC\", \"side\": \"BUY\", \"quantity\": 0.01, \"stopLoss\": 43000, \"reasoning\": \"Testing system\"}"
```

### Via Dashboard

1. Go to http://localhost:3000
2. Wait for recommendations to appear
3. Click "Execute Trade" (if implemented)
4. Or use the API endpoint above

### Verify Trade

```bash
# Check recent trades
curl http://localhost:3000/api/trades

# Check portfolio
curl http://localhost:3000/api/portfolio
```

---

## 🎉 Success Checklist

- [x] Dependencies installed
- [x] API keys configured
- [x] Docker containers running
- [x] Database migrated
- [x] Application started
- [x] Dashboard accessible
- [x] Analysis generated
- [x] First trade executed

---

## ⚙️ Configuration Tips

### Adjust Job Frequency

Edit `.env` to change how often jobs run:

```bash
# More frequent (higher costs)
CRON_COLLECT_PRICES=*/1 * * * *      # Every minute
CRON_RECOMMENDATIONS=0 */2 * * *     # Every 2 hours

# Less frequent (lower costs)
CRON_COLLECT_PRICES=*/10 * * * *     # Every 10 minutes
CRON_RECOMMENDATIONS=0 */6 * * *     # Every 6 hours
```

### Adjust Risk Parameters

```bash
# More conservative
MAX_POSITION_SIZE=0.03               # 3% max per position
MAX_DAILY_LOSS=0.02                  # 2% daily loss limit

# More aggressive (not recommended)
MAX_POSITION_SIZE=0.10               # 10% max per position
MAX_DAILY_LOSS=0.05                  # 5% daily loss limit
```

**⚠️ Warning**: These limits exist for safety. Don't increase them unless you understand the risks.

---

## 🐛 Troubleshooting

### "Database connection failed"

```bash
# Check if PostgreSQL is running
docker ps | findstr postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker logs crypto-postgres
```

### "Redis connection failed"

```bash
# Check if Redis is running
docker ps | findstr redis

# Restart Redis
docker-compose restart redis
```

### "Rate limit exceeded"

You're hitting API limits. Solutions:
1. Reduce job frequency in `.env`
2. Wait for rate limit to reset (usually 1 minute)
3. Check cache is working (should prevent most hits)

### "Insufficient funds"

You're trying to trade more than your portfolio allows:
1. Check portfolio: `curl http://localhost:3000/api/portfolio`
2. Reduce trade quantity
3. Close some positions first

### "API key invalid"

Double-check your API keys in `.env`:
1. No extra spaces
2. No quotes around keys
3. Keys are active (not revoked)
4. For Reddit: Make sure user agent matches format

---

## 📊 What Happens Next?

### First Hour
- System collects initial data
- Cache builds up
- First analysis may be incomplete (normal)

### First Day
- Sentiment data accumulates
- Technical indicators stabilize
- First AI recommendations appear
- You can start paper trading

### First Week
- System learns patterns
- Win rate should be ~40-50%
- Portfolio should show some activity
- Daily reports arrive at 9 AM

### First Month
- Win rate improves to ~50-55%
- Performance metrics become meaningful
- You understand the system's strengths/weaknesses

---

## 🎯 Recommended First Week Plan

### Day 1: Setup & Monitoring
- Complete this quickstart
- Monitor logs for errors
- Verify data collection works
- Don't trade yet (let system collect data)

### Day 2-3: First Trades
- Review AI recommendations
- Execute 1-2 small test trades
- Monitor position performance
- Check risk management works

### Day 4-7: Regular Operation
- Let automated jobs run
- Review daily reports
- Make 3-5 trades based on recommendations
- Track win rate

### Week 2+: Optimization
- Analyze what works
- Adjust risk parameters
- Refine strategy based on results
- Consider implementing learning system

---

## 🔒 Important Reminders

### This is Paper Trading
- **NO REAL MONEY** is at risk
- Virtual $10,000 portfolio
- All trades are simulated
- Perfect for learning and testing

### AI is Not Perfect
- Expected win rate: 50-60% at best
- Many predictions will be wrong
- Past performance ≠ future results
- Use as learning tool, not financial advice

### Never Use With Real Money
- Even after successful paper trading
- Market conditions change constantly
- Professional traders have huge advantages
- This is an educational project only

---

## 📚 Next Steps

1. **Read SETUP.md** - Detailed configuration guide
2. **Read README.md** - Full system documentation
3. **Read PROJECT_STATUS.md** - What's implemented
4. **Check logs/** - Monitor system health
5. **Visit dashboard** - Track performance

---

## 🆘 Getting Help

### Check Documentation
- `README.md` - Complete overview
- `SETUP.md` - Detailed setup
- `PROJECT_STATUS.md` - Feature status

### Check Logs
- `logs/combined.log` - All activity
- `logs/error.log` - Errors only

### Common Issues
- Most problems are API keys or Docker
- Check `.env` configuration carefully
- Ensure Docker containers are running
- Verify API rate limits not exceeded

---

## 🎊 You're All Set!

Your AI-powered crypto paper trading system is now running!

**Dashboard**: http://localhost:3000  
**API**: http://localhost:3000/api/health  
**Logs**: `logs/combined.log`

Happy (paper) trading! 📈🤖
