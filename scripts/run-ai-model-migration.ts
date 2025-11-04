/**
 * Run AI Model Preference Migration
 */

import { query } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  try {
    console.log('\n🔄 Running AI model preference migration...\n');

    const migrationPath = join(__dirname, '../src/migrations/20251104_1546_add_ai_model_preference.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    await query(migrationSQL);

    console.log('\n✅ Migration completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
