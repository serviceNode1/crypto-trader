/**
 * Check if Bull queues are running and have jobs
 */

import Queue from 'bull';

// Redis connection configuration (same as jobs/index.ts)
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
};

async function checkBullQueues() {
  try {
    console.log('\n🔍 Checking Bull Queue Status...\n');

    const queueNames = [
      'data-collection',
      'analysis',
      'recommendation',
      'report',
      'learning',
      'position-monitor'
    ];

    for (const queueName of queueNames) {
      const queue = new Queue(queueName, redisConfig);
      
      try {
        const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.getPausedCount(),
        ]);

        const total = waiting + active + completed + failed + delayed;
        
        console.log(`📊 ${queueName}:`);
        console.log(`   Waiting: ${waiting} | Active: ${active} | Completed: ${completed}`);
        console.log(`   Failed: ${failed} | Delayed: ${delayed} | Paused: ${paused}`);
        console.log(`   Total jobs: ${total}\n`);

        // Get repeatable jobs
        const repeatableJobs = await queue.getRepeatableJobs();
        if (repeatableJobs.length > 0) {
          console.log(`   📅 Scheduled jobs:`);
          repeatableJobs.forEach(job => {
            console.log(`      - ${job.name || 'unnamed'}: ${job.cron || job.every}`);
          });
          console.log('');
        }

        await queue.close();
      } catch (error: any) {
        console.log(`   ❌ Error accessing queue: ${error.message}\n`);
        await queue.close();
      }
    }

    console.log('═══════════════════════════════════════');
    console.log('If you see "Total jobs: 0" for all queues,');
    console.log('the scheduler might not have started.');
    console.log('Check the npm run dev output for errors.');
    console.log('═══════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBullQueues();
