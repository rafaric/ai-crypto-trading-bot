// Jest globals are available automatically
import { IndicatorEngine } from './IndicatorEngine';
import { EventBus } from '../core/EventBus';
import { Candle } from '../../../shared/src/events';

// Mock all indicators
jest.mock('../indicators/EMA', () => ({
  EMA: jest.fn().mockImplementation((period = 200) => ({
    calculate: jest.fn().mockReturnValue([null, null, 100, 101, 102]),
    getCurrentValue: jest.fn().mockReturnValue(102),
    isInitialized: jest.fn().mockReturnValue(true),
    getPeriod: jest.fn().mockReturnValue(period),
  })),
}));

jest.mock('../indicators/VWAP', () => ({
  VWAP: jest.fn().mockImplementation((period = 14) => ({
    calculate: jest.fn().mockReturnValue([null, 50, 51, 52, 53]),
    calculateRolling: jest.fn().mockReturnValue([null, 50, 51, 52, 53]),
    getCurrentValue: jest.fn().mockReturnValue(53),
    getPeriod: jest.fn().mockReturnValue(period),
  })),
}));

jest.mock('../indicators/RSI', () => ({
  RSI: jest.fn().mockImplementation((period = 14) => ({
    calculate: jest.fn().mockReturnValue([null, null, null, null, 65]),
    getCurrentRSI: jest.fn().mockReturnValue(65),
    getSignal: jest.fn().mockReturnValue('neutral'),
    isInitialized: jest.fn().mockReturnValue(true),
    getPeriod: jest.fn().mockReturnValue(period),
  })),
}));

jest.mock('../indicators/MACD', () => ({
  MACD: jest.fn().mockImplementation((fast = 12, slow = 26, signal = 9) => ({
    calculate: jest.fn().mockReturnValue({
      macdLine: [null, null, null, 0.5, 0.8],
      signalLine: [null, null, null, 0.4, 0.6],
      histogram: [null, null, null, 0.1, 0.2],
      crossovers: [],
    }),
    getCurrentMACD: jest.fn().mockReturnValue(0.8),
    getCurrentSignal: jest.fn().mockReturnValue(0.6),
    getCurrentHistogram: jest.fn().mockReturnValue(0.2),
    isInitialized: jest.fn().mockReturnValue(true),
    getSlowPeriod: jest.fn().mockReturnValue(slow),
    getSignalPeriod: jest.fn().mockReturnValue(signal),
  })),
}));

jest.mock('../indicators/ATR', () => ({
  ATR: jest.fn().mockImplementation((period = 14) => ({
    calculate: jest.fn().mockReturnValue([null, null, null, 1.5, 1.6]),
    getCurrentATR: jest.fn().mockReturnValue(1.6),
    isInitialized: jest.fn().mockReturnValue(true),
    getPeriod: jest.fn().mockReturnValue(period),
  })),
}));

jest.mock('../indicators/CandlestickPatterns', () => ({
  CandlestickPatterns: {
    ticksToCandles: jest.fn().mockReturnValue([
      { open: 100, high: 105, low: 98, close: 102, timestamp: 1, volume: 1000 },
      { open: 102, high: 106, low: 101, close: 105, timestamp: 2, volume: 1200 },
    ]),
    scan: jest.fn().mockReturnValue([]),
    isBullishEngulfing: jest.fn().mockReturnValue({ detected: false, confidence: 0 }),
    isBearishEngulfing: jest.fn().mockReturnValue({ detected: false, confidence: 0 }),
    isPinBar: jest.fn().mockReturnValue({ detected: false, type: null, confidence: 0 }),
    isDoji: jest.fn().mockReturnValue({ detected: false, confidence: 0 }),
  },
}));

// Mock MarketRegimeDetector
jest.mock('./MarketRegimeDetector', () => ({
  MarketRegimeDetector: jest.fn().mockImplementation(() => ({
    getCurrentRegime: jest.fn().mockReturnValue(null),
    unsubscribe: jest.fn(),
  })),
}));

describe('IndicatorEngine', () => {
  let eventBus: EventBus;
  let engine: IndicatorEngine;

  beforeEach(() => {
    eventBus = new EventBus();
    engine = new IndicatorEngine(eventBus);
    jest.clearAllMocks();
  });

  afterEach(() => {
    engine.unsubscribe();
  });

  describe('Event Subscription', () => {
    it('should subscribe to candle_closed event on construction', () => {
      const subscribeSpy = jest.spyOn(eventBus, 'subscribe');
      
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

  describe('Multi-Pair Support', () => {
    it('should maintain separate candle caches for each pair', () => {
      const btcCandle: Candle = {
        symbol: 'BTCUSDT',
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };
      
      const ethCandle: Candle = {
        symbol: 'ETHUSDT',
        open: 3000,
        high: 3000,
        low: 3000,
        close: 3000,
        timestamp: Date.now(),
        volume: 500,
      };

      eventBus.publish('candle_closed', btcCandle);
      eventBus.publish('candle_closed', ethCandle);

      // Access internal cache to verify
      const btcCache = engine.getCandlesCache('BTCUSDT');
      const ethCache = engine.getCandlesCache('ETHUSDT');
      
      expect(btcCache).toHaveLength(1);
      expect(ethCache).toHaveLength(1);
      expect(btcCache[0].symbol).toBe('BTCUSDT');
      expect(ethCache[0].symbol).toBe('ETHUSDT');
    });

    it('should calculate indicators independently for each pair', () => {
      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      // Add candles for BTC
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 49000 + i * 100,
          high: 49000 + i * 100,
          low: 49000 + i * 100,
          close: 49000 + i * 100,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000,
        });
      }

      // Add candles for ETH
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'ETHUSDT',
          open: 2900 + i * 10,
          high: 2900 + i * 10,
          low: 2900 + i * 10,
          close: 2900 + i * 10,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 500,
        });
      }

      // Get all indicators_updated events
      const indicatorsEvents = publishSpy.mock.calls.filter(
        call => call[0] === 'indicators_updated'
      );

      // Should have events for both pairs
      const btcEvent = indicatorsEvents.find((call: any) => call[1].symbol === 'BTCUSDT');
      const ethEvent = indicatorsEvents.find((call: any) => call[1].symbol === 'ETHUSDT');
      
      expect(btcEvent).toBeDefined();
      expect(ethEvent).toBeDefined();
    });

    it('should emit indicators_updated with pair symbol included', () => {
      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      const candle: Candle = {
        symbol: 'SOLUSDT',
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        timestamp: Date.now(),
        volume: 100,
      };

      eventBus.publish('candle_closed', candle);

      expect(publishSpy).toHaveBeenCalledWith(
        'indicators_updated',
        expect.objectContaining({
          symbol: 'SOLUSDT',
          indicators: expect.any(Object),
          timestamp: expect.any(Number),
        })
      );
    });

    it('should maintain bounded cache (300 candles) per pair independently', () => {
      // Add 350 candles for BTC
      for (let i = 0; i < 350; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 50000 + i,
          high: 50000 + i,
          low: 50000 + i,
          close: 50000 + i,
          timestamp: Date.now() + i,
          volume: 1000,
        });
      }

      // Add only 50 candles for ETH
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'ETHUSDT',
          open: 3000 + i,
          high: 3000 + i,
          low: 3000 + i,
          close: 3000 + i,
          timestamp: Date.now() + i,
          volume: 500,
        });
      }

      const btcCache = engine.getCandlesCache('BTCUSDT');
      const ethCache = engine.getCandlesCache('ETHUSDT');
      
      // BTC should be bounded to 300
      expect(btcCache.length).toBe(300);
      
      // ETH should have all 50 candles
      expect(ethCache.length).toBe(50);
    });

    it('should track regimes per pair independently', () => {
      // Set regime for BTC
      eventBus.publish('market_regime_changed', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      // Set different regime for ETH
      eventBus.publish('market_regime_changed', {
        symbol: 'ETHUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.7,
        timestamp: Date.now(),
      });

      expect(engine.getCurrentRegime('BTCUSDT')?.regime).toBe('TRENDING_UP');
      expect(engine.getCurrentRegime('ETHUSDT')?.regime).toBe('TRENDING_DOWN');
    });
  });

  describe('Indicator Calculation', () => {
    it('should calculate all indicators when candle_closed event fires', () => {
      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      const candle: Candle = {
        symbol: 'BTC/USDT',
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
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
      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      const candle: Candle = {
        symbol: 'BTC/USDT',
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // First add some historical candles
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTC/USDT',
          open: 49000 + i * 100,
          high: 49000 + i * 100,
          low: 49000 + i * 100,
          close: 49000 + i * 100,
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
    it('should emit SignalGenerated when bullish pattern is detected', () => {
      // Set regime first - signals blocked until regime is calculated
      eventBus.publish('market_regime_changed', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.8,
        timestamp: Date.now(),
      });

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

      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      const candle: Candle = {
        symbol: 'BTCUSDT',
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // Add historical data
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 49000 + i * 100,
          high: 49000 + i * 100,
          low: 49000 + i * 100,
          close: 49000 + i * 100,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000 + i * 10,
        });
      }

      eventBus.publish('candle_closed', candle);

      expect(publishSpy).toHaveBeenCalledWith(
        'SignalGenerated',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          action: 'BUY',
          strategy: 'Bullish Engulfing',
          confidence: 0.85,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should emit SignalGenerated when bearish pattern is detected', () => {
      // Set regime first - signals blocked until regime is calculated
      eventBus.publish('market_regime_changed', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.8,
        timestamp: Date.now(),
      });

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

      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      const candle: Candle = {
        symbol: 'BTCUSDT',
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      // Add historical data
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 49000 + i * 100,
          high: 49000 + i * 100,
          low: 49000 + i * 100,
          close: 49000 + i * 100,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000 + i * 10,
        });
      }

      eventBus.publish('candle_closed', candle);

      expect(publishSpy).toHaveBeenCalledWith(
        'SignalGenerated',
        expect.objectContaining({
          symbol: 'BTCUSDT',
          action: 'SELL',
          strategy: 'Bearish Engulfing',
          confidence: 0.75,
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('Candle Cache Management', () => {
    it('should store candles in cache per symbol', () => {
      const candle: Candle = {
        symbol: 'BTCUSDT',
        open: 50000,
        high: 50000,
        low: 50000,
        close: 50000,
        timestamp: Date.now(),
        volume: 1000,
      };

      eventBus.publish('candle_closed', candle);

      // Access internal cache to verify
      const cache = engine.getCandlesCache('BTCUSDT');
      expect(cache).toHaveLength(1);
      expect(cache[0]).toEqual(candle);
    });

    it('should maintain candles cache bounded to maximum 300 candles per pair', () => {
      // Add 350 candles for a single pair
      for (let i = 0; i < 350; i++) {
        const candle: Candle = {
          symbol: 'BTCUSDT',
          open: 50000 + i,
          high: 50000 + i,
          low: 50000 + i,
          close: 50000 + i,
          timestamp: Date.now() + i,
          volume: 1000 + i,
        };
        eventBus.publish('candle_closed', candle);
      }

      const cache = engine.getCandlesCache('BTCUSDT');
      
      // Cache should be bounded to 300
      expect(cache.length).toBeLessThanOrEqual(300);
      expect(cache.length).toBe(300);
      
      // Should keep the most recent candles (last 300 of 350)
      expect(cache[0].close).toBe(50050); // First candle in cache is #50
      expect(cache[299].close).toBe(50349); // Last candle is #349
    });
  });

  describe('Market Regime Signal Filtering', () => {
    it('should NOT emit signals when no regime is set for that pair', () => {
      // Mock bullish pattern
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

      const publishSpy = jest.spyOn(eventBus, 'publish');
      publishSpy.mockClear();

      // Add enough data for BTC (but no regime set for BTC)
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 50000,
          high: 50500,
          low: 49500,
          close: 50200,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000,
        });
      }

      const signalCalls = publishSpy.mock.calls.filter(
        call => call[0] === 'SignalGenerated'
      );

      // Should NOT emit signals when no regime is set for BTC
      expect(signalCalls.length).toBe(0);
    });

    it('should emit BUY signal when pair regime is TRENDING_UP', () => {
      // Set regime to TRENDING_UP for BTC
      eventBus.publish('market_regime_changed', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      // Mock bullish pattern
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

      const publishSpy = jest.spyOn(eventBus, 'publish');
      
      // Add enough data
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 50000,
          high: 50500,
          low: 49500,
          close: 50200,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000,
        });
      }

      const signalCalls = publishSpy.mock.calls.filter(
        call => call[0] === 'SignalGenerated'
      );
      
      // Should emit BUY signal
      expect(signalCalls.length).toBeGreaterThan(0);
      const lastSignal = signalCalls[signalCalls.length - 1][1] as { action: string };
      expect(lastSignal.action).toBe('BUY');
    });

    it('should filter BUY signal when pair regime is TRENDING_DOWN', () => {
      // Set regime to TRENDING_DOWN for BTC
      eventBus.publish('market_regime_changed', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      // Mock bullish pattern (should be filtered)
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

      const publishSpy = jest.spyOn(eventBus, 'publish');
      publishSpy.mockClear();
      
      // Add enough data
      for (let i = 0; i < 50; i++) {
        eventBus.publish('candle_closed', {
          symbol: 'BTCUSDT',
          open: 50000,
          high: 50500,
          low: 49500,
          close: 50200,
          timestamp: Date.now() - (50 - i) * 60000,
          volume: 1000,
        });
      }

      const signalCalls = publishSpy.mock.calls.filter(
        call => call[0] === 'SignalGenerated'
      );
      
      // Should NOT emit BUY signal in downtrend
      expect(signalCalls.length).toBe(0);
    });
  });
});