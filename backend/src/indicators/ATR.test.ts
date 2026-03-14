import { ATR } from './ATR';
import { Candle } from './CandlestickPatterns';

describe('ATR', () => {
  describe('initialization', () => {
    it('should initialize with default period (14)', () => {
      const atr = new ATR();
      
      expect(atr.getPeriod()).toBe(14);
    });

    it('should initialize with custom period', () => {
      const atr = new ATR(10);
      
      expect(atr.getPeriod()).toBe(10);
    });

    it('should throw error if initialized with insufficient candles', () => {
      const atr = new ATR(14);
      const candles: Candle[] = [];
      
      // Create only 10 candles, need at least 14
      for (let i = 0; i < 10; i++) {
        candles.push({
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          timestamp: i,
          volume: 1
        });
      }
      
      expect(() => atr.initialize(candles)).toThrow('Need at least');
    });
  });

  describe('true range calculation', () => {
    it('should calculate true range correctly for first candle', () => {
      const atr = new ATR(14);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
      ];
      
      // First candle: TR = High - Low (no previous close)
      const tr = atr.calculateTrueRange(candles[0], null);
      expect(tr).toBe(15); // 110 - 95 = 15
    });

    it('should calculate true range with previous close', () => {
      const atr = new ATR(14);
      const prevClose = 100;
      const candle: Candle = { open: 102, high: 110, low: 98, close: 105, timestamp: 2, volume: 1 };
      
      // TR = max(high-low, |high-prevClose|, |low-prevClose|)
      // TR = max(110-98, |110-100|, |98-100|)
      // TR = max(12, 10, 2) = 12
      const tr = atr.calculateTrueRange(candle, prevClose);
      expect(tr).toBe(12);
    });

    it('should calculate true range when prev close is outside current range', () => {
      const atr = new ATR(14);
      const prevClose = 120; // Above current high
      const candle: Candle = { open: 100, high: 105, low: 95, close: 102, timestamp: 2, volume: 1 };
      
      // TR = max(105-95, |105-120|, |95-120|)
      // TR = max(10, 15, 25) = 25
      const tr = atr.calculateTrueRange(candle, prevClose);
      expect(tr).toBe(25);
    });
  });

  describe('calculate', () => {
    it('should return null array if insufficient candles', () => {
      const atr = new ATR(14);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 102, timestamp: 1, volume: 1 },
        { open: 102, high: 107, low: 100, close: 105, timestamp: 2, volume: 1 },
      ];
      
      const result = atr.calculate(candles);
      
      expect(result.every(v => v === null)).toBe(true);
    });

    it('should calculate ATR using Wilder\'s smoothing', () => {
      const atr = new ATR(3); // Small period for testing
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
        { open: 115, high: 118, low: 112, close: 116, timestamp: 4, volume: 1 },
      ];
      
      const result = atr.calculate(candles);
      
      // First 2 should be null (need period=3)
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      
      // Third value should be the average of first 3 TR values
      expect(result[2]).not.toBeNull();
      expect(typeof result[2]).toBe('number');
    });

    it('should produce higher ATR for volatile candles', () => {
      const atr = new ATR(3);
      
      // Low volatility candles
      const lowVolCandles: Candle[] = [
        { open: 100, high: 101, low: 99, close: 100, timestamp: 1, volume: 1 },
        { open: 100, high: 101, low: 99, close: 100, timestamp: 2, volume: 1 },
        { open: 100, high: 101, low: 99, close: 100, timestamp: 3, volume: 1 },
        { open: 100, high: 101, low: 99, close: 100, timestamp: 4, volume: 1 },
      ];
      
      // High volatility candles
      const highVolCandles: Candle[] = [
        { open: 100, high: 120, low: 80, close: 100, timestamp: 1, volume: 1 },
        { open: 100, high: 120, low: 80, close: 100, timestamp: 2, volume: 1 },
        { open: 100, high: 120, low: 80, close: 100, timestamp: 3, volume: 1 },
        { open: 100, high: 120, low: 80, close: 100, timestamp: 4, volume: 1 },
      ];
      
      const lowVolResult = atr.calculate(lowVolCandles);
      const highVolResult = atr.calculate(highVolCandles);
      
      // Last ATR of high volatility should be higher than low volatility
      expect(highVolResult[3]).toBeGreaterThan(lowVolResult[3]!);
    });

    it('should handle standard period of 14', () => {
      const atr = new ATR(14);
      const candles: Candle[] = [];
      
      // Generate 20 candles
      for (let i = 0; i < 20; i++) {
        candles.push({
          open: 100 + i,
          high: 110 + i,
          low: 90 + i,
          close: 105 + i,
          timestamp: i,
          volume: 1
        });
      }
      
      const result = atr.calculate(candles);
      
      // First 13 should be null
      for (let i = 0; i < 13; i++) {
        expect(result[i]).toBeNull();
      }
      
      // Index 13 should have the first ATR value (simple average)
      expect(result[13]).not.toBeNull();
      
      // Index 14+ should have smoothed values
      expect(result[14]).not.toBeNull();
    });
  });

  describe('streaming update', () => {
    it('should throw error if update called before initialization', () => {
      const atr = new ATR(14);
      const candle: Candle = { open: 100, high: 105, low: 95, close: 102, timestamp: 1, volume: 1 };
      
      expect(() => atr.update(candle)).toThrow('not initialized');
    });

    it('should update ATR with new candle using Wilder\'s smoothing', () => {
      const atr = new ATR(3);
      const initialCandles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
      ];
      
      atr.initialize(initialCandles);
      const initialATR = atr.getCurrentATR();
      
      // Update with new candle
      const newCandle: Candle = { open: 115, high: 125, low: 110, close: 120, timestamp: 4, volume: 1 };
      const updatedATR = atr.update(newCandle);
      
      expect(updatedATR).not.toBeNull();
      expect(typeof updatedATR).toBe('number');
    });
  });

  describe('stop loss calculator', () => {
    it('should calculate long stop loss based on ATR multiplier', () => {
      const atr = new ATR(3);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
      ];
      
      atr.initialize(candles);
      const currentATR = atr.getCurrentATR()!;
      
      // Calculate long stop loss at 2x ATR below entry
      const entryPrice = 115;
      const stopLoss = atr.calculateStopLoss(entryPrice, 'long', 2);
      
      expect(stopLoss).toBe(entryPrice - (currentATR * 2));
    });

    it('should calculate short stop loss based on ATR multiplier', () => {
      const atr = new ATR(3);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
      ];
      
      atr.initialize(candles);
      const currentATR = atr.getCurrentATR()!;
      
      // Calculate short stop loss at 1.5x ATR above entry
      const entryPrice = 115;
      const stopLoss = atr.calculateStopLoss(entryPrice, 'short', 1.5);
      
      expect(stopLoss).toBe(entryPrice + (currentATR * 1.5));
    });

    it('should use default multiplier of 2 if not specified', () => {
      const atr = new ATR(3);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
      ];
      
      atr.initialize(candles);
      const currentATR = atr.getCurrentATR()!;
      
      const entryPrice = 115;
      const stopLoss = atr.calculateStopLoss(entryPrice, 'long');
      
      expect(stopLoss).toBe(entryPrice - (currentATR * 2));
    });

    it('should calculate take profit based on risk:reward ratio', () => {
      const atr = new ATR(3);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
      ];
      
      atr.initialize(candles);
      const currentATR = atr.getCurrentATR()!;
      
      const entryPrice = 115;
      const stopLoss = atr.calculateStopLoss(entryPrice, 'long', 2);
      const takeProfit = atr.calculateTakeProfit(entryPrice, stopLoss, 'long', 2);
      
      // Risk = entry - stopLoss, Reward should be 2x risk
      const risk = entryPrice - stopLoss;
      expect(takeProfit).toBe(entryPrice + (risk * 2));
    });

    it('should throw error if stop loss calculated before initialization', () => {
      const atr = new ATR(14);
      
      expect(() => atr.calculateStopLoss(100, 'long')).toThrow('not initialized');
    });
  });

  describe('getters', () => {
    it('should return current ATR after initialization', () => {
      const atr = new ATR(3);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 95, close: 105, timestamp: 1, volume: 1 },
        { open: 105, high: 115, low: 100, close: 110, timestamp: 2, volume: 1 },
        { open: 110, high: 120, low: 105, close: 115, timestamp: 3, volume: 1 },
      ];
      
      atr.initialize(candles);
      
      expect(atr.getCurrentATR()).not.toBeNull();
      expect(atr.isInitialized()).toBe(true);
    });

    it('should return null ATR before initialization', () => {
      const atr = new ATR(14);
      
      expect(atr.getCurrentATR()).toBeNull();
      expect(atr.isInitialized()).toBe(false);
    });
  });
});
