import { query } from '../../config/database';
import { logger } from '../../utils/logger';

export interface UserSettings {
  id?: number;
  userId: number;
  autoExecute: boolean;
  confidenceThreshold: number;
  humanApproval: boolean;
  positionSizingStrategy: 'equal' | 'confidence';
  maxPositionSize: number;
  takeProfitStrategy: 'full' | 'partial' | 'trailing';
  autoStopLoss: boolean;
  coinUniverse: 'top10' | 'top50' | 'top100';
  analysisFrequency: 1 | 4 | 8 | 24;
  createdAt?: Date;
  updatedAt?: Date;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  autoExecute: false,
  confidenceThreshold: 75,
  humanApproval: true,
  positionSizingStrategy: 'equal',
  maxPositionSize: 5.0,
  takeProfitStrategy: 'partial',
  autoStopLoss: true,
  coinUniverse: 'top50',
  analysisFrequency: 4,
};

/**
 * Get user settings (creates default if not exists)
 */
export async function getUserSettings(userId: number = 1): Promise<UserSettings> {
  try {
    const result = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Create default settings
      logger.info('Creating default settings for user', { userId });
      return await createDefaultSettings(userId);
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      autoExecute: row.auto_execute,
      confidenceThreshold: row.confidence_threshold,
      humanApproval: row.human_approval,
      positionSizingStrategy: row.position_sizing_strategy,
      maxPositionSize: parseFloat(row.max_position_size),
      takeProfitStrategy: row.take_profit_strategy,
      autoStopLoss: row.auto_stop_loss,
      coinUniverse: row.coin_universe,
      analysisFrequency: row.analysis_frequency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('Failed to get user settings', { userId, error });
    throw error;
  }
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  settings: Partial<UserSettings>,
  userId: number = 1
): Promise<UserSettings> {
  try {
    logger.info('Updating user settings', { userId, settings });

    // Validate settings
    validateSettings(settings);

    // Build dynamic UPDATE query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (settings.autoExecute !== undefined) {
      updates.push(`auto_execute = $${paramCount++}`);
      values.push(settings.autoExecute);
    }
    if (settings.confidenceThreshold !== undefined) {
      updates.push(`confidence_threshold = $${paramCount++}`);
      values.push(settings.confidenceThreshold);
    }
    if (settings.humanApproval !== undefined) {
      updates.push(`human_approval = $${paramCount++}`);
      values.push(settings.humanApproval);
    }
    if (settings.positionSizingStrategy !== undefined) {
      updates.push(`position_sizing_strategy = $${paramCount++}`);
      values.push(settings.positionSizingStrategy);
    }
    if (settings.maxPositionSize !== undefined) {
      updates.push(`max_position_size = $${paramCount++}`);
      values.push(settings.maxPositionSize);
    }
    if (settings.takeProfitStrategy !== undefined) {
      updates.push(`take_profit_strategy = $${paramCount++}`);
      values.push(settings.takeProfitStrategy);
    }
    if (settings.autoStopLoss !== undefined) {
      updates.push(`auto_stop_loss = $${paramCount++}`);
      values.push(settings.autoStopLoss);
    }
    if (settings.coinUniverse !== undefined) {
      updates.push(`coin_universe = $${paramCount++}`);
      values.push(settings.coinUniverse);
    }
    if (settings.analysisFrequency !== undefined) {
      updates.push(`analysis_frequency = $${paramCount++}`);
      values.push(settings.analysisFrequency);
    }

    if (updates.length === 0) {
      throw new Error('No settings to update');
    }

    values.push(userId);

    const sql = `
      UPDATE user_settings
      SET ${updates.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      throw new Error('Failed to update settings');
    }

    logger.info('Settings updated successfully', { userId });

    return await getUserSettings(userId);
  } catch (error) {
    logger.error('Failed to update user settings', { userId, error });
    throw error;
  }
}

/**
 * Reset settings to default
 */
export async function resetUserSettings(userId: number = 1): Promise<UserSettings> {
  try {
    logger.info('Resetting user settings to defaults', { userId });

    const result = await query(
      `UPDATE user_settings
       SET auto_execute = $1,
           confidence_threshold = $2,
           human_approval = $3,
           position_sizing_strategy = $4,
           max_position_size = $5,
           take_profit_strategy = $6,
           auto_stop_loss = $7,
           coin_universe = $8,
           analysis_frequency = $9
       WHERE user_id = $10
       RETURNING *`,
      [
        DEFAULT_SETTINGS.autoExecute,
        DEFAULT_SETTINGS.confidenceThreshold,
        DEFAULT_SETTINGS.humanApproval,
        DEFAULT_SETTINGS.positionSizingStrategy,
        DEFAULT_SETTINGS.maxPositionSize,
        DEFAULT_SETTINGS.takeProfitStrategy,
        DEFAULT_SETTINGS.autoStopLoss,
        DEFAULT_SETTINGS.coinUniverse,
        DEFAULT_SETTINGS.analysisFrequency,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to reset settings');
    }

    logger.info('Settings reset successfully', { userId });

    return await getUserSettings(userId);
  } catch (error) {
    logger.error('Failed to reset user settings', { userId, error });
    throw error;
  }
}

/**
 * Create default settings for new user
 */
async function createDefaultSettings(userId: number): Promise<UserSettings> {
  const result = await query(
    `INSERT INTO user_settings (
      user_id, auto_execute, confidence_threshold, human_approval,
      position_sizing_strategy, max_position_size, take_profit_strategy,
      auto_stop_loss, coin_universe, analysis_frequency
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      userId,
      DEFAULT_SETTINGS.autoExecute,
      DEFAULT_SETTINGS.confidenceThreshold,
      DEFAULT_SETTINGS.humanApproval,
      DEFAULT_SETTINGS.positionSizingStrategy,
      DEFAULT_SETTINGS.maxPositionSize,
      DEFAULT_SETTINGS.takeProfitStrategy,
      DEFAULT_SETTINGS.autoStopLoss,
      DEFAULT_SETTINGS.coinUniverse,
      DEFAULT_SETTINGS.analysisFrequency,
    ]
  );

  return await getUserSettings(userId);
}

/**
 * Validate settings values
 */
function validateSettings(settings: Partial<UserSettings>): void {
  if (
    settings.confidenceThreshold !== undefined &&
    (settings.confidenceThreshold < 70 || settings.confidenceThreshold > 90)
  ) {
    throw new Error('Confidence threshold must be between 70 and 90');
  }

  if (
    settings.maxPositionSize !== undefined &&
    (settings.maxPositionSize < 2 || settings.maxPositionSize > 10)
  ) {
    throw new Error('Max position size must be between 2% and 10%');
  }

  if (
    settings.positionSizingStrategy !== undefined &&
    !['equal', 'confidence'].includes(settings.positionSizingStrategy)
  ) {
    throw new Error('Invalid position sizing strategy');
  }

  if (
    settings.takeProfitStrategy !== undefined &&
    !['full', 'partial', 'trailing'].includes(settings.takeProfitStrategy)
  ) {
    throw new Error('Invalid take profit strategy');
  }

  if (
    settings.coinUniverse !== undefined &&
    !['top10', 'top50', 'top100'].includes(settings.coinUniverse)
  ) {
    throw new Error('Invalid coin universe');
  }

  if (
    settings.analysisFrequency !== undefined &&
    ![1, 4, 8, 24].includes(settings.analysisFrequency)
  ) {
    throw new Error('Invalid analysis frequency');
  }
}

/**
 * Check if auto-execution is enabled
 */
export async function isAutoExecutionEnabled(userId: number = 1): Promise<boolean> {
  const settings = await getUserSettings(userId);
  return settings.autoExecute && !settings.humanApproval;
}

/**
 * Check if human approval is required
 */
export async function requiresHumanApproval(userId: number = 1): Promise<boolean> {
  const settings = await getUserSettings(userId);
  return settings.humanApproval || !settings.autoExecute;
}

/**
 * Get confidence threshold
 */
export async function getConfidenceThreshold(userId: number = 1): Promise<number> {
  const settings = await getUserSettings(userId);
  return settings.confidenceThreshold;
}
