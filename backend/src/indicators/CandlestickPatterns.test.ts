import { CandlestickPatterns, Candle } from './CandlestickPatterns';
import { MarketTick } from '../../../shared/src/events';

describe('CandlestickPatterns', () => {
  describe('ticksToCandles', () => {
    it('should convert ticks to candles', () => {
      const ticks: MarketTick[] = [
        { symbol: 'BTC', price: 100, timestamp: 1, volume: 1 },
        { symbol: 'BTC', price: 110, timestamp: 2, volume: 1 },
        { symbol: 'BTC', price: 105, timestamp: 3, volume: 1 },
      ];

      const candles = CandlestickPatterns.ticksToCandles(ticks);

      expect(candles).toHaveLength(2);
      expect(candles[0].open).toBe(100);
      expect(candles[0].close).toBe(110);
      expect(candles[0].high).toBe(110);
      expect(candles[0].low).toBe(100);
    });
  });

  describe('isBullishEngulfing', () => {
    it('should detect bullish engulfing pattern', () => {
      const prev: Candle = {
        open: 110,
        high: 115,
        low: 108,
        close: 105, // Red candle (close < open)
        timestamp: 1,
        volume: 1
      };

      const curr: Candle = {
        open: 104, // Below prev close
        high: 116,
        low: 103,
        close: 112, // Above prev open
        timestamp: 2,
        volume: 1
      };

      const result = CandlestickPatterns.isBullishEngulfing(prev, curr);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not detect if previous is green', () => {
      const prev: Candle = {
        open: 100,
        high: 115,
        low: 98,
        close: 110, // Green candle
        timestamp: 1,
        volume: 1
      };

      const curr: Candle = {
        open: 104,
        high: 116,
        low: 103,
        close: 112,
        timestamp: 2,
        volume: 1
      };

      const result = CandlestickPatterns.isBullishEngulfing(prev, curr);

      expect(result.detected).toBe(false);
    });

    it('should not detect if current is red', () => {
      const prev: Candle = {
        open: 110,
        high: 115,
        low: 108,
        close: 105,
        timestamp: 1,
        volume: 1
      };

      const curr: Candle = {
        open: 106,
        high: 107,
        low: 100,
        close: 101, // Red candle
        timestamp: 2,
        volume: 1
      };

      const result = CandlestickPatterns.isBullishEngulfing(prev, curr);

      expect(result.detected).toBe(false);
    });

    it('should calculate higher confidence for stronger engulfing', () => {
      const prev: Candle = {
        open: 110,
        high: 111,
        low: 109,
        close: 105, // Small red body (5)
        timestamp: 1,
        volume: 1
      };

      const curr: Candle = {
        open: 104,
        high: 120,
        low: 103,
        close: 115, // Large green body (11), more than 2x
        timestamp: 2,
        volume: 1
      };

      const result = CandlestickPatterns.isBullishEngulfing(prev, curr);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('isBearishEngulfing', () => {
    it('should detect bearish engulfing pattern', () => {
      const prev: Candle = {
        open: 100,
        high: 105,
        low: 98,
        close: 108, // Green candle
        timestamp: 1,
        volume: 1
      };

      const curr: Candle = {
        open: 109, // Above prev close
        high: 112,
        low: 95,
        close: 98, // Below prev open
        timestamp: 2,
        volume: 1
      };

      const result = CandlestickPatterns.isBearishEngulfing(prev, curr);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not detect if previous is red', () => {
      const prev: Candle = {
        open: 110,
        high: 112,
        low: 100,
        close: 105, // Red candle
        timestamp: 1,
        volume: 1
      };

      const curr: Candle = {
        open: 109,
        high: 112,
        low: 95,
        close: 98,
        timestamp: 2,
        volume: 1
      };

      const result = CandlestickPatterns.isBearishEngulfing(prev, curr);

      expect(result.detected).toBe(false);
    });
  });

  describe('isPinBar', () => {
    it('should detect bullish pin bar (hammer)', () => {
      const candle: Candle = {
        open: 100,
        high: 102,
        low: 90, // Long lower wick
        close: 101, // Small bullish body
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isPinBar(candle);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('bullish');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect bearish pin bar (shooting star)', () => {
      const candle: Candle = {
        open: 100,
        high: 115, // Long upper wick
        low: 98,
        close: 99, // Small bearish body
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isPinBar(candle);

      expect(result.detected).toBe(true);
      expect(result.type).toBe('bearish');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not detect pin bar with large body', () => {
      const candle: Candle = {
        open: 100,
        high: 110,
        low: 90,
        close: 108, // Large body (>30% of range)
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isPinBar(candle);

      expect(result.detected).toBe(false);
    });

    it('should not detect pin bar without long wick', () => {
      const candle: Candle = {
        open: 100,
        high: 102,
        low: 99, // Only 1 unit lower wick
        close: 101, // Body of 1
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isPinBar(candle);

      expect(result.detected).toBe(false);
    });

    it('should calculate higher confidence for longer wicks', () => {
      const candle: Candle = {
        open: 100,
        high: 102,
        low: 80, // Very long lower wick (20 vs body of 1)
        close: 101,
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isPinBar(candle);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8); // High confidence for 20x wick
    });
  });

  describe('isDoji', () => {
    it('should detect doji pattern', () => {
      const candle: Candle = {
        open: 100,
        high: 105,
        low: 95,
        close: 100.5, // Very close to open (0.5% difference)
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isDoji(candle);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect perfect doji', () => {
      const candle: Candle = {
        open: 100,
        high: 105,
        low: 95,
        close: 100, // Exactly at open
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isDoji(candle);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(1.0); // Perfect confidence
    });

    it('should not detect doji with large body', () => {
      const candle: Candle = {
        open: 100,
        high: 110,
        low: 90,
        close: 115, // Large body
        timestamp: 1,
        volume: 1
      };

      const result = CandlestickPatterns.isDoji(candle);

      expect(result.detected).toBe(false);
    });

    it('should respect custom threshold', () => {
      const candle: Candle = {
        open: 100,
        high: 105,
        low: 95,
        close: 102, // 2% difference
        timestamp: 1,
        volume: 1
      };

      // With default 10% threshold, should detect (2/10 = 0.2 < 0.1? No, 0.2 > 0.1)
      // Actually body/range = 2/10 = 0.2, which is > 0.1 threshold
      // Let's use a smaller body
      const dojiCandle: Candle = {
        open: 100,
        high: 105,
        low: 95,
        close: 100.5, // 0.5% difference, body/range = 0.5/10 = 0.05 < 0.1
        timestamp: 2,
        volume: 1
      };

      // With 10% threshold, should detect
      expect(CandlestickPatterns.isDoji(dojiCandle, 0.1).detected).toBe(true);
      
      // With 1% threshold, should not detect
      expect(CandlestickPatterns.isDoji(dojiCandle, 0.01).detected).toBe(false);
    });
  });

  describe('scan', () => {
    it('should scan multiple candles and find all patterns', () => {
      const candles: Candle[] = [
        {
          open: 110,
          high: 112,
          low: 108,
          close: 105, // Red
          timestamp: 1,
          volume: 1
        },
        {
          open: 104,
          high: 116,
          low: 103,
          close: 112, // Green engulfing
          timestamp: 2,
          volume: 1
        },
        {
          open: 112,
          high: 114,
          low: 100,
          close: 113, // Small green with long lower wick (pin bar)
          timestamp: 3,
          volume: 1
        },
        {
          open: 113,
          high: 118,
          low: 108,
          close: 113.1, // Doji (almost same open/close)
          timestamp: 4,
          volume: 1
        }
      ];

      const patterns = CandlestickPatterns.scan(candles);

      // Should find: Bullish Engulfing, Hammer (pin bar), and Doji
      const engulfing = patterns.find(p => p.pattern === 'Bullish Engulfing');
      const hammer = patterns.find(p => p.pattern === 'Hammer');
      const doji = patterns.find(p => p.pattern === 'Doji');

      expect(engulfing).toBeDefined();
      expect(hammer).toBeDefined();
      expect(doji).toBeDefined();

      expect(engulfing!.type).toBe('bullish');
      expect(hammer!.type).toBe('bullish');
      expect(doji!.type).toBe('neutral');
    });

    it('should return empty array for no patterns', () => {
      const candles: Candle[] = [
        {
          open: 100,
          high: 110,
          low: 95,
          close: 108, // Regular green candle
          timestamp: 1,
          volume: 1
        },
        {
          open: 109,
          high: 115,
          low: 105,
          close: 112, // Regular green candle
          timestamp: 2,
          volume: 1
        }
      ];

      const patterns = CandlestickPatterns.scan(candles);

      expect(patterns).toHaveLength(0);
    });
  });
});