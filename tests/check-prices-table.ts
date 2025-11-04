import { query } from '../src/config/database';

async function checkPricesTable() {
  try {
    console.log('\n🔍 Checking prices table...\n');

    // Check if table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prices'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ prices table does not exist\n');
      process.exit(1);
    }

    console.log('✅ prices table exists\n');

    // Check for BTC data
    const btcCheck = await query(`
      SELECT COUNT(*) as count, 
             MIN(time) as oldest,
             MAX(time) as newest
      FROM prices
      WHERE symbol = 'BTC'
    `);

    console.log('BTC price data:');
    console.log(`  Total records: ${btcCheck.rows[0].count}`);
    console.log(`  Oldest: ${btcCheck.rows[0].oldest || 'N/A'}`);
    console.log(`  Newest: ${btcCheck.rows[0].newest || 'N/A'}\n`);

    if (parseInt(btcCheck.rows[0].count) === 0) {
      console.log('⚠️  No BTC price data found - this is why market context is failing!\n');
      console.log('Solution: Run data collection to populate prices table\n');
    }

    // Check all symbols
    const symbolsCheck = await query(`
      SELECT symbol, COUNT(*) as count
      FROM prices
      GROUP BY symbol
      ORDER BY count DESC
      LIMIT 10
    `);

    if (symbolsCheck.rows.length > 0) {
      console.log('Top symbols in prices table:');
      symbolsCheck.rows.forEach(row => {
        console.log(`  ${row.symbol}: ${row.count} records`);
      });
    }

    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPricesTable();
