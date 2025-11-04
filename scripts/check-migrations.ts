import { query } from '../src/config/database';

async function checkMigrations() {
  try {
    const result = await query(`
      SELECT filename, executed_at 
      FROM migrations 
      ORDER BY executed_at
    `);

    console.log('\n📋 Executed Migrations:\n');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.filename}`);
      console.log(`   Executed: ${row.executed_at}\n`);
    });

    console.log(`Total: ${result.rows.length} migrations executed\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMigrations();
