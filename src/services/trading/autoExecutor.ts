import { executeTrade } from './paperTrading';
import { validateTrade, calculateOptimalPositionSize } from './riskManagement';
import { getUserSettings } from '../settings/settingsService';
import { query } from '../../config/database';
import { tradingLogger as logger } from '../../utils/logger';

export interface PendingRecommendation {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  positionSize: number;
  riskLevel: string;
  reasoning: any;
  createdAt: Date;
}

/**
 * Main auto-executor function - Process all pending recommendations
 * Called by Bull queue every 5 minutes
 */
export async function processRecommendations(): Promise<{
  processed: number;
  executed: number;
  queued: number;
  skipped: number;
}> {
  try {
    logger.info('🤖 Starting auto-execution cycle...');

    const stats = {
      processed: 0,
      executed: 0,
      queued: 0,
      skipped: 0,
    };

    // Get user settings
    const settings = await getUserSettings();

    // Check if auto-execution is disabled
    if (!settings.autoExecute) {
      logger.info('Auto-execution is disabled in settings');
      return stats;
    }

    // Get pending recommendations
    const recommendations = await getPendingRecommendations(settings.confidenceThreshold);

    logger.info(`Found ${recommendations.length} pending recommendations`, {
      minConfidence: settings.confidenceThreshold,
    });

    for (const rec of recommendations) {
      stats.processed++;

      try {
        // Skip HOLD recommendations
        if (rec.action === 'HOLD') {
          await markRecommendationStatus(rec.id, 'rejected');
          stats.skipped++;
          continue;
        }

        // At this point, action can only be 'BUY' or 'SELL'
        // (tradeAction is for documentation; rec.action is still safe to use after HOLD check)

        // Decide whether to execute immediately or queue for approval
        if (settings.humanApproval) {
          // Queue for manual approval
          await queueForApproval(rec, settings);
          stats.queued++;
          logger.info(`Queued ${rec.action} ${rec.symbol} for approval`, {
            confidence: rec.confidence,
          });
        } else {
          // Execute automatically
          const result = await executeRecommendation(rec, settings);
          
          if (result.success) {
            stats.executed++;
            logger.info(`✅ Auto-executed ${rec.action} ${rec.symbol}`, {
              quantity: result.quantity,
              price: result.price,
            });
          } else {
            stats.skipped++;
            logger.warn(`⚠️ Skipped ${rec.action} ${rec.symbol}: ${result.reason}`);
          }
        }
      } catch (error) {
        logger.error(`Failed to process recommendation ${rec.id}`, { error, rec });
        stats.skipped++;
      }
    }

    logger.info('🤖 Auto-execution cycle complete', stats);

    return stats;
  } catch (error) {
    logger.error('Auto-execution cycle failed', { error });
    throw error;
  }
}

/**
 * Get recommendations that meet the confidence threshold and are pending
 */
async function getPendingRecommendations(
  minConfidence: number
): Promise<PendingRecommendation[]> {
  try {
    const result = await query(
      `SELECT * FROM recommendations
       WHERE execution_status = 'pending'
         AND confidence >= $1
         AND expires_at > NOW()
         AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY confidence DESC, created_at DESC`,
      [minConfidence]
    );

    return result.rows.map(row => ({
      id: row.id,
      symbol: row.symbol,
      action: row.action,
      confidence: row.confidence,
      entryPrice: parseFloat(row.entry_price),
      stopLoss: row.stop_loss ? parseFloat(row.stop_loss) : null,
      takeProfit1: row.take_profit_1 ? parseFloat(row.take_profit_1) : null,
      takeProfit2: row.take_profit_2 ? parseFloat(row.take_profit_2) : null,
      positionSize: parseFloat(row.position_size),
      riskLevel: row.risk_level,
      reasoning: row.reasoning,
      createdAt: row.created_at,
    }));
  } catch (error) {
    logger.error('Failed to get pending recommendations', { error });
    throw error;
  }
}

/**
 * Execute a recommendation
 */
async function executeRecommendation(
  rec: PendingRecommendation,
  settings: any
): Promise<{ success: boolean; reason?: string; quantity?: number; price?: number }> {
  const startTime = Date.now();

  try {
    // Type guard: This function should never be called with HOLD
    if (rec.action === 'HOLD') {
      throw new Error('HOLD recommendations should not be executed');
    }

    // At this point, TypeScript knows action is 'BUY' | 'SELL'
    const tradeAction: 'BUY' | 'SELL' = rec.action;

    // Calculate position size based on strategy
    let quantity: number;
    
    if (settings.positionSizingStrategy === 'confidence') {
      // Size based on confidence (higher confidence = larger position)
      const baseSize = settings.maxPositionSize;
      const confidenceFactor = rec.confidence / 100;
      const adjustedSize = baseSize * confidenceFactor;
      
      quantity = await calculateOptimalPositionSize(
        rec.symbol,
        rec.entryPrice,
        rec.stopLoss || rec.entryPrice * 0.9,
        adjustedSize
      );
    } else {
      // Equal weight strategy
      quantity = await calculateOptimalPositionSize(
        rec.symbol,
        rec.entryPrice,
        rec.stopLoss || rec.entryPrice * 0.9,
        settings.maxPositionSize
      );
    }

    if (quantity === 0) {
      await markRecommendationStatus(rec.id, 'rejected');
      await logExecution(rec.id, null, 'rejected', false, 'Position size calculated to 0', startTime);
      return { success: false, reason: 'Position size too small' };
    }

    // Validate trade against risk rules
    const riskCheck = await validateTrade(
      rec.symbol,
      tradeAction,
      quantity,
      rec.entryPrice,
      rec.stopLoss ?? undefined
    );

    if (!riskCheck.allowed) {
      await markRecommendationStatus(rec.id, 'rejected');
      await logExecution(rec.id, null, 'rejected', false, riskCheck.reason, startTime);
      return { success: false, reason: riskCheck.reason };
    }

    // Execute the trade
    const trade = await executeTrade(
      rec.symbol,
      tradeAction,
      quantity,
      JSON.stringify(rec.reasoning),
      rec.id
    );

    // Mark recommendation as executed
    await markRecommendationStatus(rec.id, 'executed');

    // Log execution
    await logExecution(rec.id, trade.id!, 'auto', true, null, startTime, settings);

    return {
      success: true,
      quantity,
      price: trade.price,
    };
  } catch (error) {
    logger.error('Failed to execute recommendation', { rec, error });
    
    await markRecommendationStatus(rec.id, 'rejected');
    await logExecution(
      rec.id,
      null,
      'auto',
      false,
      error instanceof Error ? error.message : 'Unknown error',
      startTime
    );

    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queue recommendation for manual approval
 */
async function queueForApproval(rec: PendingRecommendation, settings: any): Promise<void> {
  try {
    // Calculate quantity for display
    const quantity = await calculateOptimalPositionSize(
      rec.symbol,
      rec.entryPrice,
      rec.stopLoss || rec.entryPrice * 0.9,
      settings.maxPositionSize
    );

    await query(
      `INSERT INTO trade_approvals (
        recommendation_id, symbol, action, quantity, entry_price,
        stop_loss, take_profit_1, take_profit_2, reasoning
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        rec.id,
        rec.symbol,
        rec.action,
        quantity,
        rec.entryPrice,
        rec.stopLoss,
        rec.takeProfit1,
        rec.takeProfit2,
        JSON.stringify(rec.reasoning),
      ]
    );

    // Mark recommendation as queued
    await markRecommendationStatus(rec.id, 'queued');

    logger.info(`Queued trade for approval`, {
      symbol: rec.symbol,
      action: rec.action,
      quantity,
    });
  } catch (error) {
    logger.error('Failed to queue trade for approval', { rec, error });
    throw error;
  }
}

/**
 * Mark recommendation execution status
 */
async function markRecommendationStatus(
  recommendationId: number,
  status: 'pending' | 'queued' | 'executed' | 'rejected' | 'expired'
): Promise<void> {
  try {
    await query(
      `UPDATE recommendations
       SET execution_status = $1,
           executed_at = CASE WHEN $1 = 'executed' THEN NOW() ELSE executed_at END
       WHERE id = $2`,
      [status, recommendationId]
    );
  } catch (error) {
    logger.error('Failed to mark recommendation status', { recommendationId, status, error });
  }
}

/**
 * Log execution details for analysis
 */
async function logExecution(
  recommendationId: number,
  tradeId: number | null,
  triggerType: string,
  success: boolean,
  errorMessage: string | null,
  startTime: number,
  settings?: any
): Promise<void> {
  try {
    const executionTime = Date.now() - startTime;

    await query(
      `INSERT INTO execution_logs (
        recommendation_id, trade_id, symbol, action, trigger_type,
        execution_method, settings_snapshot, success, error_message, execution_time_ms
      ) SELECT
        $1, $2, symbol, action, $3, $4, $5, $6, $7, $8
      FROM recommendations WHERE id = $1`,
      [
        recommendationId,
        tradeId,
        triggerType,
        success ? 'immediate' : 'rejected',
        settings ? JSON.stringify(settings) : null,
        success,
        errorMessage,
        executionTime,
      ]
    );
  } catch (error) {
    logger.error('Failed to log execution', { recommendationId, error });
  }
}

/**
 * Process pending approvals
 */
export async function processPendingApprovals(): Promise<void> {
  try {
    // Expire old approvals
    await query(
      `UPDATE trade_approvals
       SET status = 'expired'
       WHERE status = 'pending'
         AND expires_at < NOW()`
    );

    // Get approved trades
    const result = await query(
      `SELECT * FROM trade_approvals
       WHERE status = 'approved'
         AND approved_at IS NOT NULL`
    );

    for (const approval of result.rows) {
      try {
        // Execute the approved trade
        await executeTrade(
          approval.symbol,
          approval.action,
          parseFloat(approval.quantity),
          approval.reasoning,
          approval.recommendation_id
        );

        // Mark as executed
        await query(
          `UPDATE trade_approvals SET status = 'executed' WHERE id = $1`,
          [approval.id]
        );

        // Update recommendation
        await markRecommendationStatus(approval.recommendation_id, 'executed');

        logger.info('✅ Executed approved trade', {
          symbol: approval.symbol,
          action: approval.action,
        });
      } catch (error) {
        logger.error('Failed to execute approved trade', { approval, error });
      }
    }
  } catch (error) {
    logger.error('Failed to process pending approvals', { error });
  }
}

/**
 * Get statistics for monitoring
 */
export async function getAutoExecutionStats(): Promise<{
  pendingRecommendations: number;
  pendingApprovals: number;
  executedToday: number;
  successRate: number;
}> {
  try {
    const [pending, approvals, executed, success] = await Promise.all([
      query(`SELECT COUNT(*) FROM recommendations WHERE execution_status = 'pending'`),
      query(`SELECT COUNT(*) FROM trade_approvals WHERE status = 'pending'`),
      query(
        `SELECT COUNT(*) FROM execution_logs 
         WHERE executed_at > CURRENT_DATE AND trigger_type = 'auto'`
      ),
      query(
        `SELECT 
          COUNT(*) FILTER (WHERE success = true) as successful,
          COUNT(*) as total
         FROM execution_logs
         WHERE executed_at > NOW() - INTERVAL '7 days'
           AND trigger_type = 'auto'`
      ),
    ]);

    const successRate =
      success.rows[0].total > 0
        ? (success.rows[0].successful / success.rows[0].total) * 100
        : 0;

    return {
      pendingRecommendations: parseInt(pending.rows[0].count),
      pendingApprovals: parseInt(approvals.rows[0].count),
      executedToday: parseInt(executed.rows[0].count),
      successRate: Math.round(successRate),
    };
  } catch (error) {
    logger.error('Failed to get auto-execution stats', { error });
    throw error;
  }
}
