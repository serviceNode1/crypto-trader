/**
 * Check why jobs are failing
 */

import Queue from 'bull';

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
};

async function checkFailedJobs() {
  try {
    console.log('\n🔍 Checking Failed Jobs...\n');

    const queue = new Queue('data-collection', redisConfig);
    
    const failed = await queue.getFailed(0, 5); // Get last 5 failed jobs
    
    if (failed.length === 0) {
      console.log('No failed jobs found.\n');
      await queue.close();
      process.exit(0);
    }

    console.log(`Found ${failed.length} recent failed jobs:\n`);
    
    for (const job of failed) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Job ID: ${job.id}`);
      console.log(`Data:`, JSON.stringify(job.data, null, 2));
      console.log(`Failed at: ${job.failedReason ? new Date(job.processedOn || 0).toLocaleString() : 'Unknown'}`);
      console.log(`\nError:`);
      console.log(job.failedReason || 'No error message');
      console.log(`\nStack trace:`);
      console.log(job.stacktrace?.join('\n') || 'No stack trace');
      console.log('');
    }
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log('💡 TIP: Fix the error above, then clear failed jobs:');
    console.log('   await queue.clean(0, "failed");\n');

    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFailedJobs();
