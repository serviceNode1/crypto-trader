import { query, transaction } from '../../config/database';
import { TRANSACTION_COSTS } from '../../config/constants';
import { estimateSlippage } from '../dataCollection/coinbaseService';
import { getCurrentPrice } from '../dataCollection/coinGeckoService';
import { tradingLogger as logger } from '../../utils/logger';

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

export interface Portfolio {
  cash: number;
  positions: Position[];
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  holdings?: Position[];  // Alias for positions for backward compatibility
}

export interface Trade {
  id?: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fee: number;
  slippage: number;
  totalCost: number;
  reasoning?: string;
  recommendationId?: number;
  executedAt?: Date;
}

/**
 * Get current portfolio state
 */
export async function getPortfolio(): Promise<Portfolio> {
  try {
    // Get cash balance
    const balanceResult = await query(
      'SELECT cash FROM portfolio_balance ORDER BY id DESC LIMIT 1'
    );
    const cash = balanceResult.rows[0]
      ? parseFloat(balanceResult.rows[0].cash)
      : 10000;

    // Get all holdings with protection levels
    const holdingsResult = await query(
      'SELECT symbol, quantity, average_price, stop_loss, take_profit FROM holdings WHERE quantity > 0'
    );

    const positions: Position[] = [];
    let totalPositionValue = 0;

    for (const holding of holdingsResult.rows) {
      const symbol = holding.symbol;
      const quantity = parseFloat(holding.quantity);
      const averagePrice = parseFloat(holding.average_price);

      // Get current price
      const currentPrice = await getCurrentPrice(symbol);
      const currentValue = quantity * currentPrice;
      const unrealizedPnL = currentValue - quantity * averagePrice;
      const unrealizedPnLPercent = (unrealizedPnL / (quantity * averagePrice)) * 100;

      positions.push({
        symbol,
        quantity,
        averagePrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPercent,
        stopLoss: holding.stop_loss ? parseFloat(holding.stop_loss) : null,
        takeProfit: holding.take_profit ? parseFloat(holding.take_profit) : null,
      });

      totalPositionValue += currentValue;
    }

    const totalValue = cash + totalPositionValue;
    const startingCapital = parseFloat(process.env.STARTING_CAPITAL || '10000');
    const totalReturn = totalValue - startingCapital;
    const totalReturnPercent = (totalReturn / startingCapital) * 100;

    logger.debug('Portfolio retrieved', {
      cash: cash.toFixed(2),
      positions: positions.length,
      totalValue: totalValue.toFixed(2),
    });

    return {
      cash,
      positions,
      totalValue,
      totalReturn,
      totalReturnPercent,
    };
  } catch (error) {
    logger.error('Failed to get portfolio', { error });
    throw error;
  }
}

/**
 * Execute a paper trade
 */
export async function executeTrade(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  reasoning?: string,
  recommendationId?: number,
  stopLoss?: number,
  takeProfit?: number,
  tradeType?: 'manual' | 'automatic' | 'stop_loss' | 'take_profit',
  triggeredBy?: string
): Promise<Trade> {
  return transaction(async (client) => {
    try {
      logger.info('Executing paper trade', { symbol, side, quantity });

      // Get current price
      const price = await getCurrentPrice(symbol);

      // Calculate slippage
      const slippageRate = await estimateSlippage(
        symbol,
        side,
        quantity * price
      );
      const slippageAmount = price * slippageRate;
      const executionPrice =
        side === 'BUY' ? price + slippageAmount : price - slippageAmount;

      // Calculate fees
      const feeAmount = executionPrice * quantity * TRANSACTION_COSTS.FEE_RATE;

      // Calculate total cost
      const totalCost =
        side === 'BUY'
          ? executionPrice * quantity + feeAmount
          : executionPrice * quantity - feeAmount;

      // Get current balance
      const balanceResult = await client.query(
        'SELECT cash FROM portfolio_balance ORDER BY id DESC LIMIT 1'
      );
      const currentCash = parseFloat(balanceResult.rows[0].cash);

      if (side === 'BUY') {
        // Check if we have enough cash
        if (currentCash < totalCost) {
          throw new Error(
            `Insufficient funds: have $${currentCash.toFixed(2)}, need $${totalCost.toFixed(2)}`
          );
        }

        // Update cash balance
        const newCash = currentCash - totalCost;
        await client.query(
          'UPDATE portfolio_balance SET cash = $1, updated_at = NOW()',
          [newCash]
        );

        // Update or create holding
        const holdingResult = await client.query(
          'SELECT quantity, average_price FROM holdings WHERE symbol = $1',
          [symbol]
        );

        if (holdingResult.rows.length > 0) {
          // Update existing holding
          const existingQty = parseFloat(holdingResult.rows[0].quantity);
          const existingAvgPrice = parseFloat(holdingResult.rows[0].average_price);
          const newQty = existingQty + quantity;
          const newAvgPrice =
            (existingQty * existingAvgPrice + quantity * executionPrice) / newQty;

          // Only update stop_loss/take_profit if provided (don't overwrite existing values)
          if (stopLoss !== undefined || takeProfit !== undefined) {
            await client.query(
              `UPDATE holdings 
               SET quantity = $1, average_price = $2, 
                   stop_loss = COALESCE($3, stop_loss), 
                   take_profit = COALESCE($4, take_profit),
                   updated_at = NOW() 
               WHERE symbol = $5`,
              [newQty, newAvgPrice, stopLoss, takeProfit, symbol]
            );
          } else {
            await client.query(
              'UPDATE holdings SET quantity = $1, average_price = $2, updated_at = NOW() WHERE symbol = $3',
              [newQty, newAvgPrice, symbol]
            );
          }
        } else {
          // Create new holding with optional stop_loss and take_profit
          await client.query(
            'INSERT INTO holdings (symbol, quantity, average_price, stop_loss, take_profit) VALUES ($1, $2, $3, $4, $5)',
            [symbol, quantity, executionPrice, stopLoss || null, takeProfit || null]
          );
        }

        logger.info('BUY trade executed', {
          symbol,
          quantity,
          price: executionPrice.toFixed(2),
          totalCost: totalCost.toFixed(2),
        });
      } else {
        // SELL
        // Check if we have enough to sell
        const holdingResult = await client.query(
          'SELECT quantity FROM holdings WHERE symbol = $1',
          [symbol]
        );

        if (holdingResult.rows.length === 0) {
          throw new Error(`No position found for ${symbol}`);
        }

        const currentQty = parseFloat(holdingResult.rows[0].quantity);
        if (currentQty < quantity) {
          throw new Error(
            `Insufficient quantity: have ${currentQty}, trying to sell ${quantity}`
          );
        }

        // Update cash balance
        const newCash = currentCash + totalCost;
        await client.query(
          'UPDATE portfolio_balance SET cash = $1, updated_at = NOW()',
          [newCash]
        );

        // Update holding
        const newQty = currentQty - quantity;
        if (newQty === 0) {
          await client.query('DELETE FROM holdings WHERE symbol = $1', [symbol]);
        } else {
          await client.query(
            'UPDATE holdings SET quantity = $1, updated_at = NOW() WHERE symbol = $2',
            [newQty, symbol]
          );
        }

        logger.info('SELL trade executed', {
          symbol,
          quantity,
          price: executionPrice.toFixed(2),
          totalProceeds: totalCost.toFixed(2),
        });
      }

      // Record trade
      const tradeResult = await client.query(
        `INSERT INTO trades (symbol, side, quantity, price, fee, slippage, total_cost, reasoning, recommendation_id, trade_type, triggered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          symbol,
          side,
          quantity,
          executionPrice,
          feeAmount,
          slippageAmount,
          totalCost,
          reasoning,
          recommendationId,
          tradeType || 'manual',
          triggeredBy || 'user',
        ]
      );

      const trade: Trade = {
        id: tradeResult.rows[0].id,
        symbol,
        side,
        quantity,
        price: executionPrice,
        fee: feeAmount,
        slippage: slippageAmount,
        totalCost,
        reasoning,
        recommendationId,
      };

      return trade;
    } catch (error) {
      logger.error('Trade execution failed', { symbol, side, quantity, error });
      throw error;
    }
  });
}

/**
 * Get trade history
 */
export async function getTradeHistory(
  limit: number = 50
): Promise<Trade[]> {
  try {
    const result = await query(
      `SELECT id, symbol, side, quantity, price, fee, slippage, total_cost, reasoning, recommendation_id, executed_at
       FROM trades
       ORDER BY executed_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      quantity: parseFloat(row.quantity),
      price: parseFloat(row.price),
      fee: parseFloat(row.fee),
      slippage: parseFloat(row.slippage),
      totalCost: parseFloat(row.total_cost),
      reasoning: row.reasoning,
      recommendationId: row.recommendation_id,
      executedAt: row.executed_at,
    }));
  } catch (error) {
    logger.error('Failed to get trade history', { error });
    throw error;
  }
}

/**
 * Calculate performance metrics
 */
export async function calculatePerformanceMetrics(): Promise<{
  portfolioValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
}> {
  try {
    const portfolio = await getPortfolio();
    const startingCapital = parseFloat(process.env.STARTING_CAPITAL || '10000');

    // Get all completed trades (buy followed by sell)
    const tradesResult = await query(
      `SELECT symbol, side, quantity, price, total_cost, executed_at
       FROM trades
       ORDER BY executed_at ASC`
    );

    const trades = tradesResult.rows;
    const positions: Map<string, { quantity: number; avgPrice: number }> = new Map();
    const closedTrades: number[] = [];

    for (const trade of trades) {
      const symbol = trade.symbol;
      const side = trade.side;
      const quantity = parseFloat(trade.quantity);
      const price = parseFloat(trade.price);

      if (side === 'BUY') {
        const current = positions.get(symbol) || { quantity: 0, avgPrice: 0 };
        const newQty = current.quantity + quantity;
        const newAvgPrice =
          (current.quantity * current.avgPrice + quantity * price) / newQty;
        positions.set(symbol, { quantity: newQty, avgPrice: newAvgPrice });
      } else {
        // SELL
        const current = positions.get(symbol);
        if (current) {
          const pnl = (price - current.avgPrice) * quantity;
          closedTrades.push(pnl);
          
          const newQty = current.quantity - quantity;
          if (newQty <= 0) {
            positions.delete(symbol);
          } else {
            positions.set(symbol, { quantity: newQty, avgPrice: current.avgPrice });
          }
        }
      }
    }

    // Calculate metrics
    const totalTrades = closedTrades.length;
    const winningTrades = closedTrades.filter((pnl) => pnl > 0).length;
    const losingTrades = closedTrades.filter((pnl) => pnl < 0).length;
    const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

    const wins = closedTrades.filter((pnl) => pnl > 0);
    const losses = closedTrades.filter((pnl) => pnl < 0);
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

    // Calculate Sharpe Ratio (simplified)
    const returns = closedTrades.map((pnl) => pnl / startingCapital);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1
      ? Math.sqrt(
          returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) /
            (returns.length - 1)
        )
      : 0;
    const sharpeRatio = stdDev > 0 ? (avgReturn * Math.sqrt(252)) / stdDev : 0;

    // Calculate max drawdown (simplified)
    let peak = startingCapital;
    let maxDrawdown = 0;
    let runningValue = startingCapital;

    for (const pnl of closedTrades) {
      runningValue += pnl;
      if (runningValue > peak) {
        peak = runningValue;
      }
      const drawdown = (peak - runningValue) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    const metrics = {
      portfolioValue: portfolio.totalValue,
      totalReturn: portfolio.totalReturn,
      totalReturnPercent: portfolio.totalReturnPercent,
      sharpeRatio,
      maxDrawdown,
      winRate,
      totalTrades,
      winningTrades,
      losingTrades,
      avgWin,
      avgLoss,
    };

    // Store metrics in database
    await query(
      `INSERT INTO performance_metrics (
        portfolio_value, cash_balance, total_return_pct, sharpe_ratio,
        max_drawdown, win_rate, total_trades, winning_trades, losing_trades,
        avg_win, avg_loss
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        metrics.portfolioValue,
        portfolio.cash,
        metrics.totalReturnPercent,
        metrics.sharpeRatio,
        metrics.maxDrawdown,
        metrics.winRate,
        metrics.totalTrades,
        metrics.winningTrades,
        metrics.losingTrades,
        metrics.avgWin,
        metrics.avgLoss,
      ]
    );

    logger.info('Performance metrics calculated', {
      portfolioValue: metrics.portfolioValue.toFixed(2),
      returnPercent: metrics.totalReturnPercent.toFixed(2),
      sharpeRatio: metrics.sharpeRatio.toFixed(2),
      winRate: (metrics.winRate * 100).toFixed(1),
    });

    return metrics;
  } catch (error) {
    logger.error('Failed to calculate performance metrics', { error });
    throw error;
  }
}
