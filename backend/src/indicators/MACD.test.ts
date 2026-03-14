import { MACD } from './MACD';
import { MarketTick } from '../../../shared/src/events';

describe('MACD', () => {
  describe('initialization', () => {
    it('should initialize with default periods (12, 26, 9)', () => {
      const macd = new MACD();
      
      expect(macd.getFastPeriod()).toBe(12);
      expect(macd.getSlowPeriod()).toBe(26);
      expect(macd.getSignalPeriod()).toBe(9);
    });

    it('should initialize with custom periods', () => {
      const macd = new MACD(8, 21, 5);
      
      expect(macd.getFastPeriod()).toBe(8);
      expect(macd.getSlowPeriod()).toBe(21);
      expect(macd.getSignalPeriod()).toBe(5);
    });

    it('should throw error if initialized with insufficient data', () => {
      const macd = new MACD();
      const ticks: MarketTick[] = [];
      
      // Need at least slow period + signal period ticks
      for (let i = 0; i < 30; i++) {
        ticks.push({ symbol: 'BTC', price: 100 + i, timestamp: i, volume: 1 });
      }
      
      expect(() => macd.initialize(ticks)).toThrow('Need at least');
    });
  });

  describe('calculate', () => {
    it('should return null arrays if insufficient ticks', () => {
      const macd = new MACD();
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 1 },
      ];
      
      const result = macd.calculate(ticks);
      
      expect(result.macdLine.every(v => v === null)).toBe(true);
      expect(result.signalLine.every(v => v === null)).toBe(true);
      expect(result.histogram.every(v => v === null)).toBe(true);
    });

    it('should calculate MACD line correctly with uptrend', () => {
      const macd = new MACD(3, 5, 2); // Small periods for testing
      const ticks: MarketTick[] = [];
      
      // Generate uptrend: prices increasing
      for (let i = 1; i <= 10; i++) {
        ticks.push({ symbol: 'BTC', price: i * 10, timestamp: i, volume: 1 });
      }
      
      const result = macd.calculate(ticks);
      
      // First values should be null until we have enough data
      expect(result.macdLine[0]).toBeNull();
      expect(result.macdLine[1]).toBeNull();
      expect(result.macdLine[2]).toBeNull();
      expect(result.macdLine[3]).toBeNull();
      
      // After period 4 (5-1), we should start having MACD values
      // Fast EMA should be above Slow EMA in uptrend
      const lastMacd = result.macdLine[result.macdLine.length - 1];
      expect(lastMacd).not.toBeNull();
      expect(lastMacd).toBeGreaterThan(0);
    });

    it('should calculate MACD line correctly with downtrend', () => {
      const macd = new MACD(3, 5, 2);
      const ticks: MarketTick[] = [];
      
      // Generate downtrend: prices decreasing
      for (let i = 10; i >= 1; i--) {
        ticks.push({ symbol: 'BTC', price: i * 10, timestamp: 11 - i, volume: 1 });
      }
      
      const result = macd.calculate(ticks);
      
      // In downtrend, Fast EMA should be below Slow EMA
      const lastMacd = result.macdLine[result.macdLine.length - 1];
      expect(lastMacd).not.toBeNull();
      expect(lastMacd).toBeLessThan(0);
    });

    it('should calculate signal line as EMA of MACD line', () => {
      const macd = new MACD(3, 5, 2);
      const ticks: MarketTick[] = [];
      
      for (let i = 1; i <= 10; i++) {
        ticks.push({ symbol: 'BTC', price: 100 + i * 5, timestamp: i, volume: 1 });
      }
      
      const result = macd.calculate(ticks);
      
      // Signal line should lag MACD line
      const lastIdx = result.macdLine.length - 1;
      expect(result.signalLine[lastIdx]).not.toBeNull();
    });

    it('should calculate histogram as MACD minus Signal', () => {
      const macd = new MACD(3, 5, 2);
      const ticks: MarketTick[] = [];
      
      for (let i = 1; i <= 10; i++) {
        ticks.push({ symbol: 'BTC', price: 100 + i * 5, timestamp: i, volume: 1 });
      }
      
      const result = macd.calculate(ticks);
      
      // For each index where both values exist, histogram = MACD - Signal
      for (let i = 0; i < result.macdLine.length; i++) {
        if (result.macdLine[i] !== null && result.signalLine[i] !== null) {
          const expectedHistogram = result.macdLine[i]! - result.signalLine[i]!;
          expect(result.histogram[i]).toBeCloseTo(expectedHistogram, 10);
        }
      }
    });
  });

  describe('crossover detection', () => {
    it('should detect bullish crossover (MACD crosses above Signal)', () => {
      const macd = new MACD(3, 5, 2);
      
      // Create specific data that guarantees a bullish crossover
      // Need MACD < Signal (negative histogram) then MACD > Signal (positive histogram)
      // With small periods, we can create this with careful price selection
      const ticks: MarketTick[] = [
        // First establish baseline
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 3, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 4, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 5, volume: 1 },
        // Downtrend (MACD goes below signal)
        { symbol: 'BTC', price: 90, timestamp: 6, volume: 1 },
        { symbol: 'BTC', price: 85, timestamp: 7, volume: 1 },
        { symbol: 'BTC', price: 80, timestamp: 8, volume: 1 },
        { symbol: 'BTC', price: 75, timestamp: 9, volume: 1 },
        { symbol: 'BTC', price: 70, timestamp: 10, volume: 1 },
        // Sharp uptrend reversal (MACD crosses above signal)
        { symbol: 'BTC', price: 110, timestamp: 11, volume: 1 },
        { symbol: 'BTC', price: 130, timestamp: 12, volume: 1 },
        { symbol: 'BTC', price: 150, timestamp: 13, volume: 1 },
        { symbol: 'BTC', price: 170, timestamp: 14, volume: 1 },
        { symbol: 'BTC', price: 190, timestamp: 15, volume: 1 },
      ];
      
      const result = macd.calculate(ticks);
      
      // Check if any crossover was detected
      expect(result.crossovers.length).toBeGreaterThan(0);
      
      // Find bullish crossovers
      const bullishCrossovers = result.crossovers.filter((c: {type: string}) => c.type === 'bullish');
      expect(bullishCrossovers.length).toBeGreaterThan(0);
    });

    it('should detect bearish crossover (MACD crosses below Signal)', () => {
      const macd = new MACD(3, 5, 2);
      
      // Create specific data that guarantees a bearish crossover
      const ticks: MarketTick[] = [
        // First establish baseline
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 3, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 4, volume: 1 },
        { symbol: 'BTC', price: 100, timestamp: 5, volume: 1 },
        // Uptrend (MACD goes above signal)
        { symbol: 'BTC', price: 110, timestamp: 6, volume: 1 },
        { symbol: 'BTC', price: 115, timestamp: 7, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 8, volume: 1 },
        { symbol: 'BTC', price: 125, timestamp: 9, volume: 1 },
        { symbol: 'BTC', price: 130, timestamp: 10, volume: 1 },
        // Sharp downtrend reversal (MACD crosses below signal)
        { symbol: 'BTC', price: 90, timestamp: 11, volume: 1 },
        { symbol: 'BTC', price: 70, timestamp: 12, volume: 1 },
        { symbol: 'BTC', price: 50, timestamp: 13, volume: 1 },
        { symbol: 'BTC', price: 30, timestamp: 14, volume: 1 },
        { symbol: 'BTC', price: 10, timestamp: 15, volume: 1 },
      ];
      
      const result = macd.calculate(ticks);
      
      // Find bearish crossovers
      const bearishCrossovers = result.crossovers.filter((c: {type: string}) => c.type === 'bearish');
      expect(bearishCrossovers.length).toBeGreaterThan(0);
    });

    it('should include index and timestamp in crossover data', () => {
      const macd = new MACD(3, 5, 2);
      const ticks: MarketTick[] = [];
      
      for (let i = 1; i <= 15; i++) {
        ticks.push({ symbol: 'BTC', price: 100 + Math.sin(i) * 20, timestamp: i * 1000, volume: 1 });
      }
      
      const result = macd.calculate(ticks);
      
      if (result.crossovers.length > 0) {
        const crossover = result.crossovers[0];
        expect(crossover.index).toBeGreaterThanOrEqual(0);
        expect(crossover.timestamp).toBeDefined();
        expect(crossover.type).toMatch(/^(bullish|bearish)$/);
      }
    });
  });

  describe('streaming update', () => {
    it('should throw error if update called before initialization', () => {
      const macd = new MACD();
      const tick: MarketTick = { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 };
      
      expect(() => macd.update(tick)).toThrow('not initialized');
    });

    it('should update MACD with new tick', () => {
      const macd = new MACD(3, 5, 2);
      const initialTicks: MarketTick[] = [];
      
      // Initialize with enough data
      for (let i = 1; i <= 10; i++) {
        initialTicks.push({ symbol: 'BTC', price: 100 + i * 2, timestamp: i, volume: 1 });
      }
      
      macd.initialize(initialTicks);
      
      const result = macd.update({ symbol: 'BTC', price: 150, timestamp: 11, volume: 1 });
      
      expect(result.macd).not.toBeNull();
      expect(result.signal).not.toBeNull();
      expect(result.histogram).not.toBeNull();
    });

    it('should detect crossover on update', () => {
      const macd = new MACD(3, 5, 2);
      const initialTicks: MarketTick[] = [];
      
      // Initialize with downtrend (MACD below signal)
      for (let i = 0; i < 15; i++) {
        initialTicks.push({ symbol: 'BTC', price: 100 - i * 2, timestamp: i, volume: 1 });
      }
      
      macd.initialize(initialTicks);
      
      // First update - still going down
      macd.update({ symbol: 'BTC', price: 70, timestamp: 15, volume: 1 });
      
      // Now update with a big price jump to trigger bullish crossover
      const result = macd.update({ symbol: 'BTC', price: 150, timestamp: 16, volume: 1 });
      
      expect(result.crossover).toBeDefined();
    });
  });

  describe('getters', () => {
    it('should return current values after calculation', () => {
      const macd = new MACD(3, 5, 2);
      const ticks: MarketTick[] = [];
      
      for (let i = 1; i <= 10; i++) {
        ticks.push({ symbol: 'BTC', price: 100 + i, timestamp: i, volume: 1 });
      }
      
      macd.initialize(ticks);
      
      expect(macd.getCurrentMACD()).not.toBeNull();
      expect(macd.getCurrentSignal()).not.toBeNull();
      expect(macd.getCurrentHistogram()).not.toBeNull();
      expect(macd.isInitialized()).toBe(true);
    });

    it('should return null values before initialization', () => {
      const macd = new MACD();
      
      expect(macd.getCurrentMACD()).toBeNull();
      expect(macd.getCurrentSignal()).toBeNull();
      expect(macd.getCurrentHistogram()).toBeNull();
      expect(macd.isInitialized()).toBe(false);
    });
  });

  describe('standard MACD(12,26,9)', () => {
    it('should calculate standard MACD correctly with enough data', () => {
      const macd = new MACD(12, 26, 9);
      const ticks: MarketTick[] = [];
      
      // Generate 50 ticks with realistic prices
      for (let i = 1; i <= 50; i++) {
        const price = 50000 + Math.sin(i * 0.5) * 1000 + i * 10;
        ticks.push({ symbol: 'BTC', price, timestamp: i, volume: 1 });
      }
      
      const result = macd.calculate(ticks);
      
      // Should have non-null values after slow period + signal period
      const startIdx = 25 + 9 - 1; // 26 + 9 - 1 = 34
      expect(result.macdLine[startIdx]).not.toBeNull();
      expect(result.signalLine[startIdx]).not.toBeNull();
      expect(result.histogram[startIdx]).not.toBeNull();
    });
  });
});
