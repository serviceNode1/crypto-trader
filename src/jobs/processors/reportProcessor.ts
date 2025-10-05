import { Job } from 'bull';
import { getPortfolio, getPerformanceMetrics } from '../../services/trading/paperTrading';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';

interface ReportJobData {
  type: 'daily' | 'weekly';
}

/**
 * Generate daily performance report
 */
async function generateDailyReport(): Promise<void> {
  logger.info('Generating daily performance report...');
  
  try {
    const portfolio = await getPortfolio();
    const metrics = await getPerformanceMetrics();
    
    // Get today's trades
    const tradesResult = await query(
      `SELECT COUNT(*) as count, 
              SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
              SUM(pnl) as total_pnl
       FROM trades
       WHERE executed_at >= CURRENT_DATE
         AND executed_at < CURRENT_DATE + INTERVAL '1 day'`
    );
    
    const todayStats = tradesResult.rows[0];
    
    logger.info('=== DAILY REPORT ===');
    logger.info(`Date: ${new Date().toLocaleDateString()}`);
    logger.info('');
    logger.info('Portfolio Status:');
    logger.info(`  Total Value: $${portfolio.totalValue.toFixed(2)}`);
    logger.info(`  Cash: $${portfolio.cash.toFixed(2)}`);
    logger.info(`  Invested: $${(portfolio.totalValue - portfolio.cash).toFixed(2)}`);
    logger.info(`  Open Positions: ${portfolio.holdings.length}`);
    logger.info('');
    logger.info('Performance Metrics:');
    logger.info(`  Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%`);
    logger.info(`  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    logger.info(`  Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
    logger.info(`  Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
    logger.info('');
    logger.info("Today's Activity:");
    logger.info(`  Trades: ${todayStats.count}`);
    logger.info(`  Wins: ${todayStats.wins}`);
    logger.info(`  Losses: ${todayStats.losses}`);
    logger.info(`  P&L: $${parseFloat(todayStats.total_pnl || '0').toFixed(2)}`);
    logger.info('');
    
    if (portfolio.holdings.length > 0) {
      logger.info('Current Holdings:');
      for (const holding of portfolio.holdings) {
        const pnlPercent = ((holding.currentValue - holding.totalCost) / holding.totalCost) * 100;
        logger.info(`  ${holding.symbol}: ${holding.quantity} @ $${holding.avgPrice.toFixed(2)} | Current: $${holding.currentValue.toFixed(2)} (${pnlPercent > 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
      }
    }
    
    logger.info('==================');
  } catch (error) {
    logger.error('Failed to generate daily report', { error });
    throw error;
  }
}

/**
 * Generate weekly performance report
 */
async function generateWeeklyReport(): Promise<void> {
  logger.info('Generating weekly performance report...');
  
  try {
    const portfolio = await getPortfolio();
    const metrics = await getPerformanceMetrics();
    
    // Get this week's trades
    const tradesResult = await query(
      `SELECT COUNT(*) as count,
              SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
              SUM(pnl) as total_pnl,
              AVG(CASE WHEN pnl > 0 THEN pnl END) as avg_win,
              AVG(CASE WHEN pnl < 0 THEN pnl END) as avg_loss
       FROM trades
       WHERE executed_at >= DATE_TRUNC('week', CURRENT_DATE)
         AND executed_at < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`
    );
    
    const weekStats = tradesResult.rows[0];
    
    // Get recommendation accuracy
    const accuracyResult = await query(
      `SELECT 
         COUNT(*) as total_predictions,
         SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) as correct_predictions
       FROM predictions
       WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
         AND outcome_determined = true`
    );
    
    const accuracy = accuracyResult.rows[0];
    const accuracyRate = accuracy.total_predictions > 0
      ? (parseFloat(accuracy.correct_predictions) / parseFloat(accuracy.total_predictions)) * 100
      : 0;
    
    logger.info('=== WEEKLY REPORT ===');
    logger.info(`Week: ${new Date().toLocaleDateString()}`);
    logger.info('');
    logger.info('Portfolio Performance:');
    logger.info(`  Total Value: $${portfolio.totalValue.toFixed(2)}`);
    logger.info(`  Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%`);
    logger.info(`  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    logger.info(`  Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
    logger.info('');
    logger.info('Trading Statistics:');
    logger.info(`  Total Trades: ${weekStats.count}`);
    logger.info(`  Wins: ${weekStats.wins} (${weekStats.count > 0 ? ((weekStats.wins / weekStats.count) * 100).toFixed(1) : 0}%)`);
    logger.info(`  Losses: ${weekStats.losses}`);
    logger.info(`  Total P&L: $${parseFloat(weekStats.total_pnl || '0').toFixed(2)}`);
    logger.info(`  Avg Win: $${parseFloat(weekStats.avg_win || '0').toFixed(2)}`);
    logger.info(`  Avg Loss: $${parseFloat(weekStats.avg_loss || '0').toFixed(2)}`);
    logger.info('');
    logger.info('AI Prediction Accuracy:');
    logger.info(`  Total Predictions: ${accuracy.total_predictions}`);
    logger.info(`  Correct: ${accuracy.correct_predictions}`);
    logger.info(`  Accuracy Rate: ${accuracyRate.toFixed(1)}%`);
    logger.info('');
    logger.info('====================');
  } catch (error) {
    logger.error('Failed to generate weekly report', { error });
    throw error;
  }
}

/**
 * Process report generation jobs
 */
export async function processReport(job: Job<ReportJobData>): Promise<void> {
  const { type } = job.data;
  
  logger.info(`Processing ${type} report job`);
  
  try {
    if (type === 'daily') {
      await generateDailyReport();
    } else if (type === 'weekly') {
      await generateWeeklyReport();
    } else {
      throw new Error(`Unknown report type: ${type}`);
    }
    
    logger.info(`${type} report completed`);
  } catch (error) {
    logger.error(`${type} report failed`, { error });
    throw error;
  }
}
