import { query } from '../src/config/database';

async function checkScheduledJobs() {
  try {
    console.log('\n🔍 Checking if scheduled jobs are running...\n');

    // Check if there's any recent data collection activity
    const checks = [
      { name: 'Prices', table: 'prices', timeColumn: 'time' },
      { name: 'News', table: 'crypto_news', timeColumn: 'published_at' },
      { name: 'Sentiment', table: 'reddit_mentions', timeColumn: 'created_at' },
      { name: 'Market Context', table: 'market_context', timeColumn: 'timestamp' },
    ];

    for (const check of checks) {
      try {
        const result = await query(`
          SELECT COUNT(*) as total,
                 MAX(${check.timeColumn}) as latest
          FROM ${check.table}
          WHERE ${check.timeColumn} > NOW() - INTERVAL '1 hour'
        `);

        const total = parseInt(result.rows[0].total);
        const latest = result.rows[0].latest;

        if (total > 0) {
          console.log(`✅ ${check.name}: ${total} records in last hour`);
          console.log(`   Latest: ${latest}\n`);
        } else {
          console.log(`❌ ${check.name}: No recent data (last hour)`);
          
          // Check if table has ANY data
          const anyData = await query(`SELECT COUNT(*) as count FROM ${check.table}`);
          const count = parseInt(anyData.rows[0].count);
          
          if (count === 0) {
            console.log(`   ⚠️  Table is completely empty\n`);
          } else {
            const oldestResult = await query(`
              SELECT MAX(${check.timeColumn}) as latest FROM ${check.table}
            `);
            console.log(`   Last data: ${oldestResult.rows[0].latest}\n`);
          }
        }
      } catch (error: any) {
        console.log(`❌ ${check.name}: Table doesn't exist or error`);
        console.log(`   Error: ${error.message}\n`);
      }
    }

    console.log('═══════════════════════════════════════');
    console.log('DIAGNOSIS');
    console.log('═══════════════════════════════════════');
    console.log('If all tables show "No recent data", the scheduled jobs');
    console.log('are likely not running. You need to start the application:');
    console.log('');
    console.log('  npm start');
    console.log('  # or');
    console.log('  npm run dev');
    console.log('');
    console.log('This will start the Bull queue workers that collect data.');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkScheduledJobs();
