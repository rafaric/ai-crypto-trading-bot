import { ADX } from './ADX';
import { Candle } from '../../../shared/src/events';

describe('ADX', () => {
  let adx: ADX;

  beforeEach(() => {
    adx = new ADX(14);
  });

  describe('Constructor', () => {
    it('should create with default period of 14', () => {
      const defaultAdx = new ADX();
      expect(defaultAdx.getPeriod()).toBe(14);
    });

    it('should create with custom period', () => {
      const customAdx = new ADX(20);
      expect(customAdx.getPeriod()).toBe(20);
    });
  });

  describe('Calculation', () => {
    it('should return nulls when insufficient data', () => {
      const candles: Candle[] = Array(20).fill(null).map((_, i) => ({
        symbol: 'BTC/USDT',
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        timestamp: Date.now() + i * 60000,
        volume: 1000,
      }));

      const result = adx.calculate(candles);
      
      // All values should be null with insufficient data
      expect(result.every(v => v === null)).toBe(true);
    });

    it('should calculate ADX with sufficient data (trending up)', () => {
      // Create candles with strong uptrend
      const candles: Candle[] = [];
      let price = 100;
      
      for (let i = 0; i < 50; i++) {
        // Strong uptrend: higher highs and higher lows
        const trend = i * 2;
        candles.push({
          symbol: 'BTC/USDT',
          open: price + trend,
          high: price + trend + 5,
          low: price + trend - 2,
          close: price + trend + 3,
          timestamp: Date.now() + i * 60000,
          volume: 1000 + i * 100,
        });
      }

      const result = adx.calculate(candles);
      
      // Last values should not be null
      const lastValue = result[result.length - 1];
      expect(lastValue).not.toBeNull();
      expect(lastValue).toBeGreaterThan(0);
    });

    it('should calculate ADX with ranging market', () => {
      // Create candles in a range (sideways)
      const candles: Candle[] = [];
      
      for (let i = 0; i < 50; i++) {
        // Oscillate between 95 and 105
        const base = 100 + Math.sin(i * 0.5) * 5;
        candles.push({
          symbol: 'BTC/USDT',
          open: base,
          high: base + 2,
          low: base - 2,
          close: base + (Math.random() - 0.5),
          timestamp: Date.now() + i * 60000,
          volume: 1000,
        });
      }

      const result = adx.calculate(candles);
      
      // Last values should not be null
      const lastValue = result[result.length - 1];
      expect(lastValue).not.toBeNull();
      // ADX should be lower in ranging market
      expect(lastValue).toBeLessThan(25);
    });

    it('should return higher ADX in strong trend vs weak trend', () => {
      // Create candles with very strong downtrend
      const strongTrendCandles: Candle[] = [];
      let price = 200;
      
      for (let i = 0; i < 50; i++) {
        // Strong downtrend - consistent lower highs and lower lows
        price -= 3;
        strongTrendCandles.push({
          symbol: 'BTC/USDT',
          open: price + 5,
          high: price + 5,
          low: price,
          close: price,
          timestamp: Date.now() + i * 60000,
          volume: 2000,
        });
      }

      const strongResult = adx.calculate(strongTrendCandles);
      const strongADX = strongResult[strongResult.length - 1];
      expect(strongADX).not.toBeNull();

      // Create candles with weak trend - some direction but messy
      const weakTrendCandles: Candle[] = [];
      price = 200;
      
      for (let i = 0; i < 50; i++) {
        // Weak downtrend - inconsistent
        price -= 1;
        const noise = Math.sin(i) * 5;
        weakTrendCandles.push({
          symbol: 'BTC/USDT',
          open: price + 5 + noise,
          high: price + 5 + noise,
          low: price + noise,
          close: price + noise,
          timestamp: Date.now() + i * 60000,
          volume: 1000,
        });
      }

      const weakResult = adx.calculate(weakTrendCandles);
      const weakADX = weakResult[weakResult.length - 1];
      expect(weakADX).not.toBeNull();

      // Strong trend should have higher ADX than weak trend
      expect(strongADX!).toBeGreaterThan(weakADX!);
    });

    it('should handle gaps in data gracefully', () => {
      const candles: Candle[] = [];
      
      for (let i = 0; i < 50; i++) {
        // Create candles with gaps (large jumps)
        const gap = i % 10 === 0 ? 20 : 0;
        const base = 100 + i + gap;
        
        candles.push({
          symbol: 'BTC/USDT',
          open: base,
          high: base + 5,
          low: base - 2,
          close: base + 1,
          timestamp: Date.now() + i * 60000,
          volume: 1000,
        });
      }

      const result = adx.calculate(candles);
      
      // Should still calculate without errors
      const lastValue = result[result.length - 1];
      expect(lastValue).not.toBeNull();
      expect(lastValue).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty array', () => {
      const result = adx.calculate([]);
      expect(result).toEqual([]);
    });

    it('should handle single candle', () => {
      const candles: Candle[] = [{
        symbol: 'BTC/USDT',
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        timestamp: Date.now(),
        volume: 1000,
      }];

      const result = adx.calculate(candles);
      expect(result.length).toBe(1);
      expect(result[0]).toBeNull();
    });

    it('should handle identical prices (no movement)', () => {
      const candles: Candle[] = Array(50).fill(null).map((_, i) => ({
        symbol: 'BTC/USDT',
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        timestamp: Date.now() + i * 60000,
        volume: 1000,
      }));

      // Should not throw error
      expect(() => adx.calculate(candles)).not.toThrow();
      
      const result = adx.calculate(candles);
      // ADX should be low or null when no movement
      const lastValue = result[result.length - 1];
      if (lastValue !== null) {
        expect(lastValue).toBeLessThanOrEqual(10);
      }
    });
  });
});
