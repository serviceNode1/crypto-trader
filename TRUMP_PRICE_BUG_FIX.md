# 🚨 CRITICAL BUG FIX: Incorrect Price for TRUMP Token

## The Problem

**Symptom:** TRUMP token was showing price of $0.12 instead of actual price $6.56

**Impact:** 
- Stop-loss was incorrectly triggered at $0.12 when set at $6.00
- Position monitoring was using wrong price data
- Could cause premature sells or incorrect trade decisions

## Root Cause Analysis

### 1. Multiple Tokens with Same Symbol
CoinGecko has multiple tokens with the symbol "TRUMP":
- `"official-trump"` - Market Cap Rank: **~70** - Price: **$6.56** ✅ (CORRECT)
- `"trump"` - Market Cap Rank: **much lower** - Price: **$0.12** ❌ (WRONG ONE)

### 2. Symbol Lookup Logic Flaw
Location: `src/services/dataCollection/coinListService.ts`

**OLD CODE (BROKEN):**
```typescript
const exactMatch = coins.find(
  (coin) => coin.symbol.toUpperCase() === symbol.toUpperCase()
);
return exactMatch ? exactMatch.id : null;
```

**Problem:** Returns the FIRST match found, which could be the wrong token!

## The Fix

### 1. Improved Symbol Lookup (coinListService.ts)

**NEW CODE:**
```typescript
// Find ALL exact symbol matches
const exactMatches = coins.filter(
  (coin) => coin.symbol.toUpperCase() === symbol.toUpperCase()
);

if (exactMatches.length === 0) {
  return null;
}

// If multiple matches, prefer the one with highest market cap rank (lowest number)
const bestMatch = exactMatches.sort((a, b) => {
  if (a.market_cap_rank === undefined) return 1;
  if (b.market_cap_rank === undefined) return -1;
  return a.market_cap_rank - b.market_cap_rank;
})[0];

logger.info('Found exact symbol match', { 
  symbol, 
  coinId: bestMatch.id,
  coinName: bestMatch.name,
  marketCapRank: bestMatch.market_cap_rank,
  totalMatches: exactMatches.length
});

return bestMatch.id;
```

**Solution:** 
- Finds ALL tokens with matching symbol
- Sorts by market cap rank (lower = more popular)
- Returns the most popular/legitimate token
- Logs details for debugging

### 2. Added Cache Clearing Function

New function: `clearCachedMapping(symbol)` in `coinListService.ts`
- Clears incorrect mappings from database cache
- Removes from in-memory map
- Forces fresh lookup on next price fetch

### 3. Added API Endpoint

**DELETE** `/api/coin-mapping/:symbol`

Allows manual clearing of bad cached mappings:
```bash
curl -X DELETE http://localhost:3001/api/coin-mapping/TRUMP
```

## How to Fix TRUMP Right Now

### Option 1: Clear Cache via API (Recommended)
```bash
curl -X DELETE http://localhost:3001/api/coin-mapping/TRUMP
```

### Option 2: Clear Database Directly
```sql
DELETE FROM coin_id_mappings WHERE symbol = 'TRUMP';
```

### Option 3: Restart Server
The improved lookup logic will automatically find the correct token on next search.

## Testing the Fix

1. **Clear the bad mapping:**
   ```bash
   curl -X DELETE http://localhost:3001/api/coin-mapping/TRUMP
   ```

2. **Fetch price again:**
   ```bash
   curl http://localhost:3001/api/price/TRUMP
   ```

3. **Expected result:**
   - Should return price around $6.56 (official-trump token)
   - Logs should show: `coinId: "official-trump"`, `marketCapRank: ~70`

4. **Monitor position monitoring logs:**
   - Watch for correct price in next monitoring cycle
   - Stop-loss should NOT trigger at $0.12 anymore

## Prevention

This fix prevents future issues by:
1. ✅ Always selecting highest market cap token when multiple symbols exist
2. ✅ Logging detailed coin selection info for debugging
3. ✅ Providing tools to manually fix bad mappings
4. ✅ Improved search algorithm prioritizes legitimate tokens

## Files Changed

1. `src/services/dataCollection/coinListService.ts`
   - Improved `searchForCoinId()` function
   - Added `clearCachedMapping()` function
   
2. `src/api/routes.ts`
   - Added DELETE `/api/coin-mapping/:symbol` endpoint

## Next Steps

1. **Rebuild the project:**
   ```bash
   npm run build
   ```

2. **Restart the server:**
   ```bash
   npm start
   ```

3. **Clear TRUMP mapping:**
   ```bash
   curl -X DELETE http://localhost:3001/api/coin-mapping/TRUMP
   ```

4. **Verify correct price** on next position monitoring cycle

## Additional Notes

- This bug could affect ANY token with duplicate symbols on CoinGecko
- The fix is generic and will handle all future cases automatically
- Consider adding a periodic cache validation job
- May want to add market cap rank to database cache for faster filtering

---

**Status:** ✅ FIXED - Awaiting compilation and deployment
**Priority:** 🔴 CRITICAL - Deploy immediately
**Risk:** High - Affects stop-loss execution and trade decisions
