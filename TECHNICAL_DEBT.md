# Technical Debt & Refactoring Backlog

## 🎨 UI/UX Improvements

### 1. CSS Refactoring (Priority: Medium)

**Current State:**
- Inline styles scattered throughout `index.html`
- No CSS variables for theming
- No dark mode support
- Difficult to maintain consistency

**Proposed Solution:**
```
public/
├── index.html
├── styles/
│   ├── variables.css      # CSS custom properties
│   ├── base.css          # Reset, typography, common
│   ├── components.css    # Reusable components
│   ├── modals.css        # Modal styles
│   ├── dashboard.css     # Dashboard-specific
│   └── themes/
│       ├── light.css     # Light theme
│       └── dark.css      # Dark theme
```

**CSS Variables to Extract:**
```css
:root {
  /* Colors */
  --primary: #667eea;
  --primary-dark: #764ba2;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-600: #4b5563;
  --gray-700: #374151;
  --gray-800: #1f2937;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Typography */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/* Dark Mode */
[data-theme="dark"] {
  --background: #111827;
  --surface: #1f2937;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --border: #374151;
}
```

**Implementation Steps:**
1. Create `/public/styles/` directory structure
2. Extract all inline styles to CSS files
3. Replace hardcoded colors with variables
4. Add theme toggle to settings modal
5. Store theme preference in localStorage
6. Test all components in both themes

**Estimated Effort:** 1-2 days  
**Benefits:**
- ✅ Dark mode support
- ✅ Easier to maintain consistency
- ✅ Faster to add new themes (high-contrast, etc.)
- ✅ Better performance (CSS caching)
- ✅ Professional code organization

**Timing:** After auto-trading implementation (Week 2 → Week 3 transition)

---

### 2. Component Architecture (Priority: Low)

**Current State:**
- Monolithic `index.html` file (2000+ lines)
- All JavaScript inline in `<script>` tags
- No module system

**Future Enhancement:**
- Consider React/Vue/Svelte for complex UI
- Or at least split into vanilla JS modules

**Timing:** Version 2.0 (after v1.0 is stable)

---

## 🔧 Backend Improvements

### 3. Settings Management (Priority: High)

**Current State:**
- Settings only in localStorage (frontend)
- No backend persistence
- No API endpoints

**Required for Auto-Trading:**
- Backend settings table (see AUTO_TRADING_IMPLEMENTATION_PLAN.md)
- GET/PUT `/api/settings` endpoints
- Settings sync between frontend/backend

**Timing:** Week 1 of auto-trading implementation (REQUIRED)

---

### 4. Error Handling & Logging (Priority: Medium)

**Current State:**
- Basic try/catch blocks
- Limited error context
- No error tracking service

**Improvements:**
```typescript
// Structured error logging
interface TradingError {
  code: string;
  message: string;
  context: {
    symbol?: string;
    action?: string;
    userId?: number;
  };
  timestamp: Date;
  stack?: string;
}

// Error tracking service (future)
- Sentry integration
- Error rate monitoring
- Alert on critical errors
```

**Timing:** Week 2-3 (after core features stable)

---

### 5. Testing Infrastructure (Priority: High)

**Current State:**
- No unit tests
- No integration tests
- Manual testing only

**Required:**
```
tests/
├── unit/
│   ├── services/
│   │   ├── autoExecutor.test.ts
│   │   ├── positionMonitor.test.ts
│   │   └── riskManagement.test.ts
│   └── utils/
│       └── calculations.test.ts
├── integration/
│   ├── api/
│   │   └── settings.test.ts
│   └── trading/
│       └── endToEnd.test.ts
└── fixtures/
    └── mockData.ts
```

**Timing:** Week 3 (before production deployment)

---

## 📊 Database Optimizations

### 6. Query Performance (Priority: Low)

**Current State:**
- No indexes on frequently queried columns
- No query optimization
- No connection pooling strategy

**Future Optimizations:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_trades_symbol_date ON trades(symbol, executed_at DESC);
CREATE INDEX idx_recommendations_status ON recommendations(execution_status, created_at DESC);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);

-- Materialized views for dashboards
CREATE MATERIALIZED VIEW daily_performance AS
  SELECT ... -- Complex aggregation
REFRESH MATERIALIZED VIEW daily_performance;
```

**Timing:** When performance becomes an issue (>1000 trades)

---

### 7. Data Retention Policy (Priority: Low)

**Current State:**
- Unlimited data retention
- No archival strategy

**Future:**
- Archive trades older than 1 year
- Summarize to monthly metrics
- Reduce storage costs

**Timing:** Version 2.0

---

## 🔒 Security Enhancements

### 8. API Authentication (Priority: Medium)

**Current State:**
- No authentication
- No rate limiting per user
- Single-user system

**Future (Multi-User):**
```typescript
// JWT authentication
POST /api/auth/login
POST /api/auth/register
GET /api/auth/me

// User-scoped settings
GET /api/users/:id/settings
GET /api/users/:id/portfolio
```

**Timing:** Version 2.0 (if going multi-user)

---

### 9. API Key Security (Priority: Medium)

**Current State:**
- API keys in `.env` file
- No encryption at rest
- Keys visible in backend logs

**Improvements:**
- Use environment-specific key vaults
- Encrypt sensitive keys in database
- Mask keys in logs

**Timing:** Before production deployment

---

## 📦 Code Organization

### 10. Service Layer Separation (Priority: Low)

**Current State:**
- Services mixed with data access
- Business logic in route handlers

**Better Architecture:**
```
src/
├── api/          # Express routes only
├── services/     # Business logic
├── repositories/ # Data access layer (NEW)
├── models/       # TypeScript interfaces
└── utils/        # Pure utility functions
```

**Timing:** Version 2.0 refactor

---

## 🚀 Performance Optimizations

### 11. Frontend Optimization (Priority: Low)

**Improvements:**
- Minify JS/CSS
- Lazy load modals
- Implement virtual scrolling for large tables
- Add service worker for offline support

**Timing:** After feature complete

---

### 12. API Response Caching (Priority: Low)

**Current State:**
- Redis caching on data sources
- No HTTP cache headers

**Improvements:**
```typescript
// Add cache headers
res.set('Cache-Control', 'public, max-age=60');
res.set('ETag', generateETag(data));

// Conditional requests
if (req.headers['if-none-match'] === etag) {
  return res.status(304).end();
}
```

**Timing:** When performance becomes critical

---

## 📱 Mobile & Responsive

### 13. Mobile Optimization (Priority: Medium)

**Current State:**
- Responsive design exists
- Not optimized for mobile trading

**Improvements:**
- Mobile-first CSS refactor
- Touch-optimized controls
- Progressive Web App (PWA)
- Push notifications

**Timing:** Week 4-5 (after auto-trading stable)

---

## 🎯 Priority Matrix

```
High Priority (Do Soon):
├── Settings Backend (Week 1) ⚠️ REQUIRED for auto-trading
├── Testing Infrastructure (Week 3)
└── API Key Security (Before production)

Medium Priority (Next Quarter):
├── CSS Refactoring (Week 2→3 transition) 👈 YOUR QUESTION
├── Error Tracking
├── Mobile Optimization
└── API Authentication (if multi-user)

Low Priority (Future):
├── Component Architecture
├── Database Optimizations
├── Data Retention
├── Performance Tuning
└── Service Layer Separation
```

---

## 📝 How to Use This Document

**When Adding Technical Debt:**
1. Describe current state
2. Explain proposed solution
3. Estimate effort
4. Set priority
5. Define timing

**Before Starting Refactor:**
1. Confirm features are stable
2. Write tests for current behavior
3. Refactor in small chunks
4. Test after each change
5. Document breaking changes

**Review Cadence:**
- Weekly: Check high priority items
- Monthly: Re-prioritize based on pain points
- Quarterly: Plan major refactors

---

## 🎨 CSS Refactoring Detailed Plan

### Phase 1: Extract Variables (2 hours)
```css
/* variables.css */
:root {
  /* All color, spacing, typography variables */
}
```

### Phase 2: Component Styles (4 hours)
```css
/* components.css */
.button { /* Extract from inline styles */ }
.card { /* Extract from inline styles */ }
.modal { /* Already extracted */ }
.toggle-switch { /* Already extracted */ }
```

### Phase 3: Dark Theme (2 hours)
```css
/* themes/dark.css */
[data-theme="dark"] {
  /* Override variables */
}
```

### Phase 4: Settings Toggle (1 hour)
```typescript
// Add to settings modal
function toggleTheme(theme: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}
```

### Phase 5: Testing (1 hour)
- Test all components in both themes
- Check contrast ratios (accessibility)
- Verify localStorage persistence

**Total Effort: 10 hours (1.5 days)**

---

## ✅ Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-10-08 | Defer CSS refactor | Focus on auto-trading features first |
| 2025-10-08 | Settings UI uses inline styles | Speed of development > perfect architecture |

---

**Status**: 📋 Active  
**Last Updated**: 2025-10-08  
**Next Review**: After Week 2 (Auto-trading implementation)
