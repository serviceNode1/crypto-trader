import {
  dataCollectionQueue,
  analysisQueue,
  recommendationQueue,
  reportQueue,
} from './index';
import { processDataCollection } from './processors/dataCollectionProcessor';
import { processAnalysis } from './processors/analysisProcessor';
import { processRecommendation } from './processors/recommendationProcessor';
import { processReport } from './processors/reportProcessor';
import { logger } from '../utils/logger';

/**
 * Setup job processors
 */
export function setupProcessors(): void {
  logger.info('Setting up job processors...');

  // Data collection processor
  dataCollectionQueue.process(async (job) => {
    return processDataCollection(job);
  });

  // Analysis processor
  analysisQueue.process(async (job) => {
    return processAnalysis(job);
  });

  // Recommendation processor
  recommendationQueue.process(async (job) => {
    return processRecommendation(job);
  });

  // Report processor
  reportQueue.process(async (job) => {
    return processReport(job);
  });

  logger.info('Job processors ready');
}

/**
 * Schedule recurring jobs based on environment configuration
 */
export async function scheduleJobs(): Promise<void> {
  logger.info('Scheduling recurring jobs...');

  try {
    // Price data collection - every 5 minutes
    const pricesCron = process.env.CRON_COLLECT_PRICES || '*/5 * * * *';
    await dataCollectionQueue.add(
      { type: 'prices' },
      {
        repeat: { cron: pricesCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled price collection: ${pricesCron}`);

    // News collection - every 15 minutes
    const newsCron = process.env.CRON_COLLECT_NEWS || '*/15 * * * *';
    await dataCollectionQueue.add(
      { type: 'news' },
      {
        repeat: { cron: newsCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled news collection: ${newsCron}`);

    // Sentiment collection - every 30 minutes
    const sentimentCron = process.env.CRON_COLLECT_SENTIMENT || '*/30 * * * *';
    await dataCollectionQueue.add(
      { type: 'sentiment' },
      {
        repeat: { cron: sentimentCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled sentiment collection: ${sentimentCron}`);

    // Market context - every hour
    const marketContextCron = process.env.CRON_MARKET_CONTEXT || '0 * * * *';
    await dataCollectionQueue.add(
      { type: 'market-context' },
      {
        repeat: { cron: marketContextCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled market context: ${marketContextCron}`);

    // Technical analysis - every hour
    const analysisCron = process.env.CRON_ANALYSIS || '15 * * * *';
    await analysisQueue.add(
      {},
      {
        repeat: { cron: analysisCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled analysis: ${analysisCron}`);

    // AI recommendations - every 4 hours
    const recommendationCron = process.env.CRON_RECOMMENDATIONS || '0 */4 * * *';
    await recommendationQueue.add(
      {},
      {
        repeat: { cron: recommendationCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled recommendations: ${recommendationCron}`);

    // Daily report - at 9 AM every day
    const dailyReportCron = process.env.CRON_DAILY_REPORT || '0 9 * * *';
    await reportQueue.add(
      { type: 'daily' },
      {
        repeat: { cron: dailyReportCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled daily report: ${dailyReportCron}`);

    // Weekly report - at 9 AM every Monday
    const weeklyReportCron = process.env.CRON_WEEKLY_REPORT || '0 9 * * 1';
    await reportQueue.add(
      { type: 'weekly' },
      {
        repeat: { cron: weeklyReportCron },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    logger.info(`Scheduled weekly report: ${weeklyReportCron}`);

    logger.info('All jobs scheduled successfully');
  } catch (error) {
    logger.error('Failed to schedule jobs', { error });
    throw error;
  }
}

/**
 * Clear all scheduled jobs (useful for testing or resetting)
 */
export async function clearScheduledJobs(): Promise<void> {
  logger.info('Clearing scheduled jobs...');

  try {
    await Promise.all([
      dataCollectionQueue.obliterate({ force: true }),
      analysisQueue.obliterate({ force: true }),
      recommendationQueue.obliterate({ force: true }),
      reportQueue.obliterate({ force: true }),
    ]);

    logger.info('All scheduled jobs cleared');
  } catch (error) {
    logger.error('Failed to clear scheduled jobs', { error });
    throw error;
  }
}

/**
 * Initialize job system - setup processors and schedule jobs
 */
export async function initializeJobSystem(): Promise<void> {
  logger.info('Initializing job system...');

  setupProcessors();
  await scheduleJobs();

  logger.info('Job system initialized successfully');
}
