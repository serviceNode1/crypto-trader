/**
 * AI Review Logger
 * Dedicated logging service for tracking AI scheduled review events
 */

import { query } from '../../config/database';
import { logger } from '../../utils/logger';

export interface AIReviewLogEntry {
  id?: number;
  reviewType: 'scheduled' | 'manual' | 'triggered';
  status: 'started' | 'completed' | 'failed';
  phase?: 'discovery' | 'filtering' | 'ai_analysis' | 'storing' | 'completed';
  coinsAnalyzed?: number;
  buyRecommendations?: number;
  sellRecommendations?: number;
  skippedOpportunities?: number;
  errorMessage?: string;
  metadata?: any;
  duration?: number; // milliseconds
  timestamp?: Date;
}

/**
 * Initialize AI review log table
 */
export async function initAIReviewLogTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ai_review_logs (
        id SERIAL PRIMARY KEY,
        review_type VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        status VARCHAR(20) NOT NULL,
        phase VARCHAR(50),
        coins_analyzed INTEGER,
        buy_recommendations INTEGER DEFAULT 0,
        sell_recommendations INTEGER DEFAULT 0,
        skipped_opportunities INTEGER DEFAULT 0,
        error_message TEXT,
        metadata JSONB,
        duration INTEGER,
        timestamp TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_ai_review_logs_timestamp ON ai_review_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_review_logs_status ON ai_review_logs(status);
      CREATE INDEX IF NOT EXISTS idx_ai_review_logs_review_type ON ai_review_logs(review_type);
    `);
    
    logger.info('AI review log table initialized');
  } catch (error) {
    logger.error('Failed to initialize AI review log table', { error });
    throw error;
  }
}

/**
 * Log AI review event
 */
export async function logAIReview(entry: AIReviewLogEntry): Promise<number> {
  try {
    const result = await query(
      `INSERT INTO ai_review_logs (
        review_type, status, phase, coins_analyzed,
        buy_recommendations, sell_recommendations, skipped_opportunities,
        error_message, metadata, duration, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        entry.reviewType || 'scheduled',
        entry.status,
        entry.phase || null,
        entry.coinsAnalyzed || null,
        entry.buyRecommendations || 0,
        entry.sellRecommendations || 0,
        entry.skippedOpportunities || 0,
        entry.errorMessage || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.duration || null,
        entry.timestamp || new Date()
      ]
    );
    
    return result.rows[0].id;
  } catch (error) {
    logger.error('Failed to log AI review event', { error, entry });
    throw error;
  }
}

/**
 * Update existing AI review log
 */
export async function updateAIReviewLog(id: number, updates: Partial<AIReviewLogEntry>): Promise<void> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.status) {
      setClauses.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }
    if (updates.phase) {
      setClauses.push(`phase = $${paramCount++}`);
      values.push(updates.phase);
    }
    if (updates.coinsAnalyzed !== undefined) {
      setClauses.push(`coins_analyzed = $${paramCount++}`);
      values.push(updates.coinsAnalyzed);
    }
    if (updates.buyRecommendations !== undefined) {
      setClauses.push(`buy_recommendations = $${paramCount++}`);
      values.push(updates.buyRecommendations);
    }
    if (updates.sellRecommendations !== undefined) {
      setClauses.push(`sell_recommendations = $${paramCount++}`);
      values.push(updates.sellRecommendations);
    }
    if (updates.skippedOpportunities !== undefined) {
      setClauses.push(`skipped_opportunities = $${paramCount++}`);
      values.push(updates.skippedOpportunities);
    }
    if (updates.errorMessage) {
      setClauses.push(`error_message = $${paramCount++}`);
      values.push(updates.errorMessage);
    }
    if (updates.metadata) {
      setClauses.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(updates.metadata));
    }
    if (updates.duration !== undefined) {
      setClauses.push(`duration = $${paramCount++}`);
      values.push(updates.duration);
    }

    if (setClauses.length > 0) {
      values.push(id);
      await query(
        `UPDATE ai_review_logs SET ${setClauses.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    }
  } catch (error) {
    logger.error('Failed to update AI review log', { error, id, updates });
    throw error;
  }
}

/**
 * Get recent AI review logs
 */
export async function getRecentAIReviewLogs(limit: number = 50): Promise<AIReviewLogEntry[]> {
  try {
    const result = await query(
      `SELECT 
        id, review_type, status, phase, coins_analyzed,
        buy_recommendations, sell_recommendations, skipped_opportunities,
        error_message, metadata, duration, timestamp, created_at
      FROM ai_review_logs
      WHERE timestamp >= NOW() - INTERVAL '3 days'
      ORDER BY timestamp DESC
      LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      reviewType: row.review_type,
      status: row.status,
      phase: row.phase,
      coinsAnalyzed: row.coins_analyzed,
      buyRecommendations: row.buy_recommendations,
      sellRecommendations: row.sell_recommendations,
      skippedOpportunities: row.skipped_opportunities,
      errorMessage: row.error_message,
      metadata: row.metadata,
      duration: row.duration,
      timestamp: row.timestamp
    }));
  } catch (error) {
    logger.error('Failed to get AI review logs', { error });
    throw error;
  }
}

/**
 * Get AI review statistics
 */
export async function getAIReviewStats(): Promise<any> {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_reviews,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_reviews,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_reviews,
        SUM(buy_recommendations) as total_buy_recommendations,
        SUM(sell_recommendations) as total_sell_recommendations,
        AVG(duration) as avg_duration_ms,
        MAX(timestamp) as last_review_time
      FROM ai_review_logs
      WHERE timestamp > NOW() - INTERVAL '30 days'
    `);

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get AI review stats', { error });
    throw error;
  }
}

/**
 * Clear old AI review logs (keep last 1000)
 */
export async function cleanupOldAIReviewLogs(): Promise<void> {
  try {
    await query(`
      DELETE FROM ai_review_logs
      WHERE id NOT IN (
        SELECT id FROM ai_review_logs
        ORDER BY timestamp DESC
        LIMIT 1000
      )
    `);
    
    logger.info('Cleaned up old AI review logs');
  } catch (error) {
    logger.error('Failed to cleanup old AI review logs', { error });
    throw error;
  }
}
