# System Architecture Documentation

**Crypto AI Trading Intelligence System**  
**Last Updated:** October 27, 2025  
**Version:** 1.0

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Layers](#architecture-layers)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Database Schema](#database-schema)
7. [Authentication & Security](#authentication--security)
8. [Job Scheduler System](#job-scheduler-system)
9. [Code Organization](#code-organization)

---

## System Overview

### Purpose
An AI-powered cryptocurrency analysis and paper trading platform that monitors crypto markets, analyzes technical indicators and sentiment, generates AI-driven recommendations, and executes simulated trades with professional risk management. Supports multiple users with isolated portfolios.

### Core Philosophy
- **Safety First**: Hard-coded risk limits prevent excessive losses
- **Cost-Effective**: Primarily uses free-tier APIs (~$3/month AI costs)
- **Data-Driven**: Decisions based on technical analysis + sentiment + AI reasoning
- **Educational**: Designed for learning, not real money trading

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ / TypeScript 5.3+
- **Framework**: Express 4.18
- **Database**: PostgreSQL 14+ with TimescaleDB extension
- **Cache**: Redis 7+
- **Job Queue**: Bull 4.12 (Redis-backed)
- **Authentication**: JWT + Google OAuth 2.0
- **Logging**: Winston 3.11

### Frontend
- **Architecture**: Vanilla JavaScript ES6+ Modules
- **Styling**: Custom CSS with CSS Variables (theme system)
- **Charts**: Chart.js 4.4
- **State Management**: localStorage + in-memory

### External APIs
- **CoinGecko**: Crypto prices, market data, OHLC
- **Binance**: Real-time candlestick data
- **Reddit**: Social sentiment analysis
- **CryptoPanic**: Aggregated crypto news
- **Alpha Vantage**: Traditional market indicators
- **OpenAI GPT-4o-mini**: AI analysis
- **Anthropic Claude Haiku**: AI analysis (fallback)

---

## Architecture Layers

```
┌────────────────────────────────────────────────┐
│           CLIENT LAYER (Browser)                │
│  HTML/CSS/JS + Chart.js + Theme System         │
└────────────────┬───────────────────────────────┘
                 │ HTTPS/REST
┌────────────────┴───────────────────────────────┐
│         API GATEWAY (Express + Middleware)      │
│  Auth, CORS, Rate Limit, CSP, CSRF             │
└────────────────┬───────────────────────────────┘
                 │
┌────────────────┴───────────────────────────────┐
│          BUSINESS LOGIC (Services)              │
│  Trading, Analysis, Discovery, AI, Auth        │
└─────┬──────────┬──────────┬───────────────────┘
      │          │          │
┌─────┴────┐ ┌──┴─────┐ ┌──┴──────────────────┐
│PostgreSQL│ │ Redis  │ │  External APIs      │
│ Database │ │ Cache  │ │  (CoinGecko, etc)   │
└──────────┘ └────────┘ └─────────────────────┘
      │          │
┌─────┴──────────┴───────────────────────────────┐
│       BACKGROUND JOBS (Bull Processors)         │
│  Data Collection, Analysis, Monitoring          │
└─────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Directory Structure

```
src/
├── app.ts                      # Main application entry
├── api/routes.ts              # 50+ API endpoints
├── config/                    # Database, Redis, constants
├── middleware/                # Auth, security, rate limiting
├── routes/                    # Auth routes (email, Google OAuth)
├── services/
│   ├── ai/                    # OpenAI/Anthropic integration
│   ├── analysis/              # Technical, sentiment, market context
│   ├── auth/                  # Authentication logic
│   ├── dataCollection/        # 9 API integrations
│   ├── discovery/             # Coin discovery, opportunity finder
│   ├── logging/               # AI review logging
│   ├── settings/              # User preferences
│   └── trading/               # Paper trading, risk, monitoring
├── jobs/                      # Bull queue processors
├── migrations/                # Database migrations
├── types/                     # TypeScript definitions
├── utils/                     # Logger, rate limiter, retry
└── validators/                # Input validation
```

### Service Layer Design

**Service Categories:**

1. **Data Collection**: Fetch external data with rate limiting and caching
2. **Analysis**: Process raw data into insights (technical, sentiment, market)
3. **Trading**: Paper trading engine, risk management, position monitoring
4. **Discovery**: Market scanning, opportunity detection, scoring
5. **AI**: OpenAI/Anthropic integration with structured prompts

**Common Pattern:**
```typescript
export async function getData(symbol: string): Promise<Data> {
  // 1. Check Redis cache
  const cached = await redis.get(`key:${symbol}`);
  if (cached) return JSON.parse(cached);
  
  // 2. Fetch from API with retry
  const data = await withRetry(() => apiCall(symbol));
  
  // 3. Cache result
  await redis.set(`key:${symbol}`, JSON.stringify(data), 'EX', TTL);
  
  return data;
}
```

---

## Frontend Architecture

### Module Structure

```
public/
├── index.html, login.html, signup.html
├── js/
│   ├── main.js              # App initialization
│   ├── auth.js              # AuthManager (token refresh)
│   ├── config.js            # API base URL
│   ├── api/                 # API client modules
│   │   ├── portfolio.js
│   │   ├── trades.js
│   │   └── analysis.js
│   ├── ui/                  # UI component modules (8 files)
│   │   ├── portfolio.js, trades.js, discovery.js
│   │   ├── recommendations.js, analysis.js, trading.js
│   │   ├── settings.js, market-context.js
│   │   └── ai-review-logs.js, cards.js, modals.js
│   └── utils/               # Utility modules
│       ├── formatters.js, formatting.js, time.js
│       ├── theme.js, storage.js, modal.js
└── css/                     # 17 stylesheets
```

### Authentication Flow (Frontend)

The `AuthManager` class handles automatic token refresh:

```javascript
class AuthManager {
  async fetch(url, options = {}) {
    const token = this.getToken();
    let response = await fetch(url, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    });
    
    // If 401, refresh token and retry
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed.success) {
        return fetch(url, { ...options, headers: { 'Authorization': `Bearer ${this.getToken()}` }});
      }
      window.location.href = '/login.html';
      return null;
    }
    return response;
  }
}

// All API calls use window.auth.fetch() instead of native fetch()
```

---

## Database Schema

### Core Tables

#### **users**
```sql
id, email, password_hash, display_name, google_id, 
profile_picture_url, email_verified, is_active, is_admin,
failed_login_attempts, locked_until, last_login, created_at, updated_at
```
- Multi-user support with Google OAuth
- Account lockout after 5 failed login attempts (15 min)
- Stores profile data and authentication metadata

#### **sessions**
```sql
id, user_id, token, refresh_token, expires_at, refresh_expires_at,
ip_address, user_agent, is_active, last_activity, created_at
```
- JWT access tokens (24h expiration)
- Refresh tokens (30d expiration)
- Session management with IP tracking

#### **settings**
```sql
id, user_id, coin_universe, analysis_frequency, theme,
notifications_enabled, auto_trading_enabled, risk_tolerance
```
- User-specific preferences
- Coin universe: top10/top25/top50/top100
- Theme: dark/light/blue/purple

#### **portfolio_balance**
```sql
id, user_id, cash, updated_at
```
- Cash balance per user (starts at $10,000)
- One record per user

#### **holdings**
```sql
id, user_id, symbol, quantity, average_price,
stop_loss, take_profit, created_at, updated_at
```
- Current crypto positions per user
- Tracks average entry price for P&L calculation

#### **trades**
```sql
id, user_id, symbol, side, quantity, price, fee, slippage,
total_cost, reasoning, recommendation_id, stop_loss, take_profit,
execution_method, initiated_by, executed_at
```
- Complete trade history per user
- Links to AI recommendations
- Tracks execution method (manual/auto/scheduled)

#### **recommendations**
```sql
id, symbol, action, confidence, entry_price, stop_loss,
take_profit_1, take_profit_2, position_size, risk_level,
reasoning (JSONB), sources (JSONB), created_at, expires_at
```
- AI-generated recommendations (shared across users)
- Only stores BUY/SELL (no HOLD)
- Expires after 24 hours

#### **discoveries**
```sql
id, symbol, name, market_cap_rank, market_cap, current_price,
volume_24h, price_change_24h, price_change_7d, volume_score,
momentum_score, sentiment_score, composite_score, sparkline (JSONB),
discovered_at
```
- Market discovery results
- Scored candidates for AI review
- Sparkline data for charts

#### **ai_review_logs**
```sql
id, review_type, status, phase, coins_analyzed,
buy_recommendations, sell_recommendations, skipped_opportunities,
error_message, metadata (JSONB), duration, timestamp
```
- System-wide logging of AI analysis runs
- Tracks success/failure, duration, results

### Entity Relationships

```
users (1) ──→ (N) portfolio_balance
users (1) ──→ (N) holdings
users (1) ──→ (N) trades
users (1) ──→ (1) settings
users (1) ──→ (N) sessions

recommendations (shared, not user-specific)
discoveries (shared, not user-specific)
ai_review_logs (system-wide logging)
```

**Key Design Principle**: All user-specific queries MUST include `user_id` in WHERE clause for data isolation.

---

## Authentication & Security

### Authentication Methods

**1. Email/Password**
- bcrypt hashing (12 salt rounds)
- Password requirements: min 8 chars, uppercase, number, special char
- Account lockout: 5 failed attempts → 15min lock

**2. Google OAuth 2.0**
- Authorization Code Flow with PKCE
- Profile data: email, display name, profile picture
- Can link to existing email account

### JWT Token Structure

**Access Token (24h):**
```json
{
  "userId": 123,
  "email": "user@example.com",
  "isAdmin": false,
  "sessionId": 456,
  "exp": 1730086400
}
```

**Refresh Token (30d):** Same payload, longer expiration

### Security Middleware Stack

```typescript
1. helmet() - CSP, HSTS, X-Frame-Options
2. cors() - CORS with credentials
3. rateLimit() - 100 requests per 15min per IP
4. cookieParser() - Secure cookie handling
5. express.json() - Body parsing with size limit
6. authenticate() - JWT validation
```

### Content Security Policy

```javascript
contentSecurityPolicy: {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "https://accounts.google.com", "https://cdn.jsdelivr.net"],
  connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://accounts.google.com"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  fontSrc: ["'self'", "https://cdn.jsdelivr.net"]
}
```

### Authentication Middleware

```typescript
export async function authenticate(req, res, next) {
  // 1. Extract token from Authorization header or cookie
  const token = extractToken(req);
  
  // 2. Verify JWT signature and expiration
  const payload = verifyToken(token);
  
  // 3. Validate session in database (check is_active)
  const session = await validateSession(token);
  if (!session) return res.status(401).json({ error: 'Invalid session' });
  
  // 4. Attach user to request
  req.user = payload;
  next();
}
```

---

## Job Scheduler System

### Bull Queue Architecture

```
Bull Queues (Redis-backed):
├── dataCollectionQueue   (prices, news, sentiment, market-context)
├── analysisQueue         (technical indicators)
├── recommendationQueue   (AI review pipeline)
├── reportQueue           (daily/weekly reports)
└── positionMonitorQueue  (stop-loss checks)
```

### Job Schedules

| Job | Schedule | Description |
|-----|----------|-------------|
| Price Collection | `*/5 * * * *` | Every 5 min - Update prices |
| News Collection | `*/15 * * * *` | Every 15 min - Fetch news |
| Sentiment | `*/30 * * * *` | Every 30 min - Reddit sentiment |
| Market Context | `0 * * * *` | Hourly - BTC dominance, regime |
| Analysis | `15 * * * *` | Hourly - Technical indicators |
| **Recommendations** | `0 */2 * * *` | Every 2 hours - AI review |
| Daily Report | `0 9 * * *` | 9 AM daily - Performance summary |
| Weekly Report | `0 9 * * 1` | Monday 9 AM - Week analysis |
| Position Monitor | `*/5 * * * *` | Every 5 min - Stop-loss checks |

### Configuration

```bash
# .env
ENABLE_JOB_SCHEDULER=true
CRON_COLLECT_PRICES=*/5 * * * *
CRON_RECOMMENDATIONS=0 */2 * * *
```

### Recommendation Processor Flow

```
1. Run discovery scan (top 25 coins)
   ↓
2. Find opportunities (buy: not owned, sell: profit/loss targets)
   ↓
3. Take top 3 buy + 3 sell
   ↓
4. For each: Fetch price, candlesticks, news, reddit, market context
   ↓
5. Send to AI (OpenAI/Anthropic) with full context
   ↓
6. Store only BUY/SELL recommendations (discard HOLD)
   ↓
7. Log results to ai_review_logs table
```

---

## Code Organization

### Design Patterns

**1. Service Layer Pattern**
- Business logic isolated in service modules
- Controllers (routes) remain thin
- Services are testable and reusable

**2. Repository Pattern**
- Database queries wrapped in service functions
- Centralized query logic
- Easier to mock for testing

**3. Middleware Chain Pattern**
- Sequential middleware for auth, validation, rate limiting
- Early return on validation failure
- Request enrichment (attach user data)

**4. Factory Pattern**
- AI service factory selects provider (OpenAI/Anthropic)
- Strategy pattern for discovery filters
- Configurable via environment variables

**5. Observer Pattern**
- Job queue emits events (completed, failed, progress)
- Winston logger subscribes to all service events
- Real-time monitoring via log streams

### Error Handling Strategy

```typescript
// Services throw errors
export async function getPortfolio(userId: number) {
  if (!userId) throw new Error('User ID required');
  const result = await query('SELECT...', [userId]);
  if (result.rows.length === 0) throw new Error('Portfolio not found');
  return result.rows[0];
}

// Controllers catch and respond
router.get('/portfolio', authenticate, async (req, res) => {
  try {
    const portfolio = await getPortfolio(req.user.userId);
    res.json(portfolio);
  } catch (error) {
    logger.error('Failed to get portfolio', { error, userId: req.user.userId });
    res.status(500).json({ error: 'Failed to retrieve portfolio' });
  }
});
```

### Logging Standards

```typescript
// Use structured logging
logger.info('Trade executed', { 
  userId, 
  symbol, 
  side, 
  quantity, 
  price 
});

logger.error('API call failed', { 
  service: 'CoinGecko', 
  symbol, 
  error: error.message,
  stack: error.stack 
});
```

### File Naming Conventions

- **Services**: `<domain>Service.ts` (e.g., `authService.ts`)
- **Routes**: `<resource>.ts` (e.g., `auth.ts`)
- **Processors**: `<job>Processor.ts` (e.g., `analysisProcessor.ts`)
- **Types**: `<domain>.ts` (e.g., `auth.ts`)
- **Utils**: `<function>.ts` (e.g., `logger.ts`)

---

## Key System Flows

### Complete Trading Workflow

```
1. User logs in → JWT token stored in localStorage
2. Dashboard loads → Fetches portfolio, trades, recommendations
3. Background jobs run:
   - Discovery scans top 25 coins every 2 hours
   - Finds buy opportunities (not owned) + sell opportunities (profit/loss targets)
   - AI analyzes top 3 of each, generates recommendations
4. User sees recommendations in UI
5. User clicks "Execute Trade"
   - Frontend calls POST /api/trade with window.auth.fetch()
   - Backend validates trade against risk limits
   - If warnings, returns for user confirmation
   - On confirmation, executes trade:
     * Updates holdings table
     * Updates portfolio_balance
     * Records trade in trades table
     * Logs execution
6. Position monitor checks stop-loss every 5 minutes
7. Daily report generated at 9 AM
```

### Data Collection Flow

```
Job Scheduler triggers → dataCollectionQueue.add({ type: 'prices' })
                          ↓
                    Queue processor starts
                          ↓
              Fetch prices from CoinGecko
                          ↓
              Store in Redis cache (TTL: 60s)
                          ↓
              Log metrics (count, duration, errors)
```

---

## Performance Considerations

### Caching Strategy

**Cache TTLs:**
- Prices: 60 seconds
- Market cap: 300 seconds (5 min)
- Sentiment: 900 seconds (15 min)
- News: 1800 seconds (30 min)
- Traditional markets: 3600 seconds (1 hour)
- Historical data: 86400 seconds (24 hours)

**Cache Keys:**
```
price:{symbol}
marketcap:{symbol}
sentiment:{symbol}
news:{symbol}:{count}
candlesticks:{symbol}:{interval}:{limit}
```

### Database Optimization

- Indexes on all foreign keys
- Indexes on frequently queried columns (symbol, timestamp)
- TimescaleDB for time-series data (future enhancement)
- Connection pooling (default: 10 connections)

### API Rate Limiting

- CoinGecko: 50 req/min (free tier)
- Alpha Vantage: 5 req/min (very limited)
- Reddit: 60 req/min
- Internal rate limiter: 100 req/15min per IP

**Mitigation**: Aggressive Redis caching reduces API calls by 80-90%

---

## Deployment Architecture

### Development Environment

```
Local Machine:
├── Node.js process (npm run dev)
├── Docker: PostgreSQL container
├── Docker: Redis container
└── Browser: localhost:3000
```

### Production Environment

```
Server:
├── Nginx (reverse proxy, SSL termination)
│   └── Port 443 (HTTPS) → Port 3000
├── Node.js process (pm2 or systemd)
├── PostgreSQL (dedicated server or managed service)
└── Redis (dedicated server or managed service)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed setup instructions.

---

## Next Steps

- **API Reference**: See [API_REFERENCE.md](./API_REFERENCE.md) for complete endpoint documentation
- **Discovery System**: See [DISCOVERY_AND_AI.md](./DISCOVERY_AND_AI.md) for tuning guide
- **Deployment**: See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup
- **Quick Start**: See [QUICKSTART.md](./QUICKSTART.md) for 10-minute setup guide

---

**Document Status**: Complete  
**Maintained By**: Development Team  
**Review Frequency**: After major features or architecture changes
