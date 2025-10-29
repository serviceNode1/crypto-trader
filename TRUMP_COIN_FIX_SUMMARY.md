# TRUMP Coin Symbol Collision Fix

## Problem
The app was showing incorrect prices for TRUMP coin ($0.10 instead of $8.18) because multiple coins use the "TRUMP" symbol on CoinGecko:
- **Official Trump** (coin_id: `official-trump`) - The correct one at ~$8.18
- **MAGA Trump** (coin_id: `maga-trump`) - Wrong one at ~$0.10
- Several others

The system was:
1. Discovery finding the correct TRUMP ($8.18)
2. Storing only the symbol "TRUMP" in database
3. Trading calling `getCurrentPrice("TRUMP")` 
4. Symbol lookup returning the wrong TRUMP ($0.10)

## Solution

### 1. Database Migration ✅
**File:** `src/migrations/002_add_coin_id_to_discovered_coins.sql`

Adds `coin_id` column to `discovered_coins` table to store the exact CoinGecko ID.

### 2. Backend Changes ✅

**Discovery Service** (`src/services/discovery/coinDiscovery.ts`):
- Added `coinId` field to `CoinCandidate` interface
- Captures `coin.id` from CoinGecko API response
- Stores `coin_id` in database alongside symbol
- Retrieves `coin_id` when loading discoveries

**Price Service** (`src/services/dataCollection/coinGeckoService.ts`):
- Updated `getCurrentPrice(symbol, coinId?)` to accept optional `coinId`
- When `coinId` provided, uses it directly instead of symbol lookup
- Prevents symbol collision issues

### 3. Deployment Steps

1. **Upload files to Cloudways:**
   ```
   src/migrations/002_add_coin_id_to_discovered_coins.sql
   src/migrations/run.ts (updated version)
   src/services/discovery/coinDiscovery.ts
   src/services/dataCollection/coinGeckoService.ts
   ```

2. **Run migration on server:**
   ```bash
   cd /home/master/applications/daazqmdevc/public_html
   npm run migrate
   ```

3. **Rebuild app:**
   ```bash
   npm run build
   ```

4. **Restart Node.js:**
   ```bash
   # Kill existing process
   ps aux | grep node
   kill [process_id]
   
   # Start fresh
   nohup node dist/app.js > logs/app.log 2>&1 &
   ```

5. **Run fresh discovery:**
   - Go to Discovery page
   - Check "Force Refresh"
   - Click "Run Discovery"
   - This will populate the new `coin_id` column

## Testing

After deployment:
1. Run discovery with force refresh
2. Find TRUMP in discoveries list
3. Click to analyze or trade TRUMP
4. Verify price shows ~$8.18 (correct Official Trump)
5. Preview a trade - price should match discovery price

## Technical Details

### Database Schema
```sql
ALTER TABLE discovered_coins 
ADD COLUMN coin_id VARCHAR(100);

CREATE INDEX idx_discovered_coins_coin_id 
ON discovered_coins(coin_id);
```

### API Flow
```
Discovery → CoinGecko markets API
  ↓ returns coin.id = "official-trump"
  ↓
Store in DB: { symbol: "TRUMP", coin_id: "official-trump", price: 8.18 }
  ↓
Trading fetches: SELECT coin_id FROM discovered_coins WHERE symbol = 'TRUMP'
  ↓
Get price: getCurrentPrice("TRUMP", "official-trump")
  ↓ 
Uses coin_id directly → Returns correct price $8.18
```

## Files Modified

1. ✅ `src/migrations/002_add_coin_id_to_discovered_coins.sql` - NEW
2. ✅ `src/services/discovery/coinDiscovery.ts` - MODIFIED
3. ✅ `src/services/dataCollection/coinGeckoService.ts` - MODIFIED

## Backward Compatibility

- Legacy discoveries without `coin_id` fall back to symbol-based lookup
- No breaking changes to existing functionality
- Gradual migration as new discoveries are run

## Future Improvements

Consider:
- Frontend: Pass `coinId` through trading modal
- API: Add `/price/:symbol/:coinId` endpoint
- UI: Show coin_id in discovery table for transparency
