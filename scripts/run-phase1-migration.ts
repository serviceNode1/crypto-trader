/**
 * Manually run the Phase 1 AI Efficiency migration
 */

import fs from 'fs';
import path from 'path';
import { query } from '../src/config/database';
import { logger } from '../src/utils/logger';

async function runPhase1Migration() {
  try {
    const migrationFile = '20251104_0950_ai_efficiency_optimization.sql';
    const migrationPath = path.join(__dirname, '..', 'src', 'migrations', migrationFile);
    
    console.log(`\n🚀 Running migration: ${migrationFile}\n`);
    
    // Read the SQL file
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute the SQL
    console.log('Executing SQL...\n');
    await query(sql);
    
    // Record the migration
    await query(
      'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [migrationFile]
    );
    
    console.log('✅ Migration completed successfully!\n');
    console.log('Verifying tables...\n');
    
    // Verify tables were created
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('discovery_recommendations', 'portfolio_recommendations', 'market_conditions_log')
      ORDER BY table_name
    `);
    
    console.log('Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Verify tier column
    const tierResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('tier', 'tier_updated_at')
    `);
    
    console.log('\nAdded columns to users table:');
    tierResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });
    
    console.log('\n✅ Phase 1 migration verified!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    logger.error('Phase 1 migration failed', { error });
    process.exit(1);
  }
}

runPhase1Migration();
