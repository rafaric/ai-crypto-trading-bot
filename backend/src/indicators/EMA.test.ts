import { EMA } from './EMA';
import { MarketTick } from '../../../shared/src/events';

describe('EMA', () => {
  describe('initialization', () => {
    it('should throw error if initialized with insufficient data', () => {
      const ema = new EMA(200);
      const closes = new Array(199).fill(100);
      
      expect(() => ema.initialize(closes)).toThrow('Need at least 200 closes');
    });

    it('should initialize with SMA of first N periods', () => {
      const ema = new EMA(3); // Using small period for test
      const closes = [100, 110, 120]; // SMA = 110
      
      const result = ema.initialize(closes);
      
      expect(result).toBe(110);
      expect(ema.isInitialized()).toBe(true);
      expect(ema.getCurrentValue()).toBe(110);
    });
  });

  describe('update', () => {
    it('should throw error if update called before initialization', () => {
      const ema = new EMA(200);
      
      expect(() => ema.update(100)).toThrow('EMA not initialized');
    });

    it('should calculate EMA correctly after initialization', () => {
      const ema = new EMA(3);
      ema.initialize([100, 110, 120]); // SMA = 110
      
      // EMA = 130 * (2/4) + 110 * (2/4) = 65 + 55 = 120
      const result = ema.update(130);
      
      expect(result).toBe(120);
      expect(ema.getCurrentValue()).toBe(120);
    });

    it('should calculate multiple updates correctly', () => {
      const ema = new EMA(3);
      ema.initialize([10, 20, 30]); // SMA = 20
      
      // k = 2/(3+1) = 0.5
      const ema1 = ema.update(40); // 40*0.5 + 20*0.5 = 30
      const ema2 = ema.update(50); // 50*0.5 + 30*0.5 = 40
      
      expect(ema1).toBe(30);
      expect(ema2).toBe(40);
    });
  });

  describe('calculate from ticks', () => {
    it('should return null array if insufficient ticks', () => {
      const ema = new EMA(5);
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 1 },
      ];
      
      const result = ema.calculate(ticks);
      
      expect(result).toEqual([null, null, null]);
    });

    it('should calculate EMA series correctly', () => {
      const ema = new EMA(3);
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 10, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 20, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 30, timestamp: 3, volume: 1 }, // SMA = 20
        { symbol: 'BTC', price: 40, timestamp: 4, volume: 1 }, // EMA = 30
        { symbol: 'BTC', price: 50, timestamp: 5, volume: 1 }, // EMA = 40
      ];
      
      const result = ema.calculate(ticks);
      
      expect(result[0]).toBeNull(); // Not enough data
      expect(result[1]).toBeNull(); // Not enough data
      expect(result[2]).toBe(20);   // SMA of first 3
      expect(result[3]).toBe(30);   // EMA update
      expect(result[4]).toBe(40);   // EMA update
    });

    it('should work with EMA 200 period', () => {
      const ema = new EMA(200);
      const ticks: MarketTick[] = [];
      
      // Generate 250 ticks with price = index
      for (let i = 1; i <= 250; i++) {
        ticks.push({
          symbol: 'BTC',
          price: i,
          timestamp: i,
          volume: 1
        });
      }
      
      const result = ema.calculate(ticks);
      
      // First 199 should be null
      expect(result[0]).toBeNull();
      expect(result[198]).toBeNull();
      
      // Index 199 should have SMA of first 200 (average of 1..200 = 100.5)
      expect(result[199]).toBeCloseTo(100.5, 1);
      
      // Subsequent values should be EMA
      expect(result[200]).toBeGreaterThan(result[199]!);
    });
  });

  describe('getters', () => {
    it('should return correct period', () => {
      const ema200 = new EMA(200);
      const ema50 = new EMA(50);
      
      expect(ema200.getPeriod()).toBe(200);
      expect(ema50.getPeriod()).toBe(50);
    });
  });
});