# API Reference Documentation

**Crypto AI Trading Intelligence System**  
**Last Updated:** October 27, 2025  
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Auth Endpoints](#auth-endpoints)
6. [Portfolio Endpoints](#portfolio-endpoints)
7. [Trading Endpoints](#trading-endpoints)
8. [Analysis Endpoints](#analysis-endpoints)
9. [Discovery Endpoints](#discovery-endpoints)
10. [Recommendation Endpoints](#recommendation-endpoints)
11. [Settings Endpoints](#settings-endpoints)
12. [System Endpoints](#system-endpoints)

---

## Overview

### Base URL

**Development**: `http://localhost:3000`  
**Production**: `https://your-domain.com`

All API endpoints are prefixed with `/api` (except auth routes which are under `/api/auth`).

### Content Type

All requests and responses use `application/json`.

### Date Format

All timestamps are in ISO 8601 format: `2025-10-27T14:30:00.000Z`

---

## Authentication

### Authentication Methods

1. **JWT Bearer Token** (preferred)
2. **Cookie-based session** (automatic)

### Using JWT Tokens

Include the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifecycle

- **Access Token**: 24 hours validity
- **Refresh Token**: 30 days validity

When access token expires, use the refresh token to obtain a new access token via `/api/auth/refresh`.

### Protected Endpoints

Endpoints marked with 🔒 require authentication.

---

## Error Handling

### Standard Error Response

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | External service unavailable |

### Common Error Examples

**Invalid Credentials:**
```json
{
  "error": "Invalid email or password"
}
```

**Validation Error:**
```json
{
  "error": "Validation failed",
  "message": "Password must be at least 8 characters"
}
```

**Rate Limit:**
```json
{
  "error": "Too many requests",
  "message": "Please try again in 15 minutes"
}
```

---

## Rate Limiting

### Limits

- **Global**: 100 requests per 15 minutes per IP address
- **Login**: 5 failed attempts per account triggers 15-minute lockout

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1730042400
```

When limit exceeded:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 900
```

---

## Auth Endpoints

### Register User

**POST** `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "displayName": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "John Doe",
    "emailVerified": false,
    "isActive": true,
    "isAdmin": false,
    "createdAt": "2025-10-27T14:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-10-28T14:30:00.000Z"
}
```

**Errors:**
- `400`: Email already registered
- `400`: Password validation failed

---

### Login

**POST** `/api/auth/login`

Authenticate with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "displayName": "John Doe",
    "emailVerified": true,
    "isActive": true,
    "isAdmin": false,
    "lastLogin": "2025-10-27T14:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-10-28T14:30:00.000Z"
}
```

**Errors:**
- `401`: Invalid email or password
- `401`: Account locked due to failed attempts
- `401`: Account deactivated

---

### Refresh Token

**POST** `/api/auth/refresh`

Obtain a new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2025-10-28T14:30:00.000Z"
}
```

**Errors:**
- `401`: Invalid or expired refresh token
- `401`: Session expired or invalid

---

### Logout

**POST** `/api/auth/logout` 🔒

Invalidate current session.

**Headers:**
```http
Authorization: Bearer {token}
```

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

---

### Google OAuth - Initiate

**GET** `/api/auth/google`

Redirects to Google OAuth consent screen.

**Query Parameters:**
- None

**Response:**
- Redirect to Google OAuth page

---

### Google OAuth - Callback

**GET** `/api/auth/google/callback`

Handles Google OAuth callback.

**Query Parameters:**
- `code`: Authorization code from Google

**Response:**
- Redirect to dashboard with session cookie set

---

## Portfolio Endpoints

### Get Portfolio

**GET** `/api/portfolio` 🔒

Get current portfolio state including cash balance and holdings.

**Response:** `200 OK`
```json
{
  "cash": 7523.45,
  "positions": [
    {
      "symbol": "BTC",
      "quantity": 0.05,
      "averagePrice": 45000.00,
      "currentPrice": 48000.00,
      "marketValue": 2400.00,
      "unrealizedPnL": 150.00,
      "unrealizedPnLPercent": 6.67,
      "stopLoss": 43000.00,
      "takeProfit": null
    },
    {
      "symbol": "ETH",
      "quantity": 1.2,
      "averagePrice": 2800.00,
      "currentPrice": 3100.00,
      "marketValue": 3720.00,
      "unrealizedPnL": 360.00,
      "unrealizedPnLPercent": 10.71,
      "stopLoss": null,
      "takeProfit": 3500.00
    }
  ],
  "totalValue": 13643.45,
  "totalCost": 13493.45,
  "totalPnL": 150.00,
  "totalPnLPercent": 1.11
}
```

---

### Get Performance Metrics

**GET** `/api/portfolio/performance` 🔒

Get performance metrics for the portfolio.

**Response:** `200 OK`
```json
{
  "totalReturn": 364.50,
  "totalReturnPercent": 3.65,
  "sharpeRatio": 1.42,
  "maxDrawdown": -2.35,
  "maxDrawdownPercent": -0.24,
  "winRate": 58.33,
  "avgWin": 125.50,
  "avgLoss": -85.20,
  "profitFactor": 1.47,
  "totalTrades": 12,
  "winningTrades": 7,
  "losingTrades": 5
}
```

---

### Get Risk Exposure

**GET** `/api/portfolio/risk` 🔒

Get current risk exposure metrics.

**Response:** `200 OK`
```json
{
  "totalExposure": 6120.00,
  "totalExposurePercent": 44.85,
  "maxPositionSize": 682.17,
  "maxPositionSizePercent": 5.00,
  "openPositions": 2,
  "maxOpenPositions": 5,
  "availablePositions": 3,
  "portfolioAtRisk": 612.00,
  "portfolioAtRiskPercent": 4.48,
  "maxPortfolioRisk": 2046.52,
  "maxPortfolioRiskPercent": 15.00
}
```

---

### Get Portfolio History

**GET** `/api/portfolio/history` 🔒

Get portfolio value history over time.

**Response:** `200 OK`
```json
[
  {
    "timestamp": "2025-10-20T09:00:00.000Z",
    "totalValue": 10000.00
  },
  {
    "timestamp": "2025-10-21T09:00:00.000Z",
    "totalValue": 10125.50
  },
  {
    "timestamp": "2025-10-27T14:30:00.000Z",
    "totalValue": 13643.45
  }
]
```

---

## Trading Endpoints

### Get Trade History

**GET** `/api/trades` 🔒

Get paginated trade history.

**Query Parameters:**
- `limit` (optional): Number of trades per page (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Example:**
```http
GET /api/trades?limit=20&offset=0
```

**Response:** `200 OK`
```json
{
  "trades": [
    {
      "id": 45,
      "symbol": "BTC",
      "side": "BUY",
      "quantity": 0.05,
      "price": 45000.00,
      "fee": 2.25,
      "slippage": 0.15,
      "totalCost": 2252.40,
      "reasoning": "Strong bullish momentum, oversold RSI",
      "recommendationId": 123,
      "stopLoss": 43000.00,
      "takeProfit": null,
      "executionMethod": "manual",
      "initiatedBy": "user",
      "executedAt": "2025-10-27T10:15:00.000Z"
    }
  ],
  "total": 12,
  "page": 1,
  "perPage": 20
}
```

---

### Execute Trade

**POST** `/api/trade` 🔒

Execute a manual trade (with risk warnings).

**Request Body:**
```json
{
  "symbol": "BTC",
  "side": "BUY",
  "quantity": 0.05,
  "stopLoss": 43000.00,
  "takeProfit": 50000.00,
  "reasoning": "Bullish technical indicators",
  "recommendationId": 123,
  "confirmWarnings": false
}
```

**Response (Warnings):** `200 OK`
```json
{
  "requiresConfirmation": true,
  "warnings": [
    "Position size exceeds 4% of portfolio",
    "No recent news available for this symbol"
  ],
  "message": "This trade has risk warnings. Please review and confirm."
}
```

**Response (Success):** `201 Created`
```json
{
  "id": 46,
  "symbol": "BTC",
  "side": "BUY",
  "quantity": 0.05,
  "price": 45125.00,
  "fee": 2.26,
  "slippage": 0.18,
  "totalCost": 2258.69,
  "executedAt": "2025-10-27T14:30:00.000Z"
}
```

**Errors:**
- `400`: Missing required fields (symbol, side, quantity)
- `403`: Trade not allowed (risk limits exceeded)
- `500`: Insufficient funds or position limit reached

---

### Get Trade Count

**GET** `/api/trades/count` 🔒

Get total number of trades (legacy endpoint).

**Response:** `200 OK`
```json
{
  "count": 12
}
```

---

## Analysis Endpoints

### Get Analysis (Without AI)

**GET** `/api/analysis/:symbol`

Get comprehensive technical and sentiment analysis without AI recommendation.

**Example:**
```http
GET /api/analysis/BTC
```

**Response:** `200 OK`
```json
{
  "symbol": "BTC",
  "currentPrice": 48125.00,
  "technical": {
    "indicators": {
      "rsi": 62.5,
      "macd": {
        "value": 125.5,
        "signal": 110.2,
        "histogram": 15.3
      },
      "bollingerBands": {
        "upper": 49500.00,
        "middle": 47000.00,
        "lower": 44500.00
      },
      "sma20": 46800.00,
      "sma50": 45200.00,
      "ema12": 47500.00,
      "ema26": 46200.00,
      "volume": 25000000000
    },
    "trend": {
      "trend": "bullish",
      "strength": 7.5,
      "confidence": 0.82
    }
  },
  "sentiment": {
    "overall": {
      "score": 0.65,
      "magnitude": 0.8,
      "classification": "positive"
    },
    "reddit": {
      "score": 0.72,
      "magnitude": 0.85,
      "classification": "positive"
    },
    "news": {
      "score": 0.58,
      "magnitude": 0.75,
      "classification": "positive"
    },
    "mentionVolume": 1250,
    "velocity": 125,
    "credibilityWeighted": 0.68
  },
  "marketContext": {
    "btcDominance": 52.5,
    "totalMarketCap": 2150000000000,
    "marketRegime": "bull_market",
    "riskSentiment": "greed",
    "volatilityIndex": 35.2,
    "regime": {
      "regime": "bull_market",
      "confidence": 0.85,
      "description": "Strong uptrend with high confidence"
    }
  },
  "news": [
    {
      "title": "Bitcoin reaches new all-time high",
      "published": "2025-10-27T12:00:00.000Z",
      "source": "CryptoPanic",
      "url": "https://..."
    }
  ],
  "timestamp": "2025-10-27T14:30:00.000Z"
}
```

---

### Get Analysis With AI

**GET** `/api/analyze/:symbol`

Get comprehensive analysis WITH AI recommendation.

**Query Parameters:**
- `model` (optional): AI model to use - `local`, `anthropic`, `openai`, `both` (default: `anthropic`)

**Example:**
```http
GET /api/analyze/BTC?model=anthropic
```

**Response:** `200 OK`
```json
{
  "symbol": "BTC",
  "currentPrice": 48125.00,
  "technical": { ... },
  "sentiment": { ... },
  "marketContext": { ... },
  "recommendation": {
    "action": "BUY",
    "confidence": 78,
    "entryPrice": 48000.00,
    "stopLoss": 45500.00,
    "takeProfitLevels": [50000.00, 52000.00],
    "positionSize": 0.04,
    "riskLevel": "MEDIUM",
    "reasoning": {
      "technical": "Strong bullish momentum with RSI at 62.5",
      "sentiment": "Overwhelmingly positive sentiment across news and social",
      "marketContext": "Bull market regime with greed sentiment",
      "risk": "Medium risk due to recent volatility"
    },
    "sources": ["technical_analysis", "sentiment_analysis", "market_context", "ai_claude"]
  },
  "news": [...],
  "candlesticks": [...],
  "timestamp": "2025-10-27T14:30:00.000Z"
}
```

---

### Generate AI Recommendation

**POST** `/api/analyze/:symbol`

Generate and store AI recommendation for a symbol.

**Example:**
```http
POST /api/analyze/BTC
```

**Request Body:**
```json
{
  "useMultipleModels": false
}
```

**Response:** `200 OK`
```json
{
  "id": 124,
  "symbol": "BTC",
  "action": "BUY",
  "confidence": 78,
  "entryPrice": 48000.00,
  "stopLoss": 45500.00,
  "takeProfitLevels": [50000.00, 52000.00],
  "positionSize": 0.04,
  "riskLevel": "MEDIUM",
  "reasoning": {...},
  "sources": ["technical_analysis", "sentiment_analysis", "ai_claude"]
}
```

---

### Get Sentiment

**GET** `/api/sentiment/:symbol`

Get sentiment analysis for a specific symbol.

**Example:**
```http
GET /api/sentiment/ETH
```

**Response:** `200 OK`
```json
{
  "symbol": "ETH",
  "sentiment": {
    "overall": {
      "score": 0.58,
      "magnitude": 0.75,
      "classification": "positive"
    },
    "reddit": {
      "score": 0.65,
      "magnitude": 0.8,
      "classification": "positive"
    },
    "news": {
      "score": 0.51,
      "magnitude": 0.7,
      "classification": "neutral"
    },
    "mentionVolume": 850,
    "velocity": 95,
    "credibilityWeighted": 0.62,
    "sources": {
      "reddit": 45,
      "news": 18
    }
  },
  "timestamp": "2025-10-27T14:30:00.000Z"
}
```

---

## Discovery Endpoints

### Run Discovery

**GET** `/api/discover`

Discover trading opportunities by scanning the market.

**Query Parameters:**
- `universe` (optional): `top10`, `top25`, `top50`, `top100` (default: `top25`)
- `strategy` (optional): `conservative`, `moderate`, `aggressive` (default: `moderate`)
- `forceRefresh` (optional): `true` or `false` (default: `false`)

**Example:**
```http
GET /api/discover?universe=top50&strategy=moderate&forceRefresh=true
```

**Response:** `200 OK`
```json
{
  "universe": "top50",
  "count": 8,
  "candidates": [
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "marketCapRank": 2,
      "marketCap": 380000000000,
      "currentPrice": 3150.00,
      "volume24h": 15000000000,
      "priceChange24h": 5.2,
      "priceChange7d": 12.8,
      "volumeScore": 85,
      "momentumScore": 78,
      "sentimentScore": 72,
      "compositeScore": 78.5,
      "sparkline": [3000, 3020, 3050, ...]
    }
  ],
  "analysisLog": [...],
  "summary": {
    "totalAnalyzed": 50,
    "passed": 8,
    "rejected": 42,
    "topRejectionReasons": [
      { "reason": "Low volume", "count": 18 },
      { "reason": "Weak momentum", "count": 15 }
    ]
  },
  "timestamp": "2025-10-27T14:30:00.000Z",
  "executionTime": 2850,
  "forceRefresh": true
}
```

---

### Get Top Discoveries

**GET** `/api/discover/top`

Get top discovered coins from database (cached results).

**Query Parameters:**
- `limit` (optional): Number of results (default: 10)

**Example:**
```http
GET /api/discover/top?limit=5
```

**Response:** `200 OK`
```json
{
  "count": 5,
  "discoveries": [
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "compositeScore": 78.5,
      "volumeScore": 85,
      "momentumScore": 78,
      "sentimentScore": 72,
      "currentPrice": 3150.00,
      "priceChange24h": 5.2,
      "discoveredAt": "2025-10-27T12:00:00.000Z"
    }
  ]
}
```

---

## Recommendation Endpoints

### Get Recommendations

**GET** `/api/recommendations`

Get current active AI recommendations (BUY/SELL only, no HOLD).

**Query Parameters:**
- `limit` (optional): Number of recommendations (default: 10)

**Example:**
```http
GET /api/recommendations?limit=5
```

**Response:** `200 OK`
```json
[
  {
    "id": 123,
    "symbol": "BTC",
    "action": "BUY",
    "confidence": 78,
    "entryPrice": 48000.00,
    "stopLoss": 45500.00,
    "takeProfitLevels": [50000.00, 52000.00],
    "positionSize": 0.04,
    "riskLevel": "MEDIUM",
    "reasoning": {...},
    "sources": {...},
    "createdAt": "2025-10-27T12:00:00.000Z",
    "expiresAt": "2025-10-28T12:00:00.000Z"
  }
]
```

---

### Generate Recommendations

**POST** `/api/recommendations/generate`

Manually trigger AI recommendation generation for top opportunities.

**Request Body:**
```json
{
  "maxBuy": 3,
  "maxSell": 3,
  "debugMode": false
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Generated 2 BUY and 1 SELL recommendations",
  "buyRecommendations": [...],
  "sellRecommendations": [...],
  "skipped": {
    "buy": 2,
    "sell": 1
  },
  "metadata": {
    "totalAnalyzed": 6,
    "totalOpportunities": 9,
    "aiRejected": {
      "buy": 1,
      "sell": 2
    }
  }
}
```

---

## Settings Endpoints

### Get Settings

**GET** `/api/settings` 🔒

Get user settings.

**Response:** `200 OK`
```json
{
  "id": 1,
  "userId": 123,
  "coinUniverse": "top25",
  "analysisFrequency": 4,
  "theme": "dark",
  "notificationsEnabled": true,
  "autoTradingEnabled": false,
  "riskTolerance": "moderate",
  "createdAt": "2025-10-20T09:00:00.000Z",
  "updatedAt": "2025-10-27T14:30:00.000Z"
}
```

---

### Update Settings

**PUT** `/api/settings` 🔒

Update user settings.

**Request Body:**
```json
{
  "coinUniverse": "top50",
  "analysisFrequency": 2,
  "theme": "blue",
  "notificationsEnabled": true,
  "autoTradingEnabled": false,
  "riskTolerance": "aggressive"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "userId": 123,
  "coinUniverse": "top50",
  "analysisFrequency": 2,
  "theme": "blue",
  "notificationsEnabled": true,
  "autoTradingEnabled": false,
  "riskTolerance": "aggressive",
  "updatedAt": "2025-10-27T14:35:00.000Z"
}
```

---

### Reset Settings

**POST** `/api/settings/reset` 🔒

Reset settings to defaults.

**Response:** `200 OK`
```json
{
  "id": 1,
  "userId": 123,
  "coinUniverse": "top25",
  "analysisFrequency": 4,
  "theme": "dark",
  "notificationsEnabled": true,
  "autoTradingEnabled": false,
  "riskTolerance": "moderate"
}
```

---

## System Endpoints

### Health Check

**GET** `/api/health`

Check system health status.

**Response:** `200 OK` (healthy) or `503 Service Unavailable` (degraded)
```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T14:30:00.000Z",
  "services": {
    "database": "up",
    "redis": "up"
  }
}
```

---

### Get Market Context

**GET** `/api/market-context`

Get global cryptocurrency market context.

**Response:** `200 OK`
```json
{
  "context": {
    "btcDominance": 52.5,
    "totalMarketCap": 2150000000000,
    "marketRegime": "bull_market",
    "riskSentiment": "greed",
    "volatilityIndex": 35.2,
    "traditionalMarkets": {
      "sp500": 4785.50,
      "sp500Change": 0.85,
      "gold": 2045.20,
      "vix": 15.8
    }
  },
  "regime": {
    "regime": "bull_market",
    "confidence": 0.85,
    "description": "Strong uptrend with high confidence"
  },
  "timestamp": "2025-10-27T14:30:00.000Z"
}
```

---

### Get Price

**GET** `/api/price/:symbol`

Get current price for a specific cryptocurrency.

**Example:**
```http
GET /api/price/BTC
```

**Response:** `200 OK`
```json
{
  "symbol": "BTC",
  "price": 48125.00
}
```

---

### Get Auto-Trading Stats

**GET** `/api/auto-trading/stats`

Get statistics for auto-trading system.

**Response:** `200 OK`
```json
{
  "execution": {
    "totalExecuted": 5,
    "successRate": 100.0,
    "avgExecutionTime": 1250,
    "lastExecution": "2025-10-27T10:00:00.000Z"
  },
  "monitoring": {
    "activePositions": 2,
    "stopLossTriggered": 1,
    "takeProfitTriggered": 0,
    "lastCheck": "2025-10-27T14:30:00.000Z"
  }
}
```

---

## Frontend Integration Example

### Using the AuthManager

```javascript
// Initialize AuthManager
const auth = new AuthManager();

// Login
const loginData = await auth.login('user@example.com', 'SecurePass123!');
// Tokens automatically stored in localStorage

// Make authenticated API calls
const portfolio = await window.auth.fetch('http://localhost:3000/api/portfolio');
const data = await portfolio.json();

// Token refresh happens automatically on 401
// If refresh fails, user is redirected to login
```

### Example: Execute Trade

```javascript
async function executeTrade(symbol, side, quantity) {
  try {
    const response = await window.auth.fetch('http://localhost:3000/api/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        side,
        quantity,
        reasoning: 'User manual trade',
        confirmWarnings: true
      })
    });
    
    if (!response) {
      // Auth failed, user redirected
      return null;
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const trade = await response.json();
    console.log('Trade executed:', trade);
    return trade;
  } catch (error) {
    console.error('Trade failed:', error);
    throw error;
  }
}
```

---

## Rate Limiting Best Practices

1. **Cache aggressively**: Frontend should cache data when possible
2. **Batch requests**: Combine multiple requests where possible
3. **Handle 429 errors**: Implement exponential backoff
4. **Check headers**: Monitor X-RateLimit-Remaining

---

## WebSocket Support

**Status**: Not currently implemented. All communication is via REST API with polling.

**Future Enhancement**: Real-time updates via WebSocket planned for v2.0.

---

**Document Status**: Complete  
**Maintained By**: Development Team  
**Review Frequency**: After API changes
