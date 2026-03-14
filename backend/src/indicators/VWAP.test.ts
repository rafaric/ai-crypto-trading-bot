import { VWAP } from './VWAP';
import { MarketTick } from '../../../shared/src/events';

describe('VWAP', () => {
  describe('calculate', () => {
    it('should return empty array for empty input', () => {
      const vwap = new VWAP();
      const result = vwap.calculate([]);
      expect(result).toEqual([]);
    });

    it('should calculate cumulative VWAP correctly', () => {
      const vwap = new VWAP();
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 2 }, // 100*2 = 200, vol = 2
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 3 }, // 110*3 = 330, vol = 3
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 5 }, // 120*5 = 600, vol = 5
      ];
      
      const result = vwap.calculate(ticks);
      
      // VWAP 1: 200/2 = 100
      expect(result[0]).toBe(100);
      
      // VWAP 2: (200+330)/(2+3) = 530/5 = 106
      expect(result[1]).toBe(106);
      
      // VWAP 3: (200+330+600)/(2+3+5) = 1130/10 = 113
      expect(result[2]).toBe(113);
    });

    it('should handle zero volume', () => {
      const vwap = new VWAP();
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 0 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 2 },
      ];
      
      const result = vwap.calculate(ticks);
      
      expect(result[0]).toBeNull(); // Division by zero
      expect(result[1]).toBe(110);  // 220/2 = 110
    });

    it('should weight higher volume periods more', () => {
      const vwap = new VWAP();
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 200, timestamp: 2, volume: 9 }, // High volume at high price
      ];
      
      const result = vwap.calculate(ticks);
      
      // VWAP should be closer to 200 because of high volume there
      // (100*1 + 200*9) / 10 = 1900/10 = 190
      expect(result[1]).toBe(190);
    });
  });

  describe('calculateRolling', () => {
    it('should calculate rolling VWAP over window', () => {
      const vwap = new VWAP(3); // Window of 3
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 1 },
        { symbol: 'BTC', price: 130, timestamp: 4, volume: 1 },
      ];
      
      const result = vwap.calculateRolling(ticks);
      
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
      
      vwap.update({ symbol: 'BTC', price: 100, timestamp: 1, volume: 2 });
      expect(vwap.getCurrentValue()).toBe(100);
      
      vwap.update({ symbol: 'BTC', price: 200, timestamp: 2, volume: 2 });
      // (100*2 + 200*2) / 4 = 150
      expect(vwap.getCurrentValue()).toBe(150);
    });

    it('should handle consecutive updates', () => {
      const vwap = new VWAP();
      
      const values = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 1 },
      ];
      
      values.forEach(tick => vwap.update(tick));
      
      expect(vwap.getCurrentValue()).toBe(110); // Average of 100, 110, 120
    });
  });

  describe('reset', () => {
    it('should reset cumulative values', () => {
      const vwap = new VWAP();
      
      vwap.update({ symbol: 'BTC', price: 100, timestamp: 1, volume: 1 });
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