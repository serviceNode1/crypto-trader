/**
 * Verify Phase 1 migration completed successfully
 */

import { query } from '../src/config/database';
import { logger } from '../src/utils/logger';

async function verifyMigration() {
  try {
    console.log('🔍 Verifying Phase 1 migration...\n');

    // 1. Check if new tables exist
    console.log('1. Checking new tables...');
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('discovery_recommendations', 'portfolio_recommendations', 'market_conditions_log')
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log('   Found tables:', tables);
    
    if (tables.length === 3) {
      console.log('   ✅ All 3 new tables created\n');
    } else {
      console.log('   ❌ Missing tables:', ['discovery_recommendations', 'portfolio_recommendations', 'market_conditions_log'].filter(t => !tables.includes(t)));
      console.log('');
    }

    // 2. Check tier column in users table
    console.log('2. Checking users table tier column...');
    const tierColumnResult = await query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('tier', 'tier_updated_at')
      ORDER BY column_name
    `);

    console.log('   Found columns:', tierColumnResult.rows.map(r => `${r.column_name} (${r.data_type})`));
    
    if (tierColumnResult.rows.length === 2) {
      console.log('   ✅ Tier columns added to users table\n');
    } else {
      console.log('   ❌ Tier columns missing\n');
    }

    // 3. Check discovery_recommendations table structure
    console.log('3. Checking discovery_recommendations structure...');
    const discoveryColumnsResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'discovery_recommendations'
      ORDER BY ordinal_position
    `);

    console.log('   Columns:', discoveryColumnsResult.rows.map(r => r.column_name).join(', '));
    
    const requiredColumns = ['id', 'symbol', 'strategy', 'coin_universe', 'confidence', 'discovery_score'];
    const hasAllColumns = requiredColumns.every(col => 
      discoveryColumnsResult.rows.some(r => r.column_name === col)
    );
    
    if (hasAllColumns) {
      console.log('   ✅ All required columns present\n');
    } else {
      console.log('   ❌ Missing columns\n');
    }

    // 4. Check portfolio_recommendations table structure
    console.log('4. Checking portfolio_recommendations structure...');
    const portfolioColumnsResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'portfolio_recommendations'
      ORDER BY ordinal_position
    `);

    console.log('   Columns:', portfolioColumnsResult.rows.map(r => r.column_name).join(', '));
    
    const requiredPortfolioColumns = ['id', 'user_id', 'symbol', 'confidence', 'sell_reason', 'percent_gain'];
    const hasAllPortfolioColumns = requiredPortfolioColumns.every(col => 
      portfolioColumnsResult.rows.some(r => r.column_name === col)
    );
    
    if (hasAllPortfolioColumns) {
      console.log('   ✅ All required columns present\n');
    } else {
      console.log('   ❌ Missing columns\n');
    }

    // 5. Check indexes
    console.log('5. Checking indexes...');
    const indexesResult = await query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('discovery_recommendations', 'portfolio_recommendations')
      ORDER BY tablename, indexname
    `);

    console.log('   Indexes found:', indexesResult.rows.length);
    indexesResult.rows.forEach(r => {
      console.log(`   - ${r.tablename}: ${r.indexname}`);
    });
    console.log('');

    // 6. Check constraints
    console.log('6. Checking constraints...');
    const constraintsResult = await query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid IN (
        SELECT oid FROM pg_class 
        WHERE relname IN ('discovery_recommendations', 'portfolio_recommendations', 'users')
      )
      AND conname LIKE '%tier%' OR conname LIKE '%strategy%' OR conname LIKE '%sell_reason%'
      ORDER BY conname
    `);

    console.log('   Constraints found:', constraintsResult.rows.length);
    constraintsResult.rows.forEach(r => {
      const type = r.contype === 'c' ? 'CHECK' : r.contype === 'f' ? 'FOREIGN KEY' : r.contype;
      console.log(`   - ${r.conname} (${type})`);
    });
    console.log('');

    // 7. Check migration record
    console.log('7. Checking migration record...');
    const migrationResult = await query(`
      SELECT filename, executed_at 
      FROM migrations 
      WHERE filename LIKE '%003%'
      ORDER BY executed_at DESC
    `);

    if (migrationResult.rows.length > 0) {
      console.log('   ✅ Migration recorded:', migrationResult.rows[0].filename);
      console.log('   Executed at:', migrationResult.rows[0].executed_at);
    } else {
      console.log('   ⚠️  Migration not recorded in migrations table');
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════');
    console.log('VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════');
    
    const allChecks = [
      tables.length === 3,
      tierColumnResult.rows.length === 2,
      hasAllColumns,
      hasAllPortfolioColumns,
      indexesResult.rows.length > 0,
    ];
    
    const passedChecks = allChecks.filter(Boolean).length;
    console.log(`Passed: ${passedChecks}/${allChecks.length} checks`);
    
    if (passedChecks === allChecks.length) {
      console.log('✅ Migration verified successfully!');
    } else {
      console.log('⚠️  Some checks failed - review output above');
    }
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    logger.error('Verification failed', { error });
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyMigration();
