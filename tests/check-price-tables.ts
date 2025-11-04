import { query } from '../src/config/database';

async function checkPriceTables() {
  try {
    console.log('\n🔍 Checking price-related tables...\n');

    // Check what tables exist
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%price%'
      ORDER BY table_name
    `);

    console.log('Tables with "price" in name:');
    if (tablesResult.rows.length === 0) {
      console.log('  ❌ No price tables found!\n');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
      console.log('');
    }

    // Check if prices table exists and its structure
    try {
      const pricesColumns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'prices'
        ORDER BY ordinal_position
      `);

      if (pricesColumns.rows.length > 0) {
        console.log('✅ "prices" table structure:');
        pricesColumns.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        console.log('');
      }
    } catch (e) {
      console.log('❌ "prices" table does not exist\n');
    }

    // Check if price_data table exists
    try {
      const priceDataColumns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'price_data'
        ORDER BY ordinal_position
      `);

      if (priceDataColumns.rows.length > 0) {
        console.log('✅ "price_data" table structure:');
        priceDataColumns.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}`);
        });
        console.log('');
      }
    } catch (e) {
      console.log('❌ "price_data" table does not exist\n');
    }

    console.log('═══════════════════════════════════════');
    console.log('The data collection processor is trying to insert into');
    console.log('"price_data" table, but market context needs "prices" table.');
    console.log('This mismatch is likely causing issues.');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPriceTables();
