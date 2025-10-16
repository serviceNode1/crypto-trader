# Multi-User Architecture Plan
## Comprehensive Design for User Accounts, Authentication & Portfolio Management

**Date:** October 15, 2025  
**Status:** Planning Phase  
**Impact:** High - Requires significant database & architecture changes

---

## 📋 Table of Contents
1. [Current System Analysis](#current-system-analysis)
2. [Database Schema Changes](#database-schema-changes)
3. [Authentication System](#authentication-system)
4. [Navigation & UI Changes](#navigation--ui-changes)
5. [Account Management Features](#account-management-features)
6. [Real Money vs Paper Money](#real-money-vs-paper-money)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Security Considerations](#security-considerations)

---

## 🔍 Current System Analysis

### **Current Architecture:**
- **Single-user system** - No user authentication
- **Shared state** - All data belongs to one user
- **No isolation** - Portfolio, trades, settings are global

### **Existing Tables (Inferred):**
```
portfolio_balance
├─ id (PRIMARY KEY)
├─ cash (DECIMAL)
└─ updated_at (TIMESTAMP)

holdings
├─ symbol (VARCHAR)
├─ quantity (DECIMAL)
├─ average_price (DECIMAL)
├─ stop_loss (DECIMAL, nullable)
└─ take_profit (DECIMAL, nullable)

trades
├─ id (PRIMARY KEY)
├─ symbol (VARCHAR)
├─ side (VARCHAR) - 'BUY'/'SELL'
├─ quantity (DECIMAL)
├─ price (DECIMAL)
├─ fee (DECIMAL)
├─ slippage (DECIMAL)
├─ total_cost (DECIMAL)
├─ reasoning (TEXT)
├─ recommendation_id (INTEGER)
└─ executed_at (TIMESTAMP)

recommendations
├─ id (PRIMARY KEY)
├─ symbol (VARCHAR)
├─ action (VARCHAR) - 'BUY'/'SELL'
├─ confidence (INTEGER)
├─ entry_price (DECIMAL)
├─ stop_loss (DECIMAL)
├─ take_profit_1 (DECIMAL)
├─ take_profit_2 (DECIMAL)
├─ position_size (DECIMAL)
├─ risk_level (VARCHAR)
├─ reasoning (TEXT)
├─ sources (JSONB)
├─ execution_status (VARCHAR)
├─ created_at (TIMESTAMP)
└─ expires_at (TIMESTAMP)

ai_review_logs
├─ id (PRIMARY KEY)
├─ review_type (VARCHAR)
├─ status (VARCHAR)
├─ phase (VARCHAR)
├─ coins_analyzed (INTEGER)
├─ buy_recommendations (INTEGER)
├─ sell_recommendations (INTEGER)
├─ skipped_opportunities (INTEGER)
├─ error_message (TEXT)
├─ metadata (JSONB)
├─ duration (INTEGER)
└─ timestamp (TIMESTAMP)

trade_approvals
├─ id (PRIMARY KEY)
├─ recommendation_id (INTEGER)
├─ status (VARCHAR)
└─ created_at (TIMESTAMP)

execution_logs
├─ id (PRIMARY KEY)
├─ recommendation_id (INTEGER)
├─ trade_id (INTEGER)
├─ execution_method (VARCHAR)
├─ success (BOOLEAN)
└─ executed_at (TIMESTAMP)
```

### **❌ Multi-User Issues:**
1. **No user_id columns** - Can't isolate data per user
2. **No users table** - No place to store user info
3. **No authentication** - No login/logout
4. **Shared cash balance** - Single portfolio_balance record
5. **Global settings** - Stored in localStorage (client-side only)

---

## 🗄️ Database Schema Changes

### **1. Create Users Table**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- NULL for OAuth-only users
  display_name VARCHAR(100),
  google_id VARCHAR(255) UNIQUE, -- For Google OAuth
  avatar_url TEXT,
  account_type VARCHAR(20) DEFAULT 'paper', -- 'paper', 'real', 'demo'
  account_status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'closed'
  settings JSONB DEFAULT '{}', -- User preferences
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
```

### **2. Create Sessions Table**
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
```

### **3. Add user_id to Existing Tables**

**❗ MAJOR MIGRATION REQUIRED:**

```sql
-- Add user_id column to all main tables
ALTER TABLE portfolio_balance ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE holdings ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trades ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE recommendations ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ai_review_logs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE trade_approvals ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE execution_logs ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Add NOT NULL constraints after migrating existing data
-- (First, assign all existing data to a default/system user)
UPDATE portfolio_balance SET user_id = 1 WHERE user_id IS NULL;
UPDATE holdings SET user_id = 1 WHERE user_id IS NULL;
UPDATE trades SET user_id = 1 WHERE user_id IS NULL;
UPDATE recommendations SET user_id = 1 WHERE user_id IS NULL;
UPDATE ai_review_logs SET user_id = 1 WHERE user_id IS NULL;
UPDATE trade_approvals SET user_id = 1 WHERE user_id IS NULL;
UPDATE execution_logs SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE portfolio_balance ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE holdings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trades ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE recommendations ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_review_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE trade_approvals ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE execution_logs ALTER COLUMN user_id SET NOT NULL;

-- Create indexes for faster queries
CREATE INDEX idx_portfolio_balance_user ON portfolio_balance(user_id);
CREATE INDEX idx_holdings_user ON holdings(user_id);
CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_recommendations_user ON recommendations(user_id);
CREATE INDEX idx_ai_review_logs_user ON ai_review_logs(user_id);
CREATE INDEX idx_trade_approvals_user ON trade_approvals(user_id);
CREATE INDEX idx_execution_logs_user ON execution_logs(user_id);

-- Composite indexes for common queries
CREATE INDEX idx_holdings_user_symbol ON holdings(user_id, symbol);
CREATE INDEX idx_trades_user_date ON trades(user_id, executed_at DESC);
CREATE INDEX idx_recommendations_user_status ON recommendations(user_id, execution_status);
```

### **4. Create Account Management Tables**

```sql
-- Paper money account resets
CREATE TABLE account_resets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reset_type VARCHAR(20) DEFAULT 'paper_money', -- 'paper_money', 'hard_reset'
  previous_balance DECIMAL(20, 8),
  new_balance DECIMAL(20, 8),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_resets_user ON account_resets(user_id);

-- Real money integration (future)
CREATE TABLE payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(20), -- 'bank_account', 'credit_card', 'crypto_wallet'
  provider VARCHAR(50), -- 'stripe', 'coinbase', 'alpaca'
  provider_account_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'failed'
  is_primary BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);

-- Deposit/Withdrawal tracking
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'deposit', 'withdrawal', 'transfer'
  amount DECIMAL(20, 8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  payment_method_id INTEGER REFERENCES payment_methods(id),
  external_id VARCHAR(255), -- Provider transaction ID
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
```

---

## 🔐 Authentication System

### **A. Email/Password Authentication**

#### **Registration Flow:**
```
1. User submits email + password
2. Hash password with bcrypt (salt rounds: 12)
3. Generate verification token
4. Send verification email
5. Create user record (email_verified: false)
6. Create initial portfolio_balance (paper money: $10,000)
7. Return success (but require email verification to trade)
```

#### **Login Flow:**
```
1. User submits email + password
2. Look up user by email
3. Compare password hash
4. Check account_status (must be 'active')
5. Generate session token (JWT or UUID)
6. Store in user_sessions table
7. Update last_login_at
8. Return token + user info
```

#### **Password Reset Flow:**
```
1. User requests reset via email
2. Generate password_reset_token (expires in 1 hour)
3. Send reset email with link
4. User clicks link → validate token
5. User submits new password
6. Hash and update password
7. Invalidate reset token
8. Log out all sessions
```

### **B. Google OAuth Integration**

#### **Google OAuth Flow:**
```
1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent screen
3. Google returns authorization code
4. Exchange code for access token + ID token
5. Verify ID token with Google
6. Extract user info (email, name, picture, google_id)
7. Check if user exists by google_id or email
   - If exists: Log in
   - If not: Create new user (email_verified: true)
8. Generate session token
9. Return token + user info
```

#### **Implementation:**
```typescript
// Backend
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

async function verifyGoogleToken(token: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}
```

#### **Frontend:**
```html
<!-- index.html -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<div id="g_id_onload"
     data-client_id="YOUR_CLIENT_ID"
     data-callback="handleGoogleLogin">
</div>
<div class="g_id_signin" data-type="standard"></div>
```

### **C. Session Management**

#### **Session Storage:**
- **Token Type:** JWT (JSON Web Token) or UUID
- **Storage:** HTTP-only cookie + Authorization header
- **Expiration:** 7 days (configurable)
- **Refresh:** Sliding window (extend on activity)

#### **Middleware:**
```typescript
// src/middleware/auth.ts
export async function requireAuth(req, res, next) {
  const token = req.cookies.session_token || 
                req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const session = await getSessionByToken(token);
  
  if (!session || session.expires_at < new Date()) {
    return res.status(401).json({ error: 'Session expired' });
  }
  
  const user = await getUserById(session.user_id);
  
  if (!user || user.account_status !== 'active') {
    return res.status(403).json({ error: 'Account not active' });
  }
  
  req.user = user;
  next();
}
```

---

## 🧭 Navigation & UI Changes

### **1. New Header/Navigation**

**Before (Current):**
```
[ 🪙 Crypto Trading Bot ]
```

**After (Multi-User):**
```
[ 🪙 Crypto Trading Bot ] [ Portfolio ] [ Trades ] [ Docs ] [ Account ▾ ]
                                                              ├─ Settings
                                                              ├─ Account Info
                                                              ├─ Billing (if real money)
                                                              └─ Logout
```

### **2. Login/Signup Page**

**Route:** `/login`

**Layout:**
```
┌─────────────────────────────────────────┐
│                                         │
│    🪙 Crypto Trading Bot                │
│                                         │
│    Sign in to your account              │
│                                         │
│    ┌─────────────────────────────┐     │
│    │  Email                      │     │
│    └─────────────────────────────┘     │
│    ┌─────────────────────────────┐     │
│    │  Password                   │     │
│    └─────────────────────────────┘     │
│                                         │
│    [ Forgot Password? ]                 │
│                                         │
│    ┌─────────────────────────────┐     │
│    │      Sign In                │     │
│    └─────────────────────────────┘     │
│                                         │
│    ────────── OR ──────────             │
│                                         │
│    ┌─────────────────────────────┐     │
│    │  G  Sign in with Google     │     │
│    └─────────────────────────────┘     │
│                                         │
│    Don't have an account?               │
│    [ Create Account ]                   │
│                                         │
└─────────────────────────────────────────┘
```

### **3. Account Settings Page**

**Route:** `/account/settings`

**Sections:**
```
┌─ Profile Information ─────────────────┐
│ Display Name: [______________]        │
│ Email: user@example.com (verified ✓)  │
│ Avatar: [Upload] [Remove]             │
└───────────────────────────────────────┘

┌─ Security ────────────────────────────┐
│ [ Change Password ]                   │
│ Connected Accounts:                   │
│   • Google: connected ✓               │
│ Active Sessions: 2                    │
│ [ View Sessions ] [ Log Out All ]     │
└───────────────────────────────────────┘

┌─ Account Type ────────────────────────┐
│ Current: Paper Trading ($10,000)      │
│ [ Upgrade to Real Money Trading ]     │
│ [ Reset Paper Money Account ]         │
└───────────────────────────────────────┘

┌─ Trading Settings ────────────────────┐
│ (Move current settings here)          │
│ - Trading Mode                        │
│ - Confidence Threshold                │
│ - Position Sizing                     │
│ - Coin Universe                       │
│ etc.                                  │
└───────────────────────────────────────┘

┌─ Danger Zone ─────────────────────────┐
│ [ Delete Account ] (Permanent!)       │
└───────────────────────────────────────┘
```

### **4. Info/Docs Navigation**

**New Section:**
```
┌─ Documentation ───────────────────────┐
│ • Getting Started Guide               │
│ • How AI Recommendations Work         │
│ • Trading Strategies Explained        │
│ • Risk Management Tips                │
│ • API Documentation                   │
│ • FAQ                                 │
└───────────────────────────────────────┘
```

---

## 💰 Account Management Features

### **1. Paper Money Account**

#### **Initial Setup:**
- New user gets **$10,000** paper money
- Reset anytime (with confirmation)
- Track reset history

#### **Reset Flow:**
```typescript
async function resetPaperAccount(userId: number) {
  await transaction(async (client) => {
    // 1. Get current balance
    const current = await client.query(
      'SELECT cash FROM portfolio_balance WHERE user_id = $1',
      [userId]
    );
    
    // 2. Log the reset
    await client.query(`
      INSERT INTO account_resets (user_id, reset_type, previous_balance, new_balance, reason)
      VALUES ($1, 'paper_money', $2, $3, 'User requested reset')
    `, [userId, current.rows[0].cash, 10000]);
    
    // 3. Clear holdings
    await client.query('DELETE FROM holdings WHERE user_id = $1', [userId]);
    
    // 4. Archive old trades (optional - or keep for history)
    // await client.query('DELETE FROM trades WHERE user_id = $1', [userId]);
    
    // 5. Reset cash to $10,000
    await client.query(`
      UPDATE portfolio_balance 
      SET cash = 10000, updated_at = NOW() 
      WHERE user_id = $1
    `, [userId]);
    
    // 6. Clear pending recommendations
    await client.query(`
      UPDATE recommendations 
      SET execution_status = 'cancelled' 
      WHERE user_id = $1 AND execution_status = 'pending'
    `, [userId]);
  });
}
```

#### **UI:**
```
┌─ Paper Money Account ─────────────────┐
│ Current Balance: $8,543.21            │
│ Total P&L: -$1,456.79 (-14.57%)       │
│                                       │
│ ⚠️  Reset will:                       │
│   • Set balance to $10,000            │
│   • Close all positions               │
│   • Cancel pending orders             │
│   • Keep trade history (optional)     │
│                                       │
│ [ Cancel ] [ 🔄 Reset Account ]       │
└───────────────────────────────────────┘
```

### **2. Real Money Integration (Future)**

#### **Broker/Exchange Options:**
1. **Alpaca** (Stocks + Crypto)
2. **Coinbase Advanced Trade** (Crypto only)
3. **Interactive Brokers** (Stocks + Crypto)
4. **Kraken** (Crypto only)

#### **Real Money Flow:**
```
1. User upgrades account
2. Complete KYC verification
3. Connect payment method
4. Deposit funds
5. System trades with REAL API
6. Track real P&L
7. Withdraw profits
```

#### **Implementation Considerations:**
```typescript
interface RealMoneyConfig {
  brokerType: 'alpaca' | 'coinbase' | 'ibkr' | 'kraken';
  apiKey: string; // Encrypted!
  apiSecret: string; // Encrypted!
  accountId: string;
  environment: 'paper' | 'live'; // Start with broker's paper trading
}

// Store encrypted credentials
async function saveRealMoneyCredentials(userId: number, config: RealMoneyConfig) {
  const encrypted = await encrypt(JSON.stringify({
    apiKey: config.apiKey,
    apiSecret: config.apiSecret
  }));
  
  await query(`
    INSERT INTO payment_methods (user_id, method_type, provider, provider_account_id, metadata)
    VALUES ($1, 'broker_api', $2, $3, $4)
  `, [userId, config.brokerType, config.accountId, { encrypted }]);
}
```

#### **Safety Features:**
- **Daily Loss Limits:** Stop trading if loss > X%
- **Maximum Position Size:** Cap per-trade amount
- **Require 2FA:** For real money operations
- **Withdrawal Delays:** Prevent instant withdrawals
- **Audit Logs:** Track every action

---

## 🚀 Implementation Roadmap

### **Phase 1: Database Migration**
- [ ] Create users table
- [ ] Create sessions table
- [ ] Add user_id to all existing tables
- [ ] Create migration script
- [ ] Test migration on staging database
- [ ] Migrate existing data to default user (id: 1)

### **Phase 2: Authentication Backend**
- [ ] Implement email/password auth service
- [ ] Create registration endpoint
- [ ] Create login endpoint
- [ ] Create password reset flow
- [ ] Implement session management
- [ ] Add auth middleware to all routes
- [ ] Test auth flow

### **Phase 3: Google OAuth**
- [ ] Set up Google Cloud Console project
- [ ] Implement OAuth backend
- [ ] Create OAuth callback endpoint
- [ ] Test Google login flow
- [ ] Handle account linking (email match)

### **Phase 4: Frontend Auth UI**
- [ ] Create login page
- [ ] Create signup page
- [ ] Create password reset page
- [ ] Add Google sign-in button
- [ ] Implement client-side session management
- [ ] Add protected route guards
- [ ] Create account dropdown menu
- [ ] Add logout functionality

### **Phase 5: User Isolation**
- [ ] Update all API routes to filter by user_id
- [ ] Update portfolio service
- [ ] Update trading service
- [ ] Update recommendations service
- [ ] Update AI review logger
- [ ] Test multi-user data isolation
- [ ] Fix any cross-user data leaks

### **Phase 6: Account Management**
- [ ] Create account settings page
- [ ] Implement profile editing
- [ ] Add password change
- [ ] Create paper money reset feature
- [ ] Add account deletion
- [ ] Create session management UI
- [ ] Add account reset history

### **Phase 7: Navigation & UX**
- [ ] Redesign header/navigation
- [ ] Add user menu dropdown
- [ ] Create docs/info section
- [ ] Add welcome/onboarding flow
- [ ] Improve mobile responsiveness
- [ ] Add loading states
- [ ] Polish UI/UX

### **Phase 8: Testing & Security**
- [ ] Security audit
- [ ] Penetration testing
- [ ] Load testing (concurrent users)
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation updates

### **Phase 9: Real Money (Future)**
- [ ] Research broker APIs
- [ ] Implement Alpaca integration
- [ ] Add KYC verification
- [ ] Create payment processing
- [ ] Add deposit/withdrawal
- [ ] Implement 2FA
- [ ] Add real trading safeguards
- [ ] Extensive testing
- [ ] Legal/compliance review

---

## 🔒 Security Considerations

### **1. Password Security**
- **Bcrypt hashing:** Salt rounds: 12
- **Password requirements:** Min 8 chars, 1 uppercase, 1 number, 1 special
- **No password storage:** Never log passwords
- **Rate limiting:** Max 5 login attempts per 15 min

### **2. Session Security**
- **HTTP-only cookies:** Prevent XSS attacks
- **Secure flag:** HTTPS only in production
- **CSRF tokens:** Protect form submissions
- **Short expiration:** 7 days max, refresh on activity

### **3. Data Isolation**
- **User ID validation:** Every query checks user_id
- **Row-level security:** PostgreSQL policies (optional)
- **No user enumeration:** Generic error messages
- **Audit logging:** Track sensitive operations

### **4. API Security**
- **Rate limiting:** 100 requests per minute per user
- **Input validation:** Sanitize all inputs
- **SQL injection prevention:** Parameterized queries
- **XSS prevention:** Content Security Policy headers
- **CORS configuration:** Restrict origins

### **5. Real Money Security (Future)**
- **2FA required:** TOTP (Google Authenticator)
- **Encrypted credentials:** AES-256 encryption
- **Withdrawal verification:** Email + SMS confirmation
- **Daily limits:** Cap withdrawals
- **Suspicious activity detection:** Alert on unusual patterns

---

## 📊 Database Queries After Migration

### **All queries must include user_id:**

#### **Before:**
```sql
SELECT * FROM holdings WHERE quantity > 0;
```

#### **After:**
```sql
SELECT * FROM holdings WHERE user_id = $1 AND quantity > 0;
```

### **Service Layer Changes:**

```typescript
// Before
export async function getPortfolio(): Promise<Portfolio> {
  const balanceResult = await query(
    'SELECT cash FROM portfolio_balance ORDER BY id DESC LIMIT 1'
  );
  // ...
}

// After
export async function getPortfolio(userId: number): Promise<Portfolio> {
  const balanceResult = await query(
    'SELECT cash FROM portfolio_balance WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [userId]
  );
  // ...
}
```

### **All functions need userId parameter:**
```typescript
// Portfolio
getPortfolio(userId)
executeTrade(userId, trade)
getHoldings(userId)

// Recommendations
generateRecommendations(userId, params)
getPendingRecommendations(userId)

// Trades
getTradeHistory(userId, limit)
getPerformanceMetrics(userId)

// Settings
getUserSettings(userId)
updateUserSettings(userId, settings)
```

---

## ✅ Migration Checklist

### **Pre-Migration:**
- [ ] Backup entire database
- [ ] Test migration on copy of production data
- [ ] Document rollback procedure
- [ ] Schedule maintenance window
- [ ] Notify users (if any existing users)

### **Migration:**
- [ ] Run migration script
- [ ] Create default system user (id: 1)
- [ ] Assign all existing data to system user
- [ ] Verify data integrity
- [ ] Test basic operations

### **Post-Migration:**
- [ ] Verify all queries work with user_id
- [ ] Check performance with indexes
- [ ] Monitor error logs
- [ ] Update API documentation
- [ ] Deploy new frontend

---

## 💡 Additional Features to Consider

### **User Experience:**
- [ ] Email notifications (trade executed, reset password, etc.)
- [ ] Activity feed (recent trades, recommendations)
- [ ] Portfolio analytics (charts, insights)
- [ ] Social features (optional - leaderboard, sharing)
- [ ] Mobile app (React Native)

### **Admin Panel:**
- [ ] User management
- [ ] System monitoring
- [ ] AI review logs (all users)
- [ ] Performance metrics
- [ ] Ban/suspend users

### **Subscription Tiers (Monetization):**
- **Free:** Paper trading, basic features, AI reviews every 4h
- **Pro:** $10/month, AI reviews every 1h, priority support
- **Premium:** $50/month, Real money trading, custom strategies

---

## 🎯 Success Criteria

**System is ready when:**
1. ✅ Multiple users can register and log in
2. ✅ Each user has isolated portfolio/trades
3. ✅ Google OAuth works seamlessly
4. ✅ Password reset flow works
5. ✅ Paper money reset works
6. ✅ All existing features work with auth
7. ✅ No cross-user data leakage
8. ✅ Performance is acceptable (< 500ms for most queries)
9. ✅ Security audit passes
10. ✅ Documentation is complete

---

## 📝 Notes

### **Current System Preservation:**
- Existing single-user data will be preserved
- Migration assigns all current data to user ID 1
- No data loss during migration
- Can run in "single-user mode" if needed (bypass auth for localhost)

### **Development Strategy:**
- **Feature flags:** Enable/disable multi-user mode
- **Backward compatibility:** Support both modes temporarily
- **Incremental rollout:** Test with small user group first
- **Monitoring:** Track errors, performance, user feedback

---

**This is a comprehensive plan. Estimated timeline: 6-8 weeks for full implementation (excluding real money integration).**

**Priority: Start with Phase 1 (Database Migration) as it's the foundation for everything else.**
