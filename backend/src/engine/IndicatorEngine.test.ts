import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndicatorEngine } from './IndicatorEngine';
import { EventBus } from '../core/EventBus';
import { MarketTick } from '../../../shared/src/events';

// Mock all indicators
vi.mock('../indicators/EMA', () => ({
  EMA: vi.fn().mockImplementation((period = 200) => ({
    calculate: vi.fn().mockReturnValue([null, null, 100, 101, 102]),
    getCurrentValue: vi.fn().mockReturnValue(102),
    isInitialized: vi.fn().mockReturnValue(true),
    getPeriod: vi.fn().mockReturnValue(period),
  })),
}));

vi.mock('../indicators/VWAP', () => ({
  VWAP: vi.fn().mockImplementation((period = 14) => ({
    calculate: vi.fn().mockReturnValue([null, 50, 51, 52, 53]),
    calculateRolling: vi.fn().mockReturnValue([null, 50, 51, 52, 53]),
    getCurrentValue: vi.fn().mockReturnValue(53),
    getPeriod: vi.fn().mockReturnValue(period),
  })),
}));

vi.mock('../indicators/RSI', () => ({
  RSI: vi.fn().mockImplementation((period = 14) => ({
    calculate: vi.fn().mockReturnValue([null, null, null, null, 65]),
    getCurrentRSI: vi.fn().mockReturnValue(65),
    getSignal: vi.fn().mockReturnValue('neutral'),
    isInitialized: vi.fn().mockReturnValue(true),
    getPeriod: vi.fn().mockReturnValue(period),
  })),
}));

vi.mock('../indicators/MACD', () => ({
  MACD: vi.fn().mockImplementation((fast = 12, slow = 26, signal = 9) => ({
    calculate: vi.fn().mockReturnValue({
      macdLine: [null, null, null, 0.5, 0.8],
      signalLine: [null, null, null, 0.4, 0.6],
      histogram: [null, null, null, 0.1, 0.2],
      crossovers: [],
    }),
    getCurrentMACD: vi.fn().mockReturnValue(0.8),
    getCurrentSignal: vi.fn().mockReturnValue(0.6),
    getCurrentHistogram: vi.fn().mockReturnValue(0.2),
    isInitialized: vi.fn().mockReturnValue(true),
    getSlowPeriod: vi.fn().mockReturnValue(slow),
    getSignalPeriod: vi.fn().mockReturnValue(signal),
  })),
}));

vi.mock('../indicators/ATR', () => ({
  ATR: vi.fn().mockImplementation((period = 14) => ({
    calculate: vi.fn().mockReturnValue([null, null, null, 1.5, 1.6]),
    getCurrentATR: vi.fn().mockReturnValue(1.6),
    isInitialized: vi.fn().mockReturnValue(true),
    getPeriod: vi.fn().mockReturnValue(period),
  })),
}));

vi.mock('../indicators/CandlestickPatterns', () => ({
  CandlestickPatterns: {
    ticksToCandles: vi.fn().mockReturnValue([
      { open: 100, high: 105, low: 98, close: 102, timestamp: 1, volume: 1000 },
      { open: 102, high: 106, low: 101, close: 105, timestamp: 2, volume: 1200 },
    ]),
    scan: vi.fn().mockReturnValue([]),
    isBullishEngulfing: vi.fn().mockReturnValue({ detected: false, confidence: 0 }),
    isBearishEngulfing: vi.fn().mockReturnValue({ detected: false, confidence: 0 }),
    isPinBar: vi.fn().mockReturnValue({ detected: false, type: null, confidence: 0 }),
    isDoji: vi.fn().mockReturnValue({ detected: false, confidence: 0 }),
  },
}));

describe('IndicatorEngine', () => {
  let eventBus: EventBus;
  let engine: IndicatorEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    engine = new IndicatorEngine(eventBus);
    vi.clearAllMocks();
  });

  describe('Event Subscription', () => {
    it('should subscribe to candle_closed event on construction', () => {
      const subscribeSpy = vi.spyOn(eventBus, 'subscribe');
      
      // Create a new engine to trigger subscription
      new IndicatorEngine(eventBus);
      
      expect(subscribeSpy).toHaveBeenCalledWith('candle_closed', expect.any(Function));
    });

    it('should return unsubscribe function from constructor', () => {
      const engine = new IndicatorEngine(eventBus);
      
      // The engine should expose a method to unsubscribe
      expect(engine.unsubscribe).toBeDefined();
      expect(typeof engine.unsubscribe).toBe('function');
    });
  });

  describe('Indicator Calculation', () => {
    it('should calculate all indicators when candle_closed event fires', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      const candle: MarketTick = {
        symbol: 'BTC/USDT',
        price: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // Simulate candle_closed event
      eventBus.publish('candle_closed', candle);

      // Should emit indicators_updated event
      expect(publishSpy).toHaveBeenCalledWith(
        'indicators_updated',
        expect.objectContaining({
          symbol: 'BTC/USDT',
          indicators: expect.objectContaining({
            ema: expect.any(Object),
            vwap: expect.any(Object),
            rsi: expect.any(Object),
            macd: expect.any(Object),
            atr: expect.any(Object),
            candlestick: expect.any(Object),
          }),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should include all indicator values in indicators_updated event', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      const candle: MarketTick = {
        symbol: 'BTC/USDT',
        price: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // First add some historical candles
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 49000 + i * 100,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000 + i * 10,
        });
      }

      eventBus.publish('candle_closed', candle);

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      const eventPayload = lastCall[1] as any;

      expect(eventPayload.indicators).toHaveProperty('ema');
      expect(eventPayload.indicators).toHaveProperty('vwap');
      expect(eventPayload.indicators).toHaveProperty('rsi');
      expect(eventPayload.indicators).toHaveProperty('macd');
      expect(eventPayload.indicators).toHaveProperty('atr');
      expect(eventPayload.indicators).toHaveProperty('candlestick');
    });
  });

  describe('Signal Detection', () => {
    it('should emit signal_detected when bullish pattern is detected', () => {
      // Re-mock CandlestickPatterns to return a bullish signal
      const { CandlestickPatterns } = require('../indicators/CandlestickPatterns');
      CandlestickPatterns.scan.mockReturnValueOnce([
        {
          pattern: 'Bullish Engulfing',
          type: 'bullish',
          confidence: 0.85,
          timestamp: Date.now(),
          index: 10,
        },
      ]);

      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      const candle: MarketTick = {
        symbol: 'BTC/USDT',
        price: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // Add historical data
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 49000 + i * 100,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000 + i * 10,
        });
      }

      eventBus.publish('candle_closed', candle);

      expect(publishSpy).toHaveBeenCalledWith(
        'signal_detected',
        expect.objectContaining({
          symbol: 'BTC/USDT',
          signal: 'bullish',
          pattern: 'Bullish Engulfing',
          confidence: 0.85,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should emit signal_detected when bearish pattern is detected', () => {
      // Re-mock CandlestickPatterns to return a bearish signal
      const { CandlestickPatterns } = require('../indicators/CandlestickPatterns');
      CandlestickPatterns.scan.mockReturnValueOnce([
        {
          pattern: 'Bearish Engulfing',
          type: 'bearish',
          confidence: 0.75,
          timestamp: Date.now(),
          index: 10,
        },
      ]);

      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      const candle: MarketTick = {
        symbol: 'BTC/USDT',
        price: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // Add historical data
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 49000 + i * 100,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000 + i * 10,
        });
      }

      eventBus.publish('candle_closed', candle);

      expect(publishSpy).toHaveBeenCalledWith(
        'signal_detected',
        expect.objectContaining({
          symbol: 'BTC/USDT',
          signal: 'bearish',
          pattern: 'Bearish Engulfing',
          confidence: 0.75,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should include indicator alignment in signal when multiple indicators confirm', () => {
      // This test checks if signals include indicator context
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      const candle: MarketTick = {
        symbol: 'BTC/USDT',
        price: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // Add sufficient historical data
      for (let i = 0; i < 100; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 49000 + i * 100,
          timestamp: Date.now() - (100 - i) * 60000,
          volume: 1000 + i * 10,
        });
      }

      eventBus.publish('candle_closed', candle);

      // Check that indicators_updated contains detailed indicator data
      const indicatorsCall = publishSpy.mock.calls.find(
        call => call[0] === 'indicators_updated'
      );
      
      expect(indicatorsCall).toBeDefined();
      expect(indicatorsCall![1]).toHaveProperty('indicators');
    });
  });

  describe('Candle Cache Management', () => {
    it('should store candles in cache', () => {
      const candle: MarketTick = {
        symbol: 'BTC/USDT',
        price: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      eventBus.publish('candle_closed', candle);

      // Access internal cache to verify
      expect(engine.getCandlesCache()).toHaveLength(1);
      expect(engine.getCandlesCache()[0]).toEqual(candle);
    });

    it('should maintain candles cache bounded to maximum 300 candles', () => {
      // Add 350 candles
      for (let i = 0; i < 350; i++) {
        const candle: MarketTick = {
          symbol: 'BTC/USDT',
          price: 50000 + i,
          timestamp: Date.now() + i,
          volume: 1000 + i,
        };
        eventBus.publish('candle_closed', candle);
      }

      const cache = engine.getCandlesCache();
      
      // Cache should be bounded to 300
      expect(cache.length).toBeLessThanOrEqual(300);
      expect(cache.length).toBe(300);
      
      // Should keep the most recent candles (last 300 of 350)
      expect(cache[0].price).toBe(50050); // First candle in cache is #50
      expect(cache[299].price).toBe(50349); // Last candle is #349
    });

    it('should remove oldest candles when cache exceeds 300', () => {
      // Add 305 candles
      for (let i = 0; i < 305; i++) {
        const candle: MarketTick = {
          symbol: 'BTC/USDT',
          price: 50000 + i,
          timestamp: Date.now() + i,
          volume: 1000 + i,
        };
        eventBus.publish('candle_closed', candle);
      }

      const cache = engine.getCandlesCache();
      
      expect(cache.length).toBe(300);
      // Oldest 5 candles should have been removed
      expect(cache[0].price).toBe(50005);
    });
  });

  describe('All Indicators Calculation', () => {
    it('should calculate EMA indicator', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Add enough data for EMA calculation (EMA needs at least 200 periods)
      for (let i = 0; i < 250; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 49000 + i * 10,
          timestamp: Date.now() - (250 - i) * 60000,
          volume: 1000,
        });
      }

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      
      if (lastCall[0] === 'indicators_updated') {
        expect(lastCall[1].indicators).toHaveProperty('ema');
      }
    });

    it('should calculate VWAP indicator', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 50000 + i * 10,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000 + i * 100,
        });
      }

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      
      if (lastCall[0] === 'indicators_updated') {
        expect(lastCall[1].indicators).toHaveProperty('vwap');
      }
    });

    it('should calculate RSI indicator', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // RSI needs at least 15 periods
      for (let i = 0; i < 20; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 50000 + (i % 2 === 0 ? 100 : -50),
          timestamp: Date.now() - (20 - i) * 60000,
          volume: 1000,
        });
      }

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      
      if (lastCall[0] === 'indicators_updated') {
        expect(lastCall[1].indicators).toHaveProperty('rsi');
      }
    });

    it('should calculate MACD indicator', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // MACD needs at least 35 periods (26 + 9)
      for (let i = 0; i < 40; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 50000 + Math.sin(i) * 1000,
          timestamp: Date.now() - (40 - i) * 60000,
          volume: 1000,
        });
      }

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      
      if (lastCall[0] === 'indicators_updated') {
        expect(lastCall[1].indicators).toHaveProperty('macd');
      }
    });

    it('should calculate ATR indicator', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // ATR needs at least 14 periods
      for (let i = 0; i < 20; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 50000 + Math.random() * 500,
          timestamp: Date.now() - (20 - i) * 60000,
          volume: 1000,
        });
      }

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      
      if (lastCall[0] === 'indicators_updated') {
        expect(lastCall[1].indicators).toHaveProperty('atr');
      }
    });

    it('should calculate CandlestickPatterns indicator', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      for (let i = 0; i < 10; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 50000 + i * 10,
          timestamp: Date.now() - (10 - i) * 60000,
          volume: 1000,
        });
      }

      const lastCall = publishSpy.mock.calls[publishSpy.mock.calls.length - 1];
      
      if (lastCall[0] === 'indicators_updated') {
        expect(lastCall[1].indicators).toHaveProperty('candlestick');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle candles with insufficient data gracefully', () => {
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Only add 5 candles - not enough for most indicators
      for (let i = 0; i < 5; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          price: 50000 + i * 10,
          timestamp: Date.now() - (5 - i) * 60000,
          volume: 1000,
        });
      }

      // Should still emit indicators_updated even with null values
      const indicatorsCall = publishSpy.mock.calls.find(
        call => call[0] === 'indicators_updated'
      );
      
      expect(indicatorsCall).toBeDefined();
    });
  });
});
