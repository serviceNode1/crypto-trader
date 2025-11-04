/**
 * Clear AI Review Logs
 * Truncates the ai_review_log table to start fresh with smart execution logging
 */

import { query } from '../src/config/database';
import { logger } from '../src/utils/logger';

async function clearAIReviewLogs() {
  try {
    console.log('\n🗑️  Clearing AI review logs...\n');

    // Get count before deletion
    const beforeResult = await query('SELECT COUNT(*) as count FROM ai_review_logs');
    const beforeCount = parseInt(beforeResult.rows[0].count);
    
    console.log(`📊 Current log entries: ${beforeCount}`);

    if (beforeCount === 0) {
      console.log('\n✅ No logs to clear!\n');
      process.exit(0);
    }

    // Confirm deletion
    console.log('\n⚠️  This will delete ALL AI review log entries.');
    console.log('   This is useful to start fresh with smart execution logging.\n');

    // Truncate the table
    await query('TRUNCATE TABLE ai_review_logs RESTART IDENTITY CASCADE');

    // Verify deletion
    const afterResult = await query('SELECT COUNT(*) as count FROM ai_review_logs');
    const afterCount = parseInt(afterResult.rows[0].count);

    console.log(`\n✅ Cleared ${beforeCount} log entries`);
    console.log(`📊 Remaining entries: ${afterCount}\n`);
    console.log('🎯 AI review logs cleared successfully!');
    console.log('   Next scheduled review will create the first entry.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to clear AI review logs:', error);
    logger.error('Failed to clear AI review logs', { error });
    process.exit(1);
  }
}

clearAIReviewLogs();
