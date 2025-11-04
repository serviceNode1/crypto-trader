# Migration Strategy Guide

**Date:** November 4, 2025  
**Purpose:** Establish consistent migration practices for local development and production deployments

---

## Migration Naming Convention

### ✅ Use Timestamp-Based Names

**Format:** `YYYYMMDD_HHMM_description.sql`

**Examples:**
- `20251104_0950_ai_efficiency_optimization.sql`
- `20251105_1430_add_user_preferences.sql`
- `20251110_0900_fix_portfolio_constraints.sql`

**Benefits:**
- No numbering conflicts between environments
- Clear chronological order
- Easy to identify when migration was created
- Works across multiple developers/branches

### ❌ Avoid Sequential Numbers

**Don't use:** `001_`, `002_`, `003_`, etc.

**Why:**
- Conflicts when files are deleted
- Breaks when different environments have different migration histories
- Difficult to merge branches with new migrations

---

## Migration Best Practices

### 1. Make Migrations Idempotent

Always use `IF NOT EXISTS` and `DO $$` blocks:

```sql
-- ✅ GOOD - Safe to run multiple times
CREATE TABLE IF NOT EXISTS my_table (...);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'new_column'
  ) THEN
    ALTER TABLE users ADD COLUMN new_column VARCHAR(50);
  END IF;
END $$;

-- ❌ BAD - Fails if already exists
CREATE TABLE my_table (...);
ALTER TABLE users ADD COLUMN new_column VARCHAR(50);
```

### 2. Include Rollback Information

Add comments explaining how to rollback if needed:

```sql
-- Migration: Add user tier system
-- Rollback: DROP TABLE discovery_recommendations; 
--           ALTER TABLE users DROP COLUMN tier;
```

### 3. Test Locally First

```bash
# 1. Run migration locally
npm run migrate

# 2. Verify with custom script
npx ts-node scripts/verify-migration.ts

# 3. Test application functionality

# 4. Only then deploy to production
```

### 4. Add Descriptive Comments

```sql
--
-- AI Efficiency Optimization - Phase 1
-- Date: 2025-11-04
-- Description: Split BUY/SELL recommendations, add user tiers
--
-- This migration is safe to run multiple times (uses IF NOT EXISTS)
--
```

---

## Running Migrations

### Local Development

```bash
# Standard migration runner
npm run migrate

# Manual execution (if needed)
npx ts-node scripts/run-phase1-migration.ts

# Verify migration
npx ts-node scripts/verify-migration.ts
```

### Production Deployment

```bash
# 1. SSH into production server
ssh user@production-server

# 2. Navigate to application directory
cd /path/to/app

# 3. Pull latest code
git pull origin main

# 4. Run migrations
npm run migrate

# 5. Verify (optional but recommended)
npx ts-node scripts/verify-migration.ts

# 6. Restart application
pm2 restart app
```

---

## Current Migration Files

### Production (`001_initial_schema.sql`)
- Contains consolidated schema from initial deployment
- Includes all tables, indexes, constraints
- Generated from `pg_dump` of production database

### Development
- May have additional migrations from local testing
- Should be kept in sync with production
- Use timestamp-based naming for new migrations

---

## Troubleshooting

### Migration Not Running

**Check:**
1. File is in `src/migrations/` directory
2. File ends with `.sql`
3. File is not already in `migrations` table:
   ```sql
   SELECT * FROM migrations WHERE filename = 'your_migration.sql';
   ```

**Solution:**
```bash
# Manually run the migration
npx ts-node scripts/run-phase1-migration.ts
```

### Migration Conflicts

**If you have numbering conflicts:**
1. Rename to timestamp format: `YYYYMMDD_HHMM_description.sql`
2. Delete from migrations table if needed:
   ```sql
   DELETE FROM migrations WHERE filename = 'old_name.sql';
   ```
3. Re-run migration

### Production vs Local Mismatch

**If production and local schemas differ:**
1. Generate fresh schema from production:
   ```bash
   pg_dump -h production-host -U user -d database --schema-only > 001_initial_schema.sql
   ```
2. Reset local database to match production
3. Apply new migrations on top

---

## Migration Checklist

Before deploying a migration to production:

- [ ] Migration uses timestamp-based naming
- [ ] Migration is idempotent (uses IF NOT EXISTS)
- [ ] Migration tested locally
- [ ] Application tested with new schema
- [ ] Rollback plan documented
- [ ] Migration committed to git
- [ ] Production backup created
- [ ] Migration executed on production
- [ ] Production application restarted
- [ ] Production functionality verified

---

## Scripts Reference

### Verify Migration
```bash
npx ts-node scripts/verify-migration.ts
```
Checks if Phase 1 tables and columns exist.

### List Migrations
```bash
npx ts-node scripts/list-migration-files.ts
```
Shows migration files vs executed migrations.

### Check Migrations
```bash
npx ts-node scripts/check-migrations.ts
```
Lists all executed migrations from database.

### Manual Migration Run
```bash
npx ts-node scripts/run-phase1-migration.ts
```
Manually executes a specific migration file.

---

**Last Updated:** November 4, 2025  
**Maintained By:** Development Team
