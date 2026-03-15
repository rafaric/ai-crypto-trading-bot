import { MarketRegimeDetector, MarketRegimeEvent } from './MarketRegimeDetector';
import { EventBus } from '../core/EventBus';
import { MarketRegime1HUpdated } from '../../../shared/src/events';

describe('MarketRegimeDetector', () => {
  let detector: MarketRegimeDetector;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    detector = new MarketRegimeDetector(eventBus);
  });

  afterEach(() => {
    detector.unsubscribe();
  });

  describe('constructor', () => {
    it('should create detector with event bus', () => {
      expect(detector).toBeDefined();
      expect(detector.getCurrentRegime('BTCUSDT')).toBeNull();
    });
  });

  describe('Multi-Pair Support', () => {
    it('should track regimes independently for each pair', () => {
      // Set regime for BTC
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      // Set different regime for ETH
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'ETHUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.65,
        timestamp: Date.now(),
        ema200: 3000,
        adx14: 25,
        price: 2900,
      });

      const btcRegime = detector.getCurrentRegime('BTCUSDT');
      const ethRegime = detector.getCurrentRegime('ETHUSDT');

      expect(btcRegime?.regime).toBe('TRENDING_UP');
      expect(ethRegime?.regime).toBe('TRENDING_DOWN');
      expect(btcRegime?.trendDirection).toBe('BULLISH');
      expect(ethRegime?.trendDirection).toBe('BEARISH');
    });

    it('should return null for unknown pairs', () => {
      expect(detector.getCurrentRegime('UNKNOWNPAIR')).toBeNull();
    });

    it('should get all regimes', () => {
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      eventBus.publish('market_regime_1h_updated', {
        symbol: 'ETHUSDT',
        regime: 'RANGING',
        trendDirection: 'NEUTRAL',
        confidence: 0.5,
        timestamp: Date.now(),
        ema200: 3000,
        adx14: 15,
        price: 3000,
      });

      const allRegimes = detector.getAllRegimes();
      
      expect(allRegimes.size).toBe(2);
      expect(allRegimes.has('BTCUSDT')).toBe(true);
      expect(allRegimes.has('ETHUSDT')).toBe(true);
    });

    it('should emit market_regime_changed with pair symbol', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      eventBus.publish('market_regime_1h_updated', {
        symbol: 'SOLUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.8,
        timestamp: Date.now(),
        ema200: 100,
        adx14: 28,
        price: 105,
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler.mock.calls[0][0].symbol).toBe('SOLUSDT');
      expect(eventHandler.mock.calls[0][0].regime).toBe('TRENDING_UP');
    });

    it('should handle regime updates for multiple pairs independently', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      // First update for BTC
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      // First update for ETH (different pair - should emit)
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'ETHUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.65,
        timestamp: Date.now(),
        ema200: 3000,
        adx14: 25,
        price: 2900,
      });

      // Same regime for BTC (should not emit)
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.80, // Different confidence
        timestamp: Date.now(),
        ema200: 50500,
        adx14: 32,
        price: 51500,
      });

      // Should have 2 events (one for each pair, BTC only emitted once)
      expect(eventHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('1H regime event handling', () => {
    it('should update regime when market_regime_1h_updated event is received', () => {
      const regimeEvent: MarketRegime1HUpdated = {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      };

      eventBus.publish('market_regime_1h_updated', regimeEvent);

      const currentRegime = detector.getCurrentRegime('BTCUSDT');
      expect(currentRegime).not.toBeNull();
      expect(currentRegime?.regime).toBe('TRENDING_UP');
      expect(currentRegime?.trendDirection).toBe('BULLISH');
      expect(currentRegime?.confidence).toBe(0.75);
    });

    it('should emit market_regime_changed when regime changes', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      // First regime event
      const regimeEvent1: MarketRegime1HUpdated = {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      };

      eventBus.publish('market_regime_1h_updated', regimeEvent1);

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler.mock.calls[0][0].regime).toBe('TRENDING_UP');

      // Same regime - should not emit again
      const regimeEvent2: MarketRegime1HUpdated = {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.80, // Different confidence, same regime
        timestamp: Date.now(),
        ema200: 50500,
        adx14: 32,
        price: 51500,
      };

      eventBus.publish('market_regime_1h_updated', regimeEvent2);

      // Should not emit again for same regime
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('should emit event when regime changes from UP to DOWN', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      // First: TRENDING_UP
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Then: TRENDING_DOWN
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.65,
        timestamp: Date.now(),
        ema200: 52000,
        adx14: 28,
        price: 51000,
      });

      expect(eventHandler).toHaveBeenCalledTimes(2);
      expect(eventHandler.mock.calls[1][0].regime).toBe('TRENDING_DOWN');
    });

    it('should handle RANGING regime', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'RANGING',
        trendDirection: 'NEUTRAL',
        confidence: 0.50,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 15,
        price: 50050,
      });

      const currentRegime = detector.getCurrentRegime('BTCUSDT');
      expect(currentRegime?.regime).toBe('RANGING');
      expect(currentRegime?.trendDirection).toBe('NEUTRAL');
    });

    it('should include EMA200 and ADX14 values in regime event', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      const emittedEvent = eventHandler.mock.calls[0][0];
      expect(emittedEvent.ema200).toBe(50000);
      expect(emittedEvent.adx14).toBe(30);
      expect(emittedEvent.price).toBe(51000);
    });
  });

  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      // First event
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      detector.unsubscribe();

      // Second event - should not be processed
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_DOWN',
        trendDirection: 'BEARISH',
        confidence: 0.65,
        timestamp: Date.now(),
        ema200: 52000,
        adx14: 28,
        price: 51000,
      });

      // Should still be 1 (no new event emitted)
      expect(eventHandler).toHaveBeenCalledTimes(1);
      
      // Regime should remain unchanged
      expect(detector.getCurrentRegime('BTCUSDT')?.regime).toBe('TRENDING_UP');
    });

    it('should handle multiple unsubscribe calls safely', () => {
      detector.unsubscribe();
      detector.unsubscribe(); // Should not throw
      
      expect(detector.getCurrentRegime('BTCUSDT')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle initial null regime gracefully', () => {
      expect(detector.getCurrentRegime('BTCUSDT')).toBeNull();
    });

    it('should not emit event if regime is same as current', () => {
      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', eventHandler);

      // Set initial regime
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);

      // Publish same regime again
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.76, // Slight difference
        timestamp: Date.now(),
        ema200: 50100,
        adx14: 31,
        price: 51100,
      });

      // Should not emit again
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });

    it('should update confidence even when regime stays the same', () => {
      // Set initial regime
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.75,
        timestamp: Date.now(),
        ema200: 50000,
        adx14: 30,
        price: 51000,
      });

      // Update with different confidence
      eventBus.publish('market_regime_1h_updated', {
        symbol: 'BTCUSDT',
        regime: 'TRENDING_UP',
        trendDirection: 'BULLISH',
        confidence: 0.85, // Higher confidence
        timestamp: Date.now(),
        ema200: 50200,
        adx14: 35,
        price: 51200,
      });

      const currentRegime = detector.getCurrentRegime('BTCUSDT');
      expect(currentRegime?.confidence).toBe(0.85);
      expect(currentRegime?.ema200).toBe(50200);
      expect(currentRegime?.adx14).toBe(35);
    });
  });
});