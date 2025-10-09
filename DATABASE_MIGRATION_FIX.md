# 🔧 Database Migration Fix - Discovery Error

**Error:** `ON CONFLICT (symbol)` fails because unique index doesn't exist  
**Cause:** Migration 002 hasn't been run yet  
**Solution:** Run the database migrations

---

## 🚀 Quick Fix

**Run this command:**
```bash
npm run migrate
```

**Expected output:**
```
[info]: Executing migration: 002_settings_and_discovery.sql
✅ Migration 002 completed successfully!
   - user_settings table created
   - trade_approvals table created
   - discovered_coins table created
   - execution_logs table created
   - circuit_breakers table created
[info]: Successfully executed 1 migration(s)
```

---

## ✅ Verification

After running migrations, test discovery:

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Run discovery:**
   - Open http://localhost:3000
   - Check "Force Refresh"
   - Click "Run Discovery"

3. **Should work now!** No more database errors.

---

## 📊 What the Migration Creates

### **discovered_coins table:**
- Stores automatically discovered trading opportunities
- **Unique constraint on `symbol`** (BTC, ETH, etc.)
- Tracks volume score, momentum score, sentiment score
- Composite score for ranking

### **Other tables created:**
- `user_settings` - Your trading preferences
- `trade_approvals` - Manual approval queue
- `execution_logs` - Trade history
- `circuit_breakers` - Safety halts

---

## 🔍 Check Migration Status

**See which migrations have run:**
```sql
SELECT * FROM migrations ORDER BY id;
```

**Expected:**
```
id | filename                        | executed_at
---+---------------------------------+------------------
1  | 001_initial_schema.sql          | 2025-10-09 ...
2  | 002_settings_and_discovery.sql  | 2025-10-09 ...
```

---

## ⚠️ If Migration Fails

### **Error: "Database connection failed"**
```bash
# Check if PostgreSQL is running
# Windows:
Get-Service postgresql*

# If not running, start it
Start-Service postgresql-x64-14
```

### **Error: "Database does not exist"**
```bash
# Create the database (if needed)
# Connect to PostgreSQL:
psql -U postgres

# Then:
CREATE DATABASE crypto_trading;
\q
```

### **Error: "Permission denied"**
```bash
# Update .env with correct credentials
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=crypto_trading
```

---

## 🎯 Why This Happened

**The Code:**
```typescript
ON CONFLICT (symbol) DO UPDATE SET ...
```

**Requires:**
```sql
CREATE UNIQUE INDEX idx_discovered_coins_symbol ON discovered_coins(symbol);
```

**This index is in:** `src/migrations/002_settings_and_discovery.sql`

**But it wasn't applied yet!** Migrations need to be run manually or on deployment.

---

## 🔄 Going Forward

**Always run migrations after pulling new code:**
```bash
git pull
npm run migrate  # ← Add this to your routine!
npm run dev
```

**Or add to package.json startup:**
```json
{
  "scripts": {
    "dev": "npm run migrate && concurrently \"npm run dev:server\" \"npm run dev:jobs\"",
  }
}
```

---

*Fix created: October 9, 2025*  
*Status: Run `npm run migrate` to resolve*
