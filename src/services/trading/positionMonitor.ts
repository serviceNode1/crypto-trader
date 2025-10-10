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
    logger.info('='.repeat(60));

    const stats = {
      checked: 0,
      stopLossTriggered: 0,
      takeProfitTriggered: 0,
      trailingStopsAdjusted: 0,
    };

    // Get user settings
    const settings = await getUserSettings();

    // Get all open positions
    const portfolio = await getPortfolio();
    
    if (portfolio.positions.length === 0) {
      logger.info('✅ No open positions to monitor');
      logger.info('='.repeat(60));
      return stats;
    }

    logger.info(`📊 Monitoring ${portfolio.positions.length} positions`);

    for (const position of portfolio.positions) {
      stats.checked++;
      logger.info(`\n🔍 Checking position #${stats.checked}: ${position.symbol}`);

      try {
        // Get position details with stop-loss and take-profit levels
        const monitoredPosition = await getMonitoredPosition(position.symbol, settings);

        if (!monitoredPosition) {
          logger.warn(`⚠️  No monitoring data for ${position.symbol}`);
          continue;
        }

        // Log current position state
        logger.info(`   Current Price: $${monitoredPosition.currentPrice.toFixed(2)}`);
        logger.info(`   Average Entry: $${monitoredPosition.averagePrice.toFixed(2)}`);
        logger.info(`   Quantity: ${monitoredPosition.quantity}`);
        logger.info(`   P&L: ${monitoredPosition.unrealizedPnLPercent >= 0 ? '+' : ''}${monitoredPosition.unrealizedPnLPercent.toFixed(2)}% ($${monitoredPosition.unrealizedPnL.toFixed(2)})`);

        // Check stop-loss (always enabled if user set a stop loss)
        if (monitoredPosition.stopLoss) {
          const distanceToStop = ((monitoredPosition.currentPrice - monitoredPosition.stopLoss) / monitoredPosition.stopLoss * 100);
          logger.info(`   🛡️  Stop Loss: $${monitoredPosition.stopLoss.toFixed(2)} (${distanceToStop.toFixed(2)}% away)`);
          
          if (monitoredPosition.currentPrice <= monitoredPosition.stopLoss) {
            logger.warn(`   🚨 STOP LOSS TRIGGERED! Price $${monitoredPosition.currentPrice.toFixed(2)} <= $${monitoredPosition.stopLoss.toFixed(2)}`);
            await triggerStopLoss(monitoredPosition);
            stats.stopLossTriggered++;
            continue; // Position closed, skip other checks
          } else {
            logger.info(`   ✅ Stop loss not triggered (price above level)`);
          }
        } else {
          logger.info(`   ℹ️  No stop loss set for this position`);
        }

        // Check take-profit levels
        if (monitoredPosition.takeProfit1) {
          const distanceToTP = ((monitoredPosition.takeProfit1 - monitoredPosition.currentPrice) / monitoredPosition.currentPrice * 100);
          logger.info(`   🎯 Take Profit: $${monitoredPosition.takeProfit1.toFixed(2)} (${distanceToTP.toFixed(2)}% away)`);
          
          const tpResult = await checkTakeProfit(monitoredPosition, settings);
          if (tpResult.triggered) {
            stats.takeProfitTriggered++;
            if (tpResult.positionClosed) {
              continue; // Position fully closed
            }
          } else {
            logger.info(`   ✅ Take profit not triggered (price below level)`);
          }
        } else {
          logger.info(`   ℹ️  No take profit set for this position`);
        }

        // Adjust trailing stops if applicable
        if (monitoredPosition.takeProfitStrategy === 'trailing') {
          const adjusted = await adjustTrailingStop(monitoredPosition);
          if (adjusted) {
            stats.trailingStopsAdjusted++;
          }
        }

        logger.info(`   ✅ Position ${position.symbol} check complete`);
      } catch (error) {
        logger.error(`❌ Failed to monitor position ${position.symbol}`, { error });
      }
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Position monitoring cycle complete', {
      positionsChecked: stats.checked,
      stopLossTriggered: stats.stopLossTriggered,
      takeProfitTriggered: stats.takeProfitTriggered,
      trailingStopsAdjusted: stats.trailingStopsAdjusted
    });
    logger.info('='.repeat(60));

    return stats;
  } catch (error) {
    logger.error('Position monitoring failed', { error });
    throw error;
  }
}

/**
 * Get monitored position with stop-loss and take-profit levels
 * Now reads protection levels from holdings table (user-set values)
 */
async function getMonitoredPosition(
  symbol: string,
  settings: any
): Promise<MonitoredPosition | null> {
  try {
    // Get portfolio position with stop_loss and take_profit from holdings table
    const portfolio = await getPortfolio();
    const position = portfolio.positions.find(p => p.symbol === symbol);

    if (!position) {
      logger.debug(`Position not found in portfolio: ${symbol}`);
      return null;
    }

    // Position already includes stopLoss and takeProfit from holdings table
    const currentPrice = position.currentValue / position.quantity;

    logger.debug(`Retrieved protection levels from holdings table for ${symbol}:`, {
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      currentPrice,
      quantity: position.quantity
    });

    return {
      symbol,
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      currentPrice,
      stopLoss: position.stopLoss || null,
      takeProfit1: position.takeProfit || null,
      takeProfit2: null, // We only have one take_profit in holdings table
      takeProfitStrategy: 'full', // Default to selling full position
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

    // Execute sell order (protection-triggered)
    await executeTrade(
      position.symbol,
      'SELL',
      position.quantity,
      `STOP-LOSS: Price ${position.currentPrice.toFixed(2)} hit stop-loss at ${position.stopLoss.toFixed(2)}`,
      undefined, // recommendationId
      undefined, // stopLoss
      undefined, // takeProfit
      'stop_loss', // tradeType
      `stop_loss_$${position.stopLoss.toFixed(2)}` // triggeredBy
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

      if (settings.takeProfitStrategy === 'full' || !settings.takeProfitStrategy) {
        // Sell entire position (protection-triggered)
        await executeTrade(
          position.symbol,
          'SELL',
          position.quantity,
          `TAKE-PROFIT: Price ${position.currentPrice.toFixed(2)} reached target ${position.takeProfit1.toFixed(2)}`,
          undefined, // recommendationId
          undefined, // stopLoss
          undefined, // takeProfit
          'take_profit', // tradeType
          `take_profit_$${position.takeProfit1.toFixed(2)}` // triggeredBy
        );

        await logTakeProfit(position, 1, position.quantity);

        return { triggered: true, positionClosed: true };
      } else if (settings.takeProfitStrategy === 'partial') {
        // Sell 50% at first target (protection-triggered)
        const sellQuantity = position.quantity * 0.5;

        await executeTrade(
          position.symbol,
          'SELL',
          sellQuantity,
          `PARTIAL TAKE-PROFIT: Selling 50% at target ${position.takeProfit1.toFixed(2)}`,
          undefined, // recommendationId
          undefined, // stopLoss
          undefined, // takeProfit
          'take_profit', // tradeType
          `take_profit_partial_$${position.takeProfit1.toFixed(2)}` // triggeredBy
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
