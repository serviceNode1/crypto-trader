# Crypto AI Trading System - Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ with TimescaleDB extension
- Redis 7+
- Docker and Docker Compose (recommended)

### Installation Steps

#### 1. Clone and Install Dependencies

```bash
cd crypto_traider
npm install
```

#### 2. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
copy .env.example .env
```

Edit `.env` and add your API keys:

**Required API Keys (Free):**
- CoinGecko: Optional (works without key on free tier)
- Alpha Vantage: https://www.alphavantage.co/support/#api-key
- Reddit: https://www.reddit.com/prefs/apps
- CryptoPanic: https://cryptopanic.com/developers/api/
- Etherscan: https://etherscan.io/apis

**Required API Keys (Paid but Cheap):**
- OpenAI: https://platform.openai.com/api-keys (GPT-4o-mini ~$0.15/1M tokens)
- Anthropic: https://console.anthropic.com/ (Claude Haiku ~$0.25/1M tokens)

#### 3. Start Infrastructure with Docker

```bash
docker-compose up -d postgres redis
```

This starts PostgreSQL with TimescaleDB and Redis.

#### 4. Run Database Migrations

```bash
npm run migrate
```

#### 5. Start the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

#### 6. Access the Dashboard

Open your browser to: http://localhost:3000

---

## Docker Deployment (Recommended)

Run the entire stack with Docker:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL with TimescaleDB
- Redis
- Node.js application

Check logs:
```bash
docker-compose logs -f app
```

Stop everything:
```bash
docker-compose down
```

---

## Configuration

### Risk Management Parameters

Edit `.env` to adjust risk limits (all have safe defaults):

```bash
MAX_POSITION_SIZE=0.05      # 5% max per position
MAX_DAILY_LOSS=0.03         # 3% daily loss limit
MAX_OPEN_POSITIONS=5        # Maximum 5 positions
```

⚠️ **These limits are hard-coded in the application for safety and cannot be bypassed through API calls.**

### Caching Configuration

Adjust cache TTLs in `.env`:

```bash
CACHE_TTL_PRICE=60          # Price cache: 60 seconds
CACHE_TTL_SENTIMENT=900     # Sentiment cache: 15 minutes
```

---

## API Endpoints

### Portfolio Management
- `GET /api/portfolio` - Get current portfolio state
- `GET /api/portfolio/performance` - Performance metrics
- `GET /api/portfolio/risk` - Risk exposure

### Trading
- `GET /api/trades` - Trade history
- `POST /api/trades` - Execute a trade
  ```json
  {
    "symbol": "BTC",
    "side": "BUY",
    "quantity": 0.01,
    "stopLoss": 45000,
    "reasoning": "Oversold RSI"
  }
  ```

### Analysis
- `GET /api/analysis/:symbol` - Comprehensive analysis
- `POST /api/analyze/:symbol` - Generate AI recommendation
- `GET /api/sentiment/:symbol` - Sentiment analysis
- `GET /api/recommendations` - Current recommendations

### System
- `GET /api/health` - Health check
- `GET /api/market-context` - Global market context

---

## Testing

Run tests:
```bash
npm test
```

Run with coverage:
```bash
npm test -- --coverage
```

---

## Monitoring

### Logs

Application logs are stored in `logs/`:
- `combined.log` - All logs
- `error.log` - Errors only
- `exceptions.log` - Uncaught exceptions

View logs in real-time:
```bash
# On Windows
Get-Content logs\combined.log -Wait -Tail 50

# On Linux/Mac
tail -f logs/combined.log
```

### Database Queries

Check recent trades:
```sql
SELECT * FROM trades ORDER BY executed_at DESC LIMIT 10;
```

Check portfolio balance:
```sql
SELECT * FROM portfolio_balance ORDER BY id DESC LIMIT 1;
```

View performance metrics:
```sql
SELECT * FROM performance_metrics ORDER BY calculated_at DESC LIMIT 1;
```

---

## Troubleshooting

### Database Connection Issues

**Error: "Connection refused"**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Redis Connection Issues

**Error: "Redis connection failed"**
```bash
# Check Redis status
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### API Rate Limits

**Error: "Rate limit exceeded"**
- CoinGecko: 50 requests/minute (free tier)
- Alpha Vantage: 5 requests/minute (very limited)
- Reddit: 60 requests/minute

**Solution:** The system uses aggressive caching to minimize API calls. If you hit rate limits:
1. Wait for the rate limit window to reset
2. Reduce polling frequency in job schedules
3. Consider upgrading to paid API tiers

### AI API Costs

**Monthly cost exceeding budget?**
1. Check token usage in logs
2. Reduce analysis frequency
3. Use local sentiment analysis more (set `useMultipleModels: false`)
4. Simplify AI prompts

### Paper Trading Issues

**Error: "Insufficient funds"**
- Check your portfolio cash balance: `GET /api/portfolio`
- You started with $10,000 virtual cash
- Trades deduct fees and account for slippage

**Error: "Position size exceeds maximum"**
- You're trying to invest >5% of portfolio in one position
- Reduce quantity or wait until portfolio grows

---

## Development

### Project Structure

```
crypto_traider/
├── src/
│   ├── api/              # Express routes
│   ├── config/           # Database, Redis, constants
│   ├── migrations/       # Database migrations
│   ├── services/
│   │   ├── dataCollection/    # API integrations
│   │   ├── analysis/          # Technical, sentiment
│   │   ├── ai/                # AI services
│   │   └── trading/           # Paper trading, risk
│   ├── utils/            # Logger, rate limiter, retry
│   └── app.ts            # Main application
├── public/               # Dashboard HTML/CSS/JS
├── logs/                 # Application logs
├── tests/                # Jest tests
└── docker-compose.yml
```

### Adding New Features

1. **New Data Source:**
   - Create service in `src/services/dataCollection/`
   - Add rate limiter configuration
   - Implement caching strategy

2. **New Analysis:**
   - Add logic to `src/services/analysis/`
   - Update AI prompt if needed
   - Create database table for results

3. **New API Endpoint:**
   - Add route to `src/api/routes.ts`
   - Update dashboard if user-facing

---

## Production Deployment

### Security Checklist

- [ ] All API keys in environment variables (never commit to git)
- [ ] HTTPS enabled (use reverse proxy like Nginx)
- [ ] Rate limiting enabled (already configured)
- [ ] CORS properly configured
- [ ] Database backups automated
- [ ] Monitoring and alerting set up

### Performance Optimization

1. **Database:**
   - TimescaleDB automatically optimizes time-series data
   - Create indexes on frequently queried columns
   - Set up automated cleanup of old data

2. **Redis:**
   - Monitor cache hit rate (should be >80%)
   - Adjust TTLs based on data volatility
   - Consider Redis persistence for important cache

3. **API Calls:**
   - Batch requests when possible
   - Implement circuit breakers for unreliable APIs
   - Monitor API usage and costs

---

## Cost Optimization

### Target: <$5/month

**Current Cost Breakdown:**
- OpenAI GPT-4o-mini: ~$1.50/month
- Anthropic Claude Haiku: ~$1.25/month
- All data APIs: $0 (free tiers)
- **Total: ~$3/month**

**Tips to Reduce Costs:**
1. Use local sentiment analysis before AI (already implemented)
2. Cache aggressively (already implemented)
3. Reduce AI analysis frequency
4. Use single AI model instead of multiple
5. Optimize prompt lengths

---

## Next Steps

After setup, you should:

1. **Monitor for 24 hours** - Ensure system runs without crashes
2. **Review logs** - Check for errors or warnings
3. **Validate data quality** - Verify prices and sentiment make sense
4. **Test paper trading** - Make a few test trades
5. **Analyze performance** - After a week, review prediction accuracy

---

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review README.md for context on limitations
3. Check database tables for data integrity
4. Verify all API keys are valid

---

## Important Reminders

⚠️ **THIS IS PAPER TRADING ONLY**
- No real money is at risk
- Virtual portfolio starts at $10,000
- All trades are simulated

⚠️ **EDUCATIONAL PURPOSE**
- System is experimental
- AI predictions are not financial advice
- Expected win rate: 50-60% at best
- Many predictions will be wrong

⚠️ **NEVER USE WITH REAL MONEY**
- Even after successful paper trading
- Market conditions change rapidly
- Past performance ≠ future results
- Professional traders have significant advantages
