import { VWAP } from './VWAP';
import { Candle } from '../../../shared/src/events';

describe('VWAP', () => {
  describe('calculate', () => {
    it('should return empty array for empty input', () => {
      const vwap = new VWAP();
      const result = vwap.calculate([]);
      expect(result).toEqual([]);
    });

    it('should calculate cumulative VWAP correctly using typical price', () => {
      const vwap = new VWAP();
      const candles: Candle[] = [
        // Typical price = (high + low + close) / 3
        { symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 2 }, // TP = 100, TP*V = 200
        { symbol: 'BTC', open: 108, high: 112, low: 108, close: 110, timestamp: 2, volume: 3 }, // TP = 110, TP*V = 330
        { symbol: 'BTC', open: 118, high: 122, low: 118, close: 120, timestamp: 3, volume: 5 }, // TP = 120, TP*V = 600
      ];

      const result = vwap.calculate(candles);

      // VWAP 1: 200/2 = 100
      expect(result[0]).toBe(100);

      // VWAP 2: (200+330)/(2+3) = 530/5 = 106
      expect(result[1]).toBe(106);

      // VWAP 3: (200+330+600)/(2+3+5) = 1130/10 = 113
      expect(result[2]).toBe(113);
    });

    it('should handle zero volume', () => {
      const vwap = new VWAP();
      const candles: Candle[] = [
        { symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 0 },
        { symbol: 'BTC', open: 108, high: 112, low: 108, close: 110, timestamp: 2, volume: 2 },
      ];

      const result = vwap.calculate(candles);

      expect(result[0]).toBeNull(); // Division by zero
      expect(result[1]).toBe(110);  // 220/2 = 110
    });

    it('should weight higher volume periods more', () => {
      const vwap = new VWAP();
      const candles: Candle[] = [
        { symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 1 }, // TP = 100
        { symbol: 'BTC', open: 198, high: 202, low: 198, close: 200, timestamp: 2, volume: 9 }, // TP = 200, high volume
      ];

      const result = vwap.calculate(candles);

      // VWAP should be closer to 200 because of high volume there
      // (100*1 + 200*9) / 10 = 1900/10 = 190
      expect(result[1]).toBe(190);
    });
  });

  describe('calculateRolling', () => {
    it('should calculate rolling VWAP over window', () => {
      const vwap = new VWAP(3); // Window of 3
      const candles: Candle[] = [
        { symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 1 }, // TP = 100
        { symbol: 'BTC', open: 108, high: 112, low: 108, close: 110, timestamp: 2, volume: 1 }, // TP = 110
        { symbol: 'BTC', open: 118, high: 122, low: 118, close: 120, timestamp: 3, volume: 1 }, // TP = 120
        { symbol: 'BTC', open: 128, high: 132, low: 128, close: 130, timestamp: 4, volume: 1 }, // TP = 130
      ];

      const result = vwap.calculateRolling(candles);

      // Window 0: [100] = 100
      expect(result[0]).toBe(100);

      // Window 1: [100, 110] = 105
      expect(result[1]).toBe(105);

      // Window 2: [100, 110, 120] = 110
      expect(result[2]).toBe(110);

      // Window 3: [110, 120, 130] = 120 (rolled)
      expect(result[3]).toBe(120);
    });
  });

  describe('update', () => {
    it('should update cumulative VWAP', () => {
      const vwap = new VWAP();

      vwap.update({ symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 2 }); // TP = 100
      expect(vwap.getCurrentValue()).toBe(100);

      vwap.update({ symbol: 'BTC', open: 198, high: 202, low: 198, close: 200, timestamp: 2, volume: 2 }); // TP = 200
      // (100*2 + 200*2) / 4 = 150
      expect(vwap.getCurrentValue()).toBe(150);
    });

    it('should handle consecutive updates', () => {
      const vwap = new VWAP();

      const candles = [
        { symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 1 }, // TP = 100
        { symbol: 'BTC', open: 108, high: 112, low: 108, close: 110, timestamp: 2, volume: 1 }, // TP = 110
        { symbol: 'BTC', open: 118, high: 122, low: 118, close: 120, timestamp: 3, volume: 1 }, // TP = 120
      ];

      candles.forEach(candle => vwap.update(candle));

      expect(vwap.getCurrentValue()).toBe(110); // Average of 100, 110, 120
    });
  });

  describe('reset', () => {
    it('should reset cumulative values', () => {
      const vwap = new VWAP();

      vwap.update({ symbol: 'BTC', open: 98, high: 102, low: 98, close: 100, timestamp: 1, volume: 1 });
      expect(vwap.getCurrentValue()).toBe(100);

      vwap.reset();
      expect(vwap.getCurrentValue()).toBeNull();
    });
  });

  describe('getters', () => {
    it('should return correct period', () => {
      const vwap14 = new VWAP(14);
      const vwap20 = new VWAP(20);

      expect(vwap14.getPeriod()).toBe(14);
      expect(vwap20.getPeriod()).toBe(20);
    });
  });
});
