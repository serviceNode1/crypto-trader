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
    });

    it('should return zeros for insufficient data', () => {
      const closePrices = [100, 101, 102];
      const macd = calculateMACD(closePrices);

      expect(macd.macd).toBe(0);
      expect(macd.signal).toBe(0);
      expect(macd.histogram).toBe(0);
    });

    it('should calculate histogram as difference between MACD and signal', () => {
      const closePrices = Array.from({ length: 50 }, (_i, i) => 100 + i * 0.5);
      const macd = calculateMACD(closePrices);

      if (macd.macd !== null && macd.signal !== null) {
        expect(macd.histogram).toBeCloseTo(macd.macd - macd.signal, 5);
      }
    });
  });

  describe('Bollinger Bands Calculation', () => {
    it('should calculate Bollinger Bands correctly', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 100 + Math.random() * 10);
      const bb = calculateBollingerBands(closePrices);

      expect(bb).toHaveProperty('upper');
      expect(bb).toHaveProperty('middle');
      expect(bb).toHaveProperty('lower');
      if (bb.upper !== null && bb.middle !== null && bb.lower !== null) {
        expect(bb.upper).toBeGreaterThan(bb.middle);
        expect(bb.middle).toBeGreaterThan(bb.lower);
      }
    });

    it('should return null values for insufficient data', () => {
      const closePrices = [100, 101, 102];
      const bb = calculateBollingerBands(closePrices);

      expect(bb.upper).toBe(null);
      expect(bb.middle).toBe(null);
      expect(bb.lower).toBe(null);
    });

    it('should calculate bands for flat prices', () => {
      const closePrices = Array.from({ length: 30 }, () => 100);
      const bb = calculateBollingerBands(closePrices);

      // Flat prices should have middle at 100
      expect(bb.middle).toBeCloseTo(100, 1);
    });

    it('should handle volatile prices', () => {
      const closePrices = Array.from({ length: 30 }, (_, i) => 
        i % 2 === 0 ? 100 : 120
      );
      const bb = calculateBollingerBands(closePrices);

      // Volatile prices should have wider bands
      if (bb.upper !== null && bb.lower !== null) {
        expect(bb.upper - bb.lower).toBeGreaterThan(0);
      }
    });
  });

  describe('Calculate All Indicators', () => {
    const mockCandlesticks = Array.from({ length: 100 }, (_, i) => ({
      openTime: Date.now() - (100 - i) * 3600000,
      open: 100 + Math.sin(i / 10) * 5,
      high: 105 + Math.sin(i / 10) * 5,
      low: 95 + Math.sin(i / 10) * 5,
      close: 100 + Math.sin(i / 10) * 5,
      volume: 1000000 + Math.random() * 500000,
      closeTime: Date.now() - (100 - i) * 3600000 + 3600000,
      quoteAssetVolume: 1000000,
      trades: 1000,
    }));

    it('should calculate all indicators successfully', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      expect(indicators).toHaveProperty('rsi');
      expect(indicators).toHaveProperty('macd');
      expect(indicators).toHaveProperty('bollingerBands');
      expect(indicators).toHaveProperty('ema');
      expect(indicators.ema).toHaveProperty('short');
      expect(indicators.ema).toHaveProperty('medium');
      expect(indicators.ema).toHaveProperty('long');
      expect(indicators).toHaveProperty('sma');
      expect(indicators.sma).toHaveProperty('sma20');
      expect(indicators.sma).toHaveProperty('sma50');
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

      if (indicators.bollingerBands.upper !== null && 
          indicators.bollingerBands.middle !== null && 
          indicators.bollingerBands.lower !== null) {
        expect(indicators.bollingerBands.upper).toBeGreaterThan(0);
        expect(indicators.bollingerBands.middle).toBeGreaterThan(0);
        expect(indicators.bollingerBands.lower).toBeGreaterThan(0);
      }
    });

    it('should have valid EMA values', () => {
      const indicators = calculateAllIndicators(mockCandlesticks);

      if (indicators.ema.short !== null) {
        expect(indicators.ema.short).toBeGreaterThan(0);
      }
      if (indicators.ema.medium !== null) {
        expect(indicators.ema.medium).toBeGreaterThan(0);
      }
      if (indicators.ema.long !== null) {
        expect(indicators.ema.long).toBeGreaterThan(0);
      }
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
        openTime: Date.now() - (50 - i) * 3600000,
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000000,
        closeTime: Date.now() - (50 - i) * 3600000 + 3600000,
        quoteAssetVolume: 1000000,
        trades: 1000,
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
