import { calculateRSI, calculateMACD, calculateBollingerBands, calculateAllIndicators } from '../../../src/services/analysis/technicalAnalysis';

describe('Technical Analysis', () => {
  describe('RSI Calculation', () => {
    it('should calculate RSI correctly', () => {
      const closePrices = [
        44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
        46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41,
        46.22, 45.64
      ];

      const rsi = calculateRSI(closePrices, 14);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
      expect(typeof rsi).toBe('number');
    });

    it('should return 50 for insufficient data', () => {
      const closePrices = [44, 44.34, 44.09];
      const rsi = calculateRSI(closePrices, 14);

      expect(rsi).toBe(50);
    });

    it('should handle oversold conditions', () => {
      // Declining prices should produce low RSI
      const decliningPrices = Array.from({ length: 20 }, (_, i) => 100 - i * 2);
      const rsi = calculateRSI(decliningPrices, 14);

      expect(rsi).toBeLessThan(50);
    });

    it('should handle overbought conditions', () => {
      // Rising prices should produce high RSI
      const risingPrices = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
      const rsi = calculateRSI(risingPrices, 14);

      expect(rsi).toBeGreaterThan(50);
    });
  });

  describe('MACD Calculation', () => {
    it('should calculate MACD with correct structure', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 5) * 10);
      const macd = calculateMACD(closePrices);

      expect(macd).toHaveProperty('macd');
      expect(macd).toHaveProperty('signal');
      expect(macd).toHaveProperty('histogram');
      expect(typeof macd.macd).toBe('number');
      expect(typeof macd.signal).toBe('number');
      expect(typeof macd.histogram).toBe('number');
    });

    it('should return zeros for insufficient data', () => {
      const closePrices = [100, 101, 102];
      const macd = calculateMACD(closePrices);

      expect(macd.macd).toBe(0);
      expect(macd.signal).toBe(0);
      expect(macd.histogram).toBe(0);
    });

    it('should calculate histogram as difference between MACD and signal', () => {
      const closePrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
      const macd = calculateMACD(closePrices);

      expect(macd.histogram).toBeCloseTo(macd.macd - macd.signal, 5);
    });
  });

  describe('Bollinger Bands Calculation', () => {
    it('should calculate Bollinger Bands correctly', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + Math.random() * 10);
      const currentPrice = closePrices[closePrices.length - 1];
      const bb = calculateBollingerBands(closePrices, currentPrice);

      expect(bb).toHaveProperty('upper');
      expect(bb).toHaveProperty('middle');
      expect(bb).toHaveProperty('lower');
      expect(bb).toHaveProperty('position');
      expect(bb.upper).toBeGreaterThan(bb.middle);
      expect(bb.middle).toBeGreaterThan(bb.lower);
    });

    it('should position price correctly within bands', () => {
      const closePrices = Array.from({ length: 30 }, () => 100);
      const currentPrice = 100;
      const bb = calculateBollingerBands(closePrices, currentPrice);

      // Price at middle should have position around 0.5
      expect(bb.position).toBeGreaterThanOrEqual(0);
      expect(bb.position).toBeLessThanOrEqual(1);
      expect(bb.position).toBeCloseTo(0.5, 1);
    });

    it('should handle price above upper band', () => {
      const closePrices = Array.from({ length: 30 }, () => 100);
      const currentPrice = 120; // Well above
      const bb = calculateBollingerBands(closePrices, currentPrice);

      expect(bb.position).toBeGreaterThan(1);
    });

    it('should handle price below lower band', () => {
      const closePrices = Array.from({ length: 30 }, () => 100);
      const currentPrice = 80; // Well below
      const bb = calculateBollingerBands(closePrices, currentPrice);

      expect(bb.position).toBeLessThan(0);
    });
  });

  describe('Calculate All Indicators', () => {
    const mockCandlesticks = Array.from({ length: 100 }, (_, i) => ({
      timestamp: Date.now() - (100 - i) * 3600000,
      open: 100 + Math.sin(i / 10) * 5,
      high: 105 + Math.sin(i / 10) * 5,
      low: 95 + Math.sin(i / 10) * 5,
      close: 100 + Math.sin(i / 10) * 5,
      volume: 1000000 + Math.random() * 500000,
    }));

    it('should calculate all indicators successfully', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(indicators).toHaveProperty('rsi');
      expect(indicators).toHaveProperty('macd');
      expect(indicators).toHaveProperty('bollingerBands');
      expect(indicators).toHaveProperty('ema9');
      expect(indicators).toHaveProperty('ema21');
      expect(indicators).toHaveProperty('ema50');
      expect(indicators).toHaveProperty('sma20');
      expect(indicators).toHaveProperty('sma50');
      expect(indicators).toHaveProperty('volume');
    });

    it('should have valid RSI value', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
      expect(indicators.rsi).toBeLessThanOrEqual(100);
    });

    it('should have valid MACD values', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(typeof indicators.macd.macd).toBe('number');
      expect(typeof indicators.macd.signal).toBe('number');
      expect(typeof indicators.macd.histogram).toBe('number');
    });

    it('should have valid Bollinger Bands', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(indicators.bollingerBands.upper).toBeGreaterThan(0);
      expect(indicators.bollingerBands.middle).toBeGreaterThan(0);
      expect(indicators.bollingerBands.lower).toBeGreaterThan(0);
      expect(indicators.bollingerBands.position).toBeGreaterThanOrEqual(0);
    });

    it('should have valid EMA values', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(indicators.ema9).toBeGreaterThan(0);
      expect(indicators.ema21).toBeGreaterThan(0);
      expect(indicators.ema50).toBeGreaterThan(0);
    });

    it('should have valid volume metrics', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(indicators.volume.current).toBeGreaterThan(0);
      expect(indicators.volume.average).toBeGreaterThan(0);
      expect(indicators.volume.ratio).toBeGreaterThan(0);
    });

    it('should throw error for empty candlesticks', () => {
      expect(() => calculateAllIndicators([])).toThrow();
    });

    it('should handle minimum data requirements', () => {
      const minCandlesticks = Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - (50 - i) * 3600000,
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000000,
      }));

      const indicators = calculateAllIndicators(minCandlesticks);

      expect(indicators).toBeDefined();
      expect(indicators.rsi).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle flat prices', () => {
      const flatPrices = Array.from({ length: 20 }, () => 100);
      const rsi = calculateRSI(flatPrices, 14);

      // Flat prices should result in RSI around 50
      expect(rsi).toBeCloseTo(50, 0);
    });

    it('should handle extreme volatility', () => {
      const volatilePrices = Array.from({ length: 20 }, (_, i) => 
        i % 2 === 0 ? 100 : 200
      );
      const rsi = calculateRSI(volatilePrices, 14);

      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should handle very small numbers', () => {
      const smallPrices = Array.from({ length: 20 }, (_, i) => 0.001 + i * 0.0001);
      const rsi = calculateRSI(smallPrices, 14);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
    });

    it('should handle very large numbers', () => {
      const largePrices = Array.from({ length: 20 }, (_, i) => 1000000 + i * 1000);
      const rsi = calculateRSI(largePrices, 14);

      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
    });
  });
});
