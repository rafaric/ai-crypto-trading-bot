import { RSI } from './RSI';
import { MarketTick } from '../../../shared/src/events';

describe('RSI', () => {
  describe('initialization', () => {
    it('should throw error if initialized with insufficient data', () => {
      const rsi = new RSI(14);
      const closes = new Array(14).fill(100); // Need 15, have 14
      
      expect(() => rsi.initialize(closes)).toThrow('Need at least 15 closes');
    });

    it('should initialize with Wilder smoothing', () => {
      const rsi = new RSI(3); // Small period for testing
      // Uptrend: 100 → 110 → 120 → 130
      const closes = [100, 110, 120, 130];
      
      const result = rsi.initialize(closes);
      
      expect(rsi.isInitialized()).toBe(true);
      expect(result).toBeGreaterThan(50); // Should be bullish
    });
  });

  describe('update', () => {
    it('should throw error if update called before initialization', () => {
      const rsi = new RSI(14);
      
      expect(() => rsi.update(100)).toThrow('RSI not initialized');
    });

    it('should calculate RSI correctly for uptrend', () => {
      const rsi = new RSI(3);
      rsi.initialize([100, 110, 120, 130]);
      
      // Continue uptrend: 130 → 140
      const result = rsi.update(140);
      
      expect(result).toBeGreaterThan(50);
      expect(result).toBeLessThanOrEqual(100); // Can be exactly 100 if no losses
    });

    it('should calculate RSI correctly for downtrend', () => {
      const rsi = new RSI(3);
      rsi.initialize([130, 120, 110, 100]);
      
      // Continue downtrend: 100 → 90
      const result = rsi.update(90);
      
      expect(result).toBeLessThan(50);
      expect(result).toBeGreaterThanOrEqual(0); // Can be exactly 0 if no gains
    });

    it('should approach 100 in strong uptrend', () => {
      const rsi = new RSI(3);
      rsi.initialize([100, 110, 120, 130]);
      
      // Multiple strong up moves
      rsi.update(145);
      rsi.update(160);
      rsi.update(180);
      rsi.update(200);
      
      const finalRSI = rsi.getCurrentRSI();
      expect(finalRSI).toBeGreaterThan(80);
    });

    it('should approach 0 in strong downtrend', () => {
      const rsi = new RSI(3);
      rsi.initialize([200, 180, 160, 140]);
      
      // Multiple strong down moves
      rsi.update(120);
      rsi.update(100);
      rsi.update(80);
      rsi.update(60);
      
      const finalRSI = rsi.getCurrentRSI();
      expect(finalRSI).toBeLessThan(20);
    });
  });

  describe('calculate from ticks', () => {
    it('should return null array if insufficient ticks', () => {
      const rsi = new RSI(5);
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 1 },
        { symbol: 'BTC', price: 130, timestamp: 4, volume: 1 },
        { symbol: 'BTC', price: 140, timestamp: 5, volume: 1 },
      ]; // Need 6, have 5
      
      const result = rsi.calculate(ticks);
      
      expect(result.every(v => v === null)).toBe(true);
    });

    it('should detect overbought condition', () => {
      const rsi = new RSI(3);
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 120, timestamp: 3, volume: 1 },
        { symbol: 'BTC', price: 140, timestamp: 4, volume: 1 }, // Big jump
        { symbol: 'BTC', price: 170, timestamp: 5, volume: 1 }, // Bigger jump
        { symbol: 'BTC', price: 200, timestamp: 6, volume: 1 }, // Huge jump
      ];
      
      const result = rsi.calculate(ticks);
      
      // Last RSI should be high (overbought)
      const lastRSI = result[result.length - 1];
      expect(lastRSI).toBeGreaterThan(70);
    });

    it('should detect oversold condition', () => {
      const rsi = new RSI(3);
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 200, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 190, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 180, timestamp: 3, volume: 1 },
        { symbol: 'BTC', price: 160, timestamp: 4, volume: 1 }, // Big drop
        { symbol: 'BTC', price: 130, timestamp: 5, volume: 1 }, // Bigger drop
        { symbol: 'BTC', price: 100, timestamp: 6, volume: 1 }, // Huge drop
      ];
      
      const result = rsi.calculate(ticks);
      
      // Last RSI should be low (oversold)
      const lastRSI = result[result.length - 1];
      expect(lastRSI).toBeLessThan(30);
    });

    it('should work with RSI 14 period', () => {
      const rsi = new RSI(14);
      const ticks: MarketTick[] = [];
      
      // Generate 20 ticks with alternating up/down
      let price = 100;
      for (let i = 1; i <= 20; i++) {
        price += (i % 2 === 0 ? 5 : -3); // Slight upward bias
        ticks.push({
          symbol: 'BTC',
          price,
          timestamp: i,
          volume: 1
        });
      }
      
      const result = rsi.calculate(ticks);
      
      // First 14 should be null
      expect(result[0]).toBeNull();
      expect(result[13]).toBeNull();
      
      // Index 14 onwards should have values
      expect(result[14]).not.toBeNull();
      expect(result[19]).not.toBeNull();
    });
  });

  describe('getSignal', () => {
    it('should return overbought when RSI > 70', () => {
      const rsi = new RSI(3);
      rsi.initialize([100, 110, 120, 130]);
      
      // Push RSI high
      for (let i = 0; i < 10; i++) {
        rsi.update(150 + i * 10);
      }
      
      expect(rsi.getSignal()).toBe('overbought');
    });

    it('should return oversold when RSI < 30', () => {
      const rsi = new RSI(3);
      rsi.initialize([200, 180, 160, 140]);
      
      // Push RSI low
      for (let i = 0; i < 10; i++) {
        rsi.update(130 - i * 10);
      }
      
      expect(rsi.getSignal()).toBe('oversold');
    });

    it('should return neutral when 30 <= RSI <= 70', () => {
      const rsi = new RSI(4);
      // More balanced up/down moves: 2 up, 2 down, equal magnitudes
      rsi.initialize([100, 102, 100, 102, 100]);
      
      expect(rsi.getSignal()).toBe('neutral');
    });

    it('should return null when not initialized', () => {
      const rsi = new RSI(14);
      expect(rsi.getSignal()).toBeNull();
    });
  });

  describe('getters', () => {
    it('should return correct period', () => {
      const rsi14 = new RSI(14);
      const rsi7 = new RSI(7);
      
      expect(rsi14.getPeriod()).toBe(14);
      expect(rsi7.getPeriod()).toBe(7);
    });
  });
});