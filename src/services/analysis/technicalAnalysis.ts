import { RSI, MACD, BollingerBands, EMA, SMA } from 'technicalindicators';
import { INDICATOR_PERIODS } from '../../config/constants';
import { Candlestick } from '../dataCollection/binanceService';
import { logger } from '../../utils/logger';

export interface TechnicalIndicators {
  rsi: number | null;
  macd: {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
  };
  bollingerBands: {
    upper: number | null;
    middle: number | null;
    lower: number | null;
  };
  ema: {
    short: number | null;
    medium: number | null;
    long: number | null;
  };
  sma: {
    sma20: number | null;
    sma50: number | null;
  };
  volume: {
    current: number;
    average: number;
    ratio: number;
  };
  supportResistance: {
    support: number[];
    resistance: number[];
  };
}

export interface TrendAnalysis {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  signals: string[];
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(closes: number[], period: number = INDICATOR_PERIODS.RSI): number | null {
  try {
    if (closes.length < period + 1) {
      logger.warn('Insufficient data for RSI calculation', {
        dataPoints: closes.length,
        required: period + 1,
      });
      return null;
    }

    const rsiValues = RSI.calculate({
      values: closes,
      period,
    });

    return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null;
  } catch (error) {
    logger.error('RSI calculation error', { error });
    return null;
  }
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(closes: number[]): {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
} {
  try {
    if (closes.length < 26) {
      logger.warn('Insufficient data for MACD calculation', {
        dataPoints: closes.length,
        required: 26,
      });
      return { macd: null, signal: null, histogram: null };
    }

    const macdValues = MACD.calculate({
      values: closes,
      fastPeriod: INDICATOR_PERIODS.MACD_FAST,
      slowPeriod: INDICATOR_PERIODS.MACD_SLOW,
      signalPeriod: INDICATOR_PERIODS.MACD_SIGNAL,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    if (macdValues.length === 0) {
      return { macd: null, signal: null, histogram: null };
    }

    const latest = macdValues[macdValues.length - 1];
    return {
      macd: latest.MACD || null,
      signal: latest.signal || null,
      histogram: latest.histogram || null,
    };
  } catch (error) {
    logger.error('MACD calculation error', { error });
    return { macd: null, signal: null, histogram: null };
  }
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(closes: number[]): {
  upper: number | null;
  middle: number | null;
  lower: number | null;
} {
  try {
    if (closes.length < INDICATOR_PERIODS.BB_PERIOD) {
      logger.warn('Insufficient data for Bollinger Bands calculation', {
        dataPoints: closes.length,
        required: INDICATOR_PERIODS.BB_PERIOD,
      });
      return { upper: null, middle: null, lower: null };
    }

    const bbValues = BollingerBands.calculate({
      values: closes,
      period: INDICATOR_PERIODS.BB_PERIOD,
      stdDev: INDICATOR_PERIODS.BB_STDDEV,
    });

    if (bbValues.length === 0) {
      return { upper: null, middle: null, lower: null };
    }

    const latest = bbValues[bbValues.length - 1];
    return {
      upper: latest.upper || null,
      middle: latest.middle || null,
      lower: latest.lower || null,
    };
  } catch (error) {
    logger.error('Bollinger Bands calculation error', { error });
    return { upper: null, middle: null, lower: null };
  }
}

/**
 * Calculate EMAs (Exponential Moving Averages)
 */
export function calculateEMAs(closes: number[]): {
  short: number | null;
  medium: number | null;
  long: number | null;
} {
  try {
    const emaShort =
      closes.length >= INDICATOR_PERIODS.EMA_SHORT
        ? EMA.calculate({ values: closes, period: INDICATOR_PERIODS.EMA_SHORT })
        : [];

    const emaMedium =
      closes.length >= INDICATOR_PERIODS.EMA_MEDIUM
        ? EMA.calculate({ values: closes, period: INDICATOR_PERIODS.EMA_MEDIUM })
        : [];

    const emaLong =
      closes.length >= INDICATOR_PERIODS.EMA_LONG
        ? EMA.calculate({ values: closes, period: INDICATOR_PERIODS.EMA_LONG })
        : [];

    return {
      short: emaShort.length > 0 ? emaShort[emaShort.length - 1] : null,
      medium: emaMedium.length > 0 ? emaMedium[emaMedium.length - 1] : null,
      long: emaLong.length > 0 ? emaLong[emaLong.length - 1] : null,
    };
  } catch (error) {
    logger.error('EMA calculation error', { error });
    return { short: null, medium: null, long: null };
  }
}

/**
 * Calculate SMAs (Simple Moving Averages)
 */
export function calculateSMAs(closes: number[]): {
  sma20: number | null;
  sma50: number | null;
} {
  try {
    const sma20 =
      closes.length >= 20
        ? SMA.calculate({ values: closes, period: 20 })
        : [];

    const sma50 =
      closes.length >= 50
        ? SMA.calculate({ values: closes, period: 50 })
        : [];

    return {
      sma20: sma20.length > 0 ? sma20[sma20.length - 1] : null,
      sma50: sma50.length > 0 ? sma50[sma50.length - 1] : null,
    };
  } catch (error) {
    logger.error('SMA calculation error', { error });
    return { sma20: null, sma50: null };
  }
}

/**
 * Analyze volume
 */
export function analyzeVolume(candlesticks: Candlestick[]): {
  current: number;
  average: number;
  ratio: number;
} {
  if (candlesticks.length === 0) {
    return { current: 0, average: 0, ratio: 0 };
  }

  const currentVolume = candlesticks[candlesticks.length - 1].volume;
  const volumes = candlesticks.map((c) => c.volume);
  const averageVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
  const ratio = averageVolume > 0 ? currentVolume / averageVolume : 0;

  return {
    current: currentVolume,
    average: averageVolume,
    ratio,
  };
}

/**
 * Identify support and resistance levels
 */
export function findSupportResistance(
  candlesticks: Candlestick[],
  lookback: number = 50
): {
  support: number[];
  resistance: number[];
} {
  if (candlesticks.length < 3) {
    return { support: [], resistance: [] };
  }

  const recentCandles = candlesticks.slice(-lookback);
  const highs = recentCandles.map((c) => c.high);
  const lows = recentCandles.map((c) => c.low);

  // Find local maxima (resistance)
  const resistance: number[] = [];
  for (let i = 1; i < highs.length - 1; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
      resistance.push(highs[i]);
    }
  }

  // Find local minima (support)
  const support: number[] = [];
  for (let i = 1; i < lows.length - 1; i++) {
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
      support.push(lows[i]);
    }
  }

  // Cluster nearby levels (within 2%)
  const clusterLevels = (levels: number[]): number[] => {
    if (levels.length === 0) return [];

    const sorted = [...levels].sort((a, b) => a - b);
    const clustered: number[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const lastCluster = clustered[clustered.length - 1];
      if (Math.abs(sorted[i] - lastCluster) / lastCluster > 0.02) {
        clustered.push(sorted[i]);
      }
    }

    return clustered;
  };

  return {
    support: clusterLevels(support).slice(-3), // Keep top 3
    resistance: clusterLevels(resistance).slice(-3), // Keep top 3
  };
}

/**
 * Calculate all technical indicators
 */
export function calculateAllIndicators(candlesticks: Candlestick[]): TechnicalIndicators {
  const closes = candlesticks.map((c) => c.close);

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bollingerBands = calculateBollingerBands(closes);
  const ema = calculateEMAs(closes);
  const sma = calculateSMAs(closes);
  const volume = analyzeVolume(candlesticks);
  const supportResistance = findSupportResistance(candlesticks);

  return {
    rsi,
    macd,
    bollingerBands,
    ema,
    sma,
    volume,
    supportResistance,
  };
}

/**
 * Analyze trend based on indicators
 */
export function analyzeTrend(
  indicators: TechnicalIndicators,
  currentPrice: number
): TrendAnalysis {
  const signals: string[] = [];
  let bullishSignals = 0;
  let bearishSignals = 0;

  // RSI analysis
  if (indicators.rsi !== null) {
    if (indicators.rsi < 30) {
      signals.push('RSI oversold (<30)');
      bullishSignals++;
    } else if (indicators.rsi > 70) {
      signals.push('RSI overbought (>70)');
      bearishSignals++;
    } else if (indicators.rsi > 50) {
      bullishSignals += 0.5;
    } else {
      bearishSignals += 0.5;
    }
  }

  // MACD analysis
  if (indicators.macd.macd !== null && indicators.macd.signal !== null) {
    if (indicators.macd.macd > indicators.macd.signal) {
      signals.push('MACD bullish crossover');
      bullishSignals++;
    } else {
      signals.push('MACD bearish crossover');
      bearishSignals++;
    }
  }

  // Bollinger Bands analysis
  if (
    indicators.bollingerBands.lower !== null &&
    indicators.bollingerBands.upper !== null
  ) {
    if (currentPrice < indicators.bollingerBands.lower) {
      signals.push('Price below lower Bollinger Band');
      bullishSignals++;
    } else if (currentPrice > indicators.bollingerBands.upper) {
      signals.push('Price above upper Bollinger Band');
      bearishSignals++;
    }
  }

  // EMA analysis
  if (
    indicators.ema.short !== null &&
    indicators.ema.medium !== null &&
    indicators.ema.long !== null
  ) {
    if (
      indicators.ema.short > indicators.ema.medium &&
      indicators.ema.medium > indicators.ema.long
    ) {
      signals.push('EMA alignment bullish (9>21>50)');
      bullishSignals += 2;
    } else if (
      indicators.ema.short < indicators.ema.medium &&
      indicators.ema.medium < indicators.ema.long
    ) {
      signals.push('EMA alignment bearish (9<21<50)');
      bearishSignals += 2;
    }
  }

  // Volume analysis
  if (indicators.volume.ratio > 1.5) {
    signals.push(`High volume (${indicators.volume.ratio.toFixed(1)}x average)`);
  }

  // Determine trend
  const totalSignals = bullishSignals + bearishSignals;
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  let strength = 0;

  if (totalSignals > 0) {
    const bullishRatio = bullishSignals / totalSignals;
    strength = Math.abs(bullishRatio - 0.5) * 200; // 0-100 scale

    if (bullishRatio > 0.6) {
      trend = 'bullish';
    } else if (bullishRatio < 0.4) {
      trend = 'bearish';
    }
  }

  logger.debug('Trend analysis completed', {
    trend,
    strength: strength.toFixed(1),
    bullishSignals,
    bearishSignals,
  });

  return {
    trend,
    strength,
    signals,
  };
}

/**
 * Detect significant price movements
 */
export function detectPriceMovements(
  candlesticks: Candlestick[],
  thresholdPercent: number = 5
): Array<{ timestamp: number; change: number; direction: 'up' | 'down' }> {
  const movements: Array<{ timestamp: number; change: number; direction: 'up' | 'down' }> = [];

  for (let i = 1; i < candlesticks.length; i++) {
    const prev = candlesticks[i - 1].close;
    const current = candlesticks[i].close;
    const change = ((current - prev) / prev) * 100;

    if (Math.abs(change) >= thresholdPercent) {
      movements.push({
        timestamp: candlesticks[i].openTime,
        change: Math.abs(change),
        direction: change > 0 ? 'up' : 'down',
      });
    }
  }

  return movements;
}
