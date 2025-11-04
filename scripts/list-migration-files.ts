import fs from 'fs';
import path from 'path';
import { query } from '../src/config/database';

async function listMigrations() {
  try {
    // Get files in migrations directory
    const migrationsDir = path.join(__dirname, '..', 'src', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log('\n📁 Migration files in directory:\n');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    console.log(`\nTotal: ${files.length} .sql files\n`);

    // Get executed migrations from database
    const result = await query(`
      SELECT filename, executed_at 
      FROM migrations 
      ORDER BY executed_at DESC
      LIMIT 5
    `);

    console.log('📋 Last 5 executed migrations:\n');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.filename}`);
      console.log(`   Executed: ${row.executed_at}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listMigrations();
