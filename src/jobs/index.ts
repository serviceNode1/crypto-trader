import Queue from 'bull';
import { logger } from '../utils/logger';

// Redis connection configuration
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
};

// Create job queues
export const dataCollectionQueue = new Queue('data-collection', redisConfig);
export const analysisQueue = new Queue('analysis', redisConfig);
export const recommendationQueue = new Queue('recommendation', redisConfig);
export const reportQueue = new Queue('report', redisConfig);
export const learningQueue = new Queue('learning', redisConfig);

// Queue event listeners
const setupQueueListeners = (queue: Queue.Queue, queueName: string) => {
  queue.on('error', (error) => {
    logger.error(`Queue ${queueName} error`, { error });
  });

  queue.on('failed', (job, error) => {
    logger.error(`Job ${job.id} in queue ${queueName} failed`, { 
      jobId: job.id,
      error,
      data: job.data,
    });
  });

  queue.on('completed', (job) => {
    logger.info(`Job ${job.id} in queue ${queueName} completed`, {
      jobId: job.id,
      duration: job.processedOn ? Date.now() - job.processedOn : 0,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} in queue ${queueName} stalled`, {
      jobId: job.id,
    });
  });
};

// Setup listeners for all queues
setupQueueListeners(dataCollectionQueue, 'data-collection');
setupQueueListeners(analysisQueue, 'analysis');
setupQueueListeners(recommendationQueue, 'recommendation');
setupQueueListeners(reportQueue, 'report');
setupQueueListeners(learningQueue, 'learning');

// Graceful shutdown
export const closeQueues = async (): Promise<void> => {
  logger.info('Closing job queues...');
  
  await Promise.all([
    dataCollectionQueue.close(),
    analysisQueue.close(),
    recommendationQueue.close(),
    reportQueue.close(),
    learningQueue.close(),
  ]);
  
  logger.info('All queues closed');
};

export default {
  dataCollectionQueue,
  analysisQueue,
  recommendationQueue,
  reportQueue,
  learningQueue,
  closeQueues,
};
