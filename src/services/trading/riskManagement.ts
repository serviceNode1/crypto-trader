import { RISK_LIMITS } from '../../config/constants';
import { getPortfolio } from './paperTrading';
import { query } from '../../config/database';
import { tradingLogger as logger } from '../../utils/logger';

export interface RiskCheck {
  allowed: boolean;
  reason: string;
  currentRisk?: number;
  maxRisk?: number;
  warnings?: string[];  // For manual trades: warnings instead of blocks
}

export interface PositionRisk {
  symbol: string;
  positionSize: number;
  positionSizePercent: number;
  stopLoss: number | null;
  potentialLoss: number;
  potentialLossPercent: number;
}

/**
 * Validate if a trade can be executed based on risk limits
 * @param isManualTrade - If true, relaxes position size and stop-loss width restrictions
 */
export async function validateTrade(
  symbol: string,
  side: 'BUY' | 'SELL',
  quantity: number,
  price: number,
  stopLoss?: number,
  isManualTrade: boolean = false
): Promise<RiskCheck> {
  try {
    const portfolio = await getPortfolio();
    const warnings: string[] = [];

    // SELL trades are generally allowed (reducing risk)
    if (side === 'SELL') {
      return { allowed: true, reason: 'SELL order allowed' };
    }

    // For BUY trades, check all risk limits
    const totalCost = quantity * price;
    const positionSizePercent = totalCost / portfolio.totalValue;

    // 1. Check maximum position size
    if (positionSizePercent > RISK_LIMITS.MAX_POSITION_SIZE) {
      if (!isManualTrade) {
        // Hard block for automated trades
        return {
          allowed: false,
          reason: `Position size ${(positionSizePercent * 100).toFixed(1)}% exceeds maximum ${(RISK_LIMITS.MAX_POSITION_SIZE * 100).toFixed(1)}%`,
          currentRisk: positionSizePercent,
          maxRisk: RISK_LIMITS.MAX_POSITION_SIZE,
        };
      } else {
        // Warning for manual trades - user has full control
        if (positionSizePercent > 0.50) {
          warnings.push(`⚠️ LARGE POSITION: ${(positionSizePercent * 100).toFixed(1)}% of portfolio. This is a highly concentrated bet.`);
        } else if (positionSizePercent > 0.20) {
          warnings.push(`Position size is ${(positionSizePercent * 100).toFixed(1)}% of portfolio. Recommended maximum for automated trades is ${(RISK_LIMITS.MAX_POSITION_SIZE * 100).toFixed(1)}%.`);
        }
      }
    }

    // 2. Check if stop loss is provided (optional for manual trades, warning if missing)
    if (!stopLoss) {
      if (!isManualTrade) {
        return {
          allowed: false,
          reason: 'Stop loss is mandatory for automated BUY orders',
        };
      } else {
        warnings.push('No stop-loss set. Your position is not protected from significant losses.');
      }
    }

    // 3. Validate stop loss is reasonable (only for automated trades, warning for manual)
    if (stopLoss) {
      const stopLossPercent = (price - stopLoss) / price;
      if (stopLossPercent > 0.1) {
        if (!isManualTrade) {
          return {
            allowed: false,
            reason: `Stop loss ${(stopLossPercent * 100).toFixed(1)}% below entry is too wide (max 10%)`,
          };
        } else {
          warnings.push(`Stop-loss is ${(stopLossPercent * 100).toFixed(1)}% below entry. This exceeds recommended 10% limit.`);
        }
      }
    }

    // 4. Check maximum open positions (warning for manual, block for auto)
    const openPositions = portfolio.positions.length;
    const hasExistingPosition = portfolio.positions.some((p) => p.symbol === symbol);

    if (openPositions >= RISK_LIMITS.MAX_OPEN_POSITIONS && !hasExistingPosition) {
      if (!isManualTrade) {
        return {
          allowed: false,
          reason: `Maximum ${RISK_LIMITS.MAX_OPEN_POSITIONS} open positions already reached`,
        };
      } else {
        warnings.push(`You already have ${openPositions} open positions. Maximum recommended is ${RISK_LIMITS.MAX_OPEN_POSITIONS}.`);
      }
    }

    // 5. Check total portfolio risk (warning for manual, block for auto)
    const currentPortfolioRisk = await calculateTotalPortfolioRisk();
    const newPositionRisk = stopLoss ? quantity * (price - stopLoss) : 0;
    const totalRisk = (currentPortfolioRisk + newPositionRisk) / portfolio.totalValue;

    if (totalRisk > RISK_LIMITS.MAX_PORTFOLIO_RISK) {
      if (!isManualTrade) {
        return {
          allowed: false,
          reason: `Total portfolio risk ${(totalRisk * 100).toFixed(1)}% would exceed maximum ${(RISK_LIMITS.MAX_PORTFOLIO_RISK * 100).toFixed(1)}%`,
          currentRisk: totalRisk,
          maxRisk: RISK_LIMITS.MAX_PORTFOLIO_RISK,
        };
      } else {
        warnings.push(`Total portfolio risk would be ${(totalRisk * 100).toFixed(1)}%. Recommended maximum is ${(RISK_LIMITS.MAX_PORTFOLIO_RISK * 100).toFixed(1)}%.`);
      }
    }

    // 6. Check daily loss limit (warning for manual, block for auto)
    const dailyLoss = await calculateDailyLoss();
    const dailyLossPercent = dailyLoss / portfolio.totalValue;

    if (dailyLossPercent > RISK_LIMITS.MAX_DAILY_LOSS) {
      if (!isManualTrade) {
        return {
          allowed: false,
          reason: `Daily loss limit ${(RISK_LIMITS.MAX_DAILY_LOSS * 100).toFixed(1)}% reached. Trading halted for today.`,
          currentRisk: dailyLossPercent,
          maxRisk: RISK_LIMITS.MAX_DAILY_LOSS,
        };
      } else {
        warnings.push(`Daily loss limit of ${(RISK_LIMITS.MAX_DAILY_LOSS * 100).toFixed(1)}% has been reached (current: ${(dailyLossPercent * 100).toFixed(1)}%). Additional trading may increase losses.`);
      }
    }

    // 7. Check minimum time between trades (informational warning only)
    const lastTradeTime = await getLastTradeTime(symbol);
    if (lastTradeTime) {
      const timeSinceLastTrade = Date.now() - lastTradeTime.getTime();
      if (timeSinceLastTrade < RISK_LIMITS.MIN_TRADE_INTERVAL_MS) {
        const remainingMinutes = Math.ceil(
          (RISK_LIMITS.MIN_TRADE_INTERVAL_MS - timeSinceLastTrade) / 60000
        );
        if (!isManualTrade) {
          return {
            allowed: false,
            reason: `Must wait ${remainingMinutes} more minutes before next trade in ${symbol}`,
          };
        } else {
          warnings.push(`Last ${symbol} trade was ${Math.floor(timeSinceLastTrade / 60000)} minutes ago. Consider waiting ${remainingMinutes} more minutes.`);
        }
      }
    }

    // 8. Check position correlation (if adding to existing positions)
    if (portfolio.positions.length > 0 && !hasExistingPosition) {
      const correlation = await checkPositionCorrelation(symbol, portfolio);
      if (correlation > RISK_LIMITS.MAX_POSITION_CORRELATION) {
        if (!isManualTrade) {
          return {
            allowed: false,
            reason: `Position correlation ${(correlation * 100).toFixed(0)}% exceeds maximum ${(RISK_LIMITS.MAX_POSITION_CORRELATION * 100).toFixed(0)}%`,
          };
        } else {
          warnings.push(`High correlation (${(correlation * 100).toFixed(0)}%) with existing positions. This increases portfolio risk concentration.`);
        }
      }
    }

    // All checks passed
    logger.info('Trade risk validation passed', {
      symbol,
      positionSizePercent: (positionSizePercent * 100).toFixed(2),
      portfolioRisk: (totalRisk * 100).toFixed(2),
      isManualTrade,
      warningsCount: warnings.length,
    });

    return {
      allowed: true,
      reason: warnings.length > 0 ? 'Trade allowed with warnings' : 'All risk checks passed',
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    logger.error('Risk validation failed', { symbol, error });
    return {
      allowed: false,
      reason: 'Risk validation error',
    };
  }
}

/**
 * Calculate total portfolio risk (potential loss from all stop losses)
 */
async function calculateTotalPortfolioRisk(): Promise<number> {
  let totalRisk = 0;

  // Get stop losses for all open positions
  const result = await query(`
    SELECT h.symbol, h.quantity, h.average_price, r.stop_loss
    FROM holdings h
    LEFT JOIN LATERAL (
      SELECT stop_loss
      FROM recommendations
      WHERE symbol = h.symbol AND action = 'BUY'
      ORDER BY created_at DESC
      LIMIT 1
    ) r ON true
    WHERE h.quantity > 0
  `);

  for (const row of result.rows) {
    const quantity = parseFloat(row.quantity);
    const avgPrice = parseFloat(row.average_price);
    const stopLoss = row.stop_loss ? parseFloat(row.stop_loss) : avgPrice * 0.9; // Default 10% if missing

    const potentialLoss = quantity * (avgPrice - stopLoss);
    totalRisk += potentialLoss;
  }

  return totalRisk;
}

/**
 * Calculate today's realized losses
 */
async function calculateDailyLoss(): Promise<number> {
  const result = await query(`
    SELECT 
      SUM(CASE 
        WHEN side = 'SELL' THEN total_cost
        WHEN side = 'BUY' THEN -total_cost
      END) as daily_pnl
    FROM trades
    WHERE executed_at >= CURRENT_DATE
  `);

  const dailyPnL = result.rows[0]?.daily_pnl
    ? parseFloat(result.rows[0].daily_pnl)
    : 0;

  // Return loss as positive number
  return dailyPnL < 0 ? Math.abs(dailyPnL) : 0;
}

/**
 * Get last trade time for a symbol
 */
async function getLastTradeTime(symbol: string): Promise<Date | null> {
  const result = await query(
    `SELECT executed_at FROM trades WHERE symbol = $1 ORDER BY executed_at DESC LIMIT 1`,
    [symbol]
  );

  return result.rows.length > 0 ? new Date(result.rows[0].executed_at) : null;
}

/**
 * Check correlation between new position and existing positions
 * Simplified version - real implementation would use historical price correlation
 */
async function checkPositionCorrelation(
  newSymbol: string,
  portfolio: { positions: Array<{ symbol: string }> }
): Promise<number> {
  // Simplified: assume high correlation between similar coins
  // In production, calculate actual price correlation from historical data

  const correlationMap: Record<string, string[]> = {
    BTC: ['ETH', 'BNB', 'LTC', 'BCH'],
    ETH: ['BTC', 'BNB', 'MATIC', 'LINK'],
    BNB: ['BTC', 'ETH'],
    // Add more correlations as needed
  };

  const existingSymbols = portfolio.positions.map((p) => p.symbol);
  const correlatedSymbols = correlationMap[newSymbol] || [];

  // Check if any existing position is highly correlated
  const hasCorrelation = existingSymbols.some((symbol: string) =>
    correlatedSymbols.includes(symbol)
  );

  // Return estimated correlation (0-1)
  return hasCorrelation ? 0.7 : 0.3;
}

/**
 * Calculate position risk for a single position
 */
export async function calculatePositionRisk(
  symbol: string,
  quantity: number,
  entryPrice: number,
  stopLoss: number | null
): Promise<PositionRisk> {
  const portfolio = await getPortfolio();
  const positionSize = quantity * entryPrice;
  const positionSizePercent = positionSize / portfolio.totalValue;

  let potentialLoss = 0;
  let potentialLossPercent = 0;

  if (stopLoss) {
    potentialLoss = quantity * (entryPrice - stopLoss);
    potentialLossPercent = (potentialLoss / portfolio.totalValue) * 100;
  }

  return {
    symbol,
    positionSize,
    positionSizePercent,
    stopLoss,
    potentialLoss,
    potentialLossPercent,
  };
}

/**
 * Calculate optimal position size based on risk parameters
 */
export async function calculateOptimalPositionSize(
  symbol: string,
  entryPrice: number,
  stopLoss: number,
  riskPercent: number = 2 // Risk 2% of portfolio by default
): Promise<number> {
  const portfolio = await getPortfolio();
  const riskAmount = portfolio.totalValue * (riskPercent / 100);
  const riskPerShare = entryPrice - stopLoss;

  if (riskPerShare <= 0) {
    logger.warn('Invalid stop loss for position sizing', {
      symbol,
      entryPrice,
      stopLoss,
    });
    return 0;
  }

  const quantity = riskAmount / riskPerShare;

  // Cap at maximum position size
  const maxPositionValue = portfolio.totalValue * RISK_LIMITS.MAX_POSITION_SIZE;
  const maxQuantity = maxPositionValue / entryPrice;

  const optimalQuantity = Math.min(quantity, maxQuantity);

  logger.debug('Optimal position size calculated', {
    symbol,
    quantity: optimalQuantity.toFixed(4),
    positionValue: (optimalQuantity * entryPrice).toFixed(2),
  });

  return optimalQuantity;
}

/**
 * Check if trading should be halted
 */
export async function shouldHaltTrading(): Promise<RiskCheck> {
  try {
    const portfolio = await getPortfolio();

    // Check daily loss limit
    const dailyLoss = await calculateDailyLoss();
    const dailyLossPercent = dailyLoss / portfolio.totalValue;

    if (dailyLossPercent >= RISK_LIMITS.MAX_DAILY_LOSS) {
      logger.error('TRADING HALTED: Daily loss limit reached', {
        loss: dailyLoss.toFixed(2),
        lossPercent: (dailyLossPercent * 100).toFixed(2),
      });

      return {
        allowed: false,
        reason: `Daily loss limit ${(RISK_LIMITS.MAX_DAILY_LOSS * 100).toFixed(1)}% reached`,
        currentRisk: dailyLossPercent,
        maxRisk: RISK_LIMITS.MAX_DAILY_LOSS,
      };
    }

    // Check if portfolio has lost more than 20% total
    const totalLossPercent = ((10000 - portfolio.totalValue) / 10000) * 100;
    if (totalLossPercent > 20) {
      logger.error('TRADING HALTED: Total portfolio loss exceeds 20%', {
        portfolioValue: portfolio.totalValue.toFixed(2),
        lossPercent: totalLossPercent.toFixed(2),
      });

      return {
        allowed: false,
        reason: 'Total portfolio loss exceeds 20% - manual review required',
      };
    }

    return {
      allowed: true,
      reason: 'Trading allowed',
    };
  } catch (error) {
    logger.error('Trading halt check failed', { error });
    return {
      allowed: false,
      reason: 'Risk check error - trading halted for safety',
    };
  }
}

/**
 * Get current risk exposure summary
 */
export async function getRiskExposure(userId: number = 1): Promise<{
  portfolioRisk: number;
  dailyLoss: number;
  openPositions: number;
  utilizationPercent: number;
}> {
  const portfolio = await getPortfolio(userId);
  const portfolioRisk = await calculateTotalPortfolioRisk(userId);
  const dailyLoss = await calculateDailyLoss(userId);

  const utilizationPercent =
    ((portfolio.totalValue - portfolio.cash) / portfolio.totalValue) * 100;

  return {
    portfolioRisk: (portfolioRisk / portfolio.totalValue) * 100,
    dailyLoss: (dailyLoss / portfolio.totalValue) * 100,
    openPositions: portfolio.positions.length,
    utilizationPercent,
  };
}
