import { getPortfolio, executeTrade } from './paperTrading';
import { getCurrentPrice } from '../dataCollection/coinGeckoService';
import { getUserSettings } from '../settings/settingsService';
import { query } from '../../config/database';
import { tradingLogger as logger } from '../../utils/logger';

export interface MonitoredPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfitStrategy: 'full' | 'partial' | 'trailing';
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

/**
 * Monitor all open positions for exit conditions
 * Called by Bull queue every 5 minutes
 */
export async function monitorPositions(): Promise<{
  checked: number;
  stopLossTriggered: number;
  takeProfitTriggered: number;
  trailingStopsAdjusted: number;
}> {
  try {
    logger.info('👀 Starting position monitoring cycle...');

    const stats = {
      checked: 0,
      stopLossTriggered: 0,
      takeProfitTriggered: 0,
      trailingStopsAdjusted: 0,
    };

    // Get user settings
    const settings = await getUserSettings();

    // Only monitor if auto stop-loss is enabled
    if (!settings.autoStopLoss) {
      logger.info('Auto stop-loss is disabled, skipping monitoring');
      return stats;
    }

    // Get all open positions
    const portfolio = await getPortfolio();
    
    if (portfolio.positions.length === 0) {
      logger.info('No open positions to monitor');
      return stats;
    }

    logger.info(`Monitoring ${portfolio.positions.length} positions`);

    for (const position of portfolio.positions) {
      stats.checked++;

      try {
        // Get position details with stop-loss and take-profit levels
        const monitoredPosition = await getMonitoredPosition(position.symbol, settings);

        if (!monitoredPosition) {
          logger.warn(`No monitoring data for ${position.symbol}`);
          continue;
        }

        // Check stop-loss
        if (monitoredPosition.stopLoss && settings.autoStopLoss) {
          if (monitoredPosition.currentPrice <= monitoredPosition.stopLoss) {
            await triggerStopLoss(monitoredPosition);
            stats.stopLossTriggered++;
            continue; // Position closed, skip other checks
          }
        }

        // Check take-profit levels
        if (monitoredPosition.takeProfit1) {
          const tpResult = await checkTakeProfit(monitoredPosition, settings);
          if (tpResult.triggered) {
            stats.takeProfitTriggered++;
            if (tpResult.positionClosed) {
              continue; // Position fully closed
            }
          }
        }

        // Adjust trailing stops if applicable
        if (monitoredPosition.takeProfitStrategy === 'trailing') {
          const adjusted = await adjustTrailingStop(monitoredPosition);
          if (adjusted) {
            stats.trailingStopsAdjusted++;
          }
        }
      } catch (error) {
        logger.error(`Failed to monitor position ${position.symbol}`, { error });
      }
    }

    logger.info('👀 Position monitoring cycle complete', stats);

    return stats;
  } catch (error) {
    logger.error('Position monitoring failed', { error });
    throw error;
  }
}

/**
 * Get monitored position with stop-loss and take-profit levels
 */
async function getMonitoredPosition(
  symbol: string,
  settings: any
): Promise<MonitoredPosition | null> {
  try {
    // Get portfolio position
    const portfolio = await getPortfolio();
    const position = portfolio.positions.find(p => p.symbol === symbol);

    if (!position) {
      return null;
    }

    // Get latest recommendation for this symbol (to get stop-loss/take-profit levels)
    const result = await query(
      `SELECT * FROM recommendations
       WHERE symbol = $1
         AND action = 'BUY'
         AND execution_status = 'executed'
       ORDER BY created_at DESC
       LIMIT 1`,
      [symbol]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const rec = result.rows[0];

    return {
      symbol,
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      currentPrice: position.currentValue / position.quantity,
      stopLoss: rec.stop_loss ? parseFloat(rec.stop_loss) : null,
      takeProfit1: rec.take_profit_1 ? parseFloat(rec.take_profit_1) : null,
      takeProfit2: rec.take_profit_2 ? parseFloat(rec.take_profit_2) : null,
      takeProfitStrategy: settings.takeProfitStrategy,
      unrealizedPnL: position.unrealizedPnL,
      unrealizedPnLPercent: position.unrealizedPnLPercent,
    };
  } catch (error) {
    logger.error('Failed to get monitored position', { symbol, error });
    return null;
  }
}

/**
 * Trigger stop-loss (sell entire position)
 */
async function triggerStopLoss(position: MonitoredPosition): Promise<void> {
  try {
    logger.warn(`🛑 STOP-LOSS TRIGGERED: ${position.symbol}`, {
      currentPrice: position.currentPrice,
      stopLoss: position.stopLoss,
      loss: position.unrealizedPnL,
    });

    // Execute sell order
    await executeTrade(
      position.symbol,
      'SELL',
      position.quantity,
      `STOP-LOSS: Price ${position.currentPrice} hit stop-loss at ${position.stopLoss}`
    );

    // Log the stop-loss trigger
    await logStopLoss(position);

    logger.info(`✅ Stop-loss executed for ${position.symbol}`);
  } catch (error) {
    logger.error(`Failed to execute stop-loss for ${position.symbol}`, { error });
    throw error;
  }
}

/**
 * Check and trigger take-profit levels
 */
async function checkTakeProfit(
  position: MonitoredPosition,
  settings: any
): Promise<{ triggered: boolean; positionClosed: boolean }> {
  try {
    // Check first take-profit level
    if (position.takeProfit1 && position.currentPrice >= position.takeProfit1) {
      logger.info(`🎯 TAKE-PROFIT 1 TRIGGERED: ${position.symbol}`, {
        currentPrice: position.currentPrice,
        takeProfit: position.takeProfit1,
        profit: position.unrealizedPnL,
      });

      if (settings.takeProfitStrategy === 'full') {
        // Sell entire position
        await executeTrade(
          position.symbol,
          'SELL',
          position.quantity,
          `TAKE-PROFIT: Price ${position.currentPrice} reached target ${position.takeProfit1}`
        );

        await logTakeProfit(position, 1, position.quantity);

        return { triggered: true, positionClosed: true };
      } else if (settings.takeProfitStrategy === 'partial') {
        // Sell 50% at first target
        const sellQuantity = position.quantity * 0.5;

        await executeTrade(
          position.symbol,
          'SELL',
          sellQuantity,
          `PARTIAL TAKE-PROFIT: Selling 50% at target ${position.takeProfit1}`
        );

        // Move stop-loss to breakeven
        await moveStopToBreakeven(position);

        await logTakeProfit(position, 1, sellQuantity);

        return { triggered: true, positionClosed: false };
      }
    }

    // Check second take-profit level (if strategy allows)
    if (
      position.takeProfit2 &&
      position.currentPrice >= position.takeProfit2 &&
      settings.takeProfitStrategy === 'partial'
    ) {
      logger.info(`🎯 TAKE-PROFIT 2 TRIGGERED: ${position.symbol}`, {
        currentPrice: position.currentPrice,
        takeProfit: position.takeProfit2,
      });

      // Sell remaining position
      await executeTrade(
        position.symbol,
        'SELL',
        position.quantity,
        `TAKE-PROFIT 2: Price ${position.currentPrice} reached target ${position.takeProfit2}`
      );

      await logTakeProfit(position, 2, position.quantity);

      return { triggered: true, positionClosed: true };
    }

    return { triggered: false, positionClosed: false };
  } catch (error) {
    logger.error(`Failed to check take-profit for ${position.symbol}`, { error });
    return { triggered: false, positionClosed: false };
  }
}

/**
 * Adjust trailing stop-loss
 */
async function adjustTrailingStop(position: MonitoredPosition): Promise<boolean> {
  try {
    if (!position.stopLoss) {
      return false;
    }

    // Calculate trailing stop (e.g., 5% below current price)
    const trailingPercent = 0.05; // 5%
    const newStopLoss = position.currentPrice * (1 - trailingPercent);

    // Only move stop up, never down
    if (newStopLoss > position.stopLoss) {
      // Update stop-loss in database
      await query(
        `UPDATE recommendations
         SET stop_loss = $1
         WHERE symbol = $2
           AND action = 'BUY'
           AND execution_status = 'executed'
           AND created_at = (
             SELECT MAX(created_at) FROM recommendations
             WHERE symbol = $2 AND action = 'BUY'
           )`,
        [newStopLoss, position.symbol]
      );

      logger.info(`📈 Trailing stop adjusted for ${position.symbol}`, {
        oldStop: position.stopLoss,
        newStop: newStopLoss,
        currentPrice: position.currentPrice,
      });

      return true;
    }

    return false;
  } catch (error) {
    logger.error(`Failed to adjust trailing stop for ${position.symbol}`, { error });
    return false;
  }
}

/**
 * Move stop-loss to breakeven after partial take-profit
 */
async function moveStopToBreakeven(position: MonitoredPosition): Promise<void> {
  try {
    await query(
      `UPDATE recommendations
       SET stop_loss = $1
       WHERE symbol = $2
         AND action = 'BUY'
         AND execution_status = 'executed'
         AND created_at = (
           SELECT MAX(created_at) FROM recommendations
           WHERE symbol = $2 AND action = 'BUY'
         )`,
      [position.averagePrice, position.symbol]
    );

    logger.info(`🔒 Stop-loss moved to breakeven for ${position.symbol}`, {
      breakeven: position.averagePrice,
    });
  } catch (error) {
    logger.error(`Failed to move stop to breakeven for ${position.symbol}`, { error });
  }
}

/**
 * Log stop-loss event
 */
async function logStopLoss(position: MonitoredPosition): Promise<void> {
  try {
    await query(
      `INSERT INTO execution_logs (
        symbol, action, trigger_type, execution_method, success,
        settings_snapshot, execution_time_ms
      ) VALUES ($1, 'SELL', 'stop_loss', 'immediate', true, $2, 0)`,
      [
        position.symbol,
        JSON.stringify({
          stopLoss: position.stopLoss,
          triggeredAt: position.currentPrice,
          loss: position.unrealizedPnL,
        }),
      ]
    );
  } catch (error) {
    logger.error('Failed to log stop-loss', { error });
  }
}

/**
 * Log take-profit event
 */
async function logTakeProfit(
  position: MonitoredPosition,
  level: number,
  quantity: number
): Promise<void> {
  try {
    await query(
      `INSERT INTO execution_logs (
        symbol, action, trigger_type, execution_method, success,
        settings_snapshot, execution_time_ms
      ) VALUES ($1, 'SELL', $2, 'immediate', true, $3, 0)`,
      [
        position.symbol,
        `take_profit_${level}`,
        JSON.stringify({
          level,
          targetPrice: level === 1 ? position.takeProfit1 : position.takeProfit2,
          triggeredAt: position.currentPrice,
          quantity,
          profit: position.unrealizedPnL,
        }),
      ]
    );
  } catch (error) {
    logger.error('Failed to log take-profit', { error });
  }
}

/**
 * Get position monitoring statistics
 */
export async function getMonitoringStats(): Promise<{
  openPositions: number;
  stopLossesTriggered24h: number;
  takeProfitsTriggered24h: number;
  avgHoldingTime: number;
}> {
  try {
    const portfolio = await getPortfolio();

    const [stopLosses, takeProfits] = await Promise.all([
      query(
        `SELECT COUNT(*) FROM execution_logs
         WHERE trigger_type = 'stop_loss'
           AND executed_at > NOW() - INTERVAL '24 hours'`
      ),
      query(
        `SELECT COUNT(*) FROM execution_logs
         WHERE trigger_type LIKE 'take_profit%'
           AND executed_at > NOW() - INTERVAL '24 hours'`
      ),
    ]);

    // Calculate average holding time
    const holdingTimeResult = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (t_sell.executed_at - t_buy.executed_at))) / 3600 as avg_hours
       FROM trades t_buy
       JOIN trades t_sell ON t_buy.symbol = t_sell.symbol
       WHERE t_buy.side = 'BUY'
         AND t_sell.side = 'SELL'
         AND t_sell.executed_at > NOW() - INTERVAL '30 days'`
    );

    return {
      openPositions: portfolio.positions.length,
      stopLossesTriggered24h: parseInt(stopLosses.rows[0].count),
      takeProfitsTriggered24h: parseInt(takeProfits.rows[0].count),
      avgHoldingTime: parseFloat(holdingTimeResult.rows[0]?.avg_hours || '0'),
    };
  } catch (error) {
    logger.error('Failed to get monitoring stats', { error });
    throw error;
  }
}
