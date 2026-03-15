import { PaperTradingEngine } from './PaperTradingEngine';
import { ITradeRepository, Trade } from '../infrastructure/db/ITradeRepository';
import { SignalGenerated } from '../../../shared/src/events';
import { EventBus } from '../core/EventBus';

describe('PaperTradingEngine', () => {
  let engine: PaperTradingEngine;
  let mockTradeRepo: jest.Mocked<ITradeRepository>;

  beforeEach(() => {
    mockTradeRepo = {
      saveTrade: jest.fn().mockResolvedValue(undefined),
    };
    engine = new PaperTradingEngine(mockTradeRepo);
  });

  afterEach(() => {
    engine.stopListening();
  });

  describe('executeSignal', () => {
    it('should calculate a simulated fill price and call saveTrade on a valid BUY signal', async () => {
      const signal: SignalGenerated = {
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      };
      
      const result = await engine.executeSignal(signal);

      expect(result).toBe(true);
      expect(mockTradeRepo.saveTrade).toHaveBeenCalledTimes(1);
      
      const savedTrade = mockTradeRepo.saveTrade.mock.calls[0][0];
      expect(savedTrade.symbol).toBe('BTCUSDT');
      expect(savedTrade.action).toBe('BUY');
      expect(savedTrade.simulated).toBe(true);
      expect(savedTrade.price).toBeGreaterThan(0);
    });

    it('should ignore HOLD signals', async () => {
      const signal: SignalGenerated = {
        symbol: 'BTCUSDT',
        action: 'HOLD',
        confidence: 0.5,
        timestamp: Date.now(),
      };

      const result = await engine.executeSignal(signal);

      expect(result).toBe(false);
      expect(mockTradeRepo.saveTrade).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Pair Support', () => {
    it('should track positions independently for each pair', async () => {
      // Open position for BTC
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      // Open position for ETH
      await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      const btcPositions = engine.getPositions('BTCUSDT');
      const ethPositions = engine.getPositions('ETHUSDT');

      expect(btcPositions).toHaveLength(1);
      expect(ethPositions).toHaveLength(1);
      expect(btcPositions[0].symbol).toBe('BTCUSDT');
      expect(ethPositions[0].symbol).toBe('ETHUSDT');
    });

    it('should allow concurrent trades on different pairs', async () => {
      // Execute trades on 3 different pairs
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'SOLUSDT',
        action: 'BUY',
        confidence: 0.85,
        timestamp: Date.now(),
      });

      const totalTrades = engine.getTotalOpenTrades();
      expect(totalTrades).toBe(3);

      const allPositions = engine.getAllPositions();
      expect(allPositions.size).toBe(3);
    });

    it('should enforce max 3 trades TOTAL across all pairs', async () => {
      // Try to execute 4 trades on different pairs
      const results = [];
      
      results.push(await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      }));

      results.push(await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      }));

      results.push(await engine.executeSignal({
        symbol: 'SOLUSDT',
        action: 'BUY',
        confidence: 0.85,
        timestamp: Date.now(),
      }));

      // This 4th trade should be rejected
      results.push(await engine.executeSignal({
        symbol: 'ADAUSDT',
        action: 'BUY',
        confidence: 0.75,
        timestamp: Date.now(),
      }));

      // First 3 should succeed, 4th should fail
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(true);
      expect(results[3]).toBe(false);

      expect(engine.getTotalOpenTrades()).toBe(3);
    });

    it('should count total trades correctly across all pairs', async () => {
      // Add trades to multiple pairs (can't add multiple to same pair due to cooldown)
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.85,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'SOLUSDT',
        action: 'SELL',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      expect(engine.getTotalOpenTrades()).toBe(3);
      expect(engine.getPositions('BTCUSDT')).toHaveLength(1);
      expect(engine.getPositions('ETHUSDT')).toHaveLength(1);
      expect(engine.getPositions('SOLUSDT')).toHaveLength(1);
    });

    it('should emit trade_executed event with pair symbol', async () => {
      const eventBus = new EventBus();
      const eventHandler = jest.fn();
      
      eventBus.subscribe('trade_executed', eventHandler);
      engine.startListening(eventBus);

      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSDT',
          action: 'BUY',
        })
      );
    });
  });

  describe('Trade Cooldown Per Pair', () => {
    it('should enforce cooldown per pair independently', async () => {
      // Execute trade on BTC
      const result1 = await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });
      expect(result1).toBe(true);

      // Immediate second trade on BTC should fail (cooldown)
      const result2 = await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });
      expect(result2).toBe(false);

      // Trade on ETH should succeed (different pair, no cooldown)
      const result3 = await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      });
      expect(result3).toBe(true);
    });

    it('should track last trade time per pair', async () => {
      const beforeTrade = Date.now();
      
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: beforeTrade,
      });

      const lastTradeTime = engine.getLastTradeTime('BTCUSDT');
      expect(lastTradeTime).toBeGreaterThanOrEqual(beforeTrade);

      // ETH should have no last trade time
      expect(engine.getLastTradeTime('ETHUSDT')).toBeNull();
    });

    it('should check cooldown status per pair', async () => {
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      expect(engine.isInCooldown('BTCUSDT')).toBe(true);
      expect(engine.isInCooldown('ETHUSDT')).toBe(false);
    });

    it('should get remaining cooldown seconds per pair', async () => {
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      const remaining = engine.getCooldownRemaining('BTCUSDT');
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(300); // 5 minutes = 300 seconds

      expect(engine.getCooldownRemaining('ETHUSDT')).toBe(0);
    });
  });

  describe('Position Management', () => {
    it('should close position for a specific pair', async () => {
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      expect(engine.getTotalOpenTrades()).toBe(2);

      // Close BTC position
      const closed = engine.closePosition('BTCUSDT', 0);
      expect(closed).toBe(true);
      expect(engine.getTotalOpenTrades()).toBe(1);
      expect(engine.getPositions('BTCUSDT')).toHaveLength(0);
      expect(engine.getPositions('ETHUSDT')).toHaveLength(1);
    });

    it('should close all positions for a specific pair', async () => {
      // Add multiple positions to BTC
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      // Manually add another position to simulate multiple trades
      // Note: In real usage, cooldown would prevent this, but we're testing close functionality
      const secondTrade: Trade = {
        symbol: 'BTCUSDT',
        action: 'SELL',
        price: 51000,
        timestamp: Date.now(),
        simulated: true,
      };
      
      // Access private positions map for testing
      (engine as any).positions.set('BTCUSDT', [
        { symbol: 'BTCUSDT', action: 'BUY', price: 50000, timestamp: Date.now(), simulated: true },
        secondTrade
      ]);

      await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      expect(engine.getTotalOpenTrades()).toBe(3);

      // Close all BTC positions
      const closedCount = engine.closeAllPositions('BTCUSDT');
      expect(closedCount).toBe(2);
      expect(engine.getTotalOpenTrades()).toBe(1);
      expect(engine.getPositions('BTCUSDT')).toHaveLength(0);
    });

    it('should return false when closing non-existent position', () => {
      const result = engine.closePosition('BTCUSDT', 0);
      expect(result).toBe(false);
    });

    it('should return 0 when closing positions for pair with no trades', () => {
      const count = engine.closeAllPositions('BTCUSDT');
      expect(count).toBe(0);
    });
  });

  describe('EventBus Integration', () => {
    it('should automatically execute signal when SignalGenerated event is published', async () => {
      const eventBus = new EventBus();
      
      // We will spy on executeSignal to ensure it's called
      const executeSpy = jest.spyOn(engine, 'executeSignal');
      
      // Act: we tell the engine to start listening to this event bus
      engine.startListening(eventBus);
      
      const signal: SignalGenerated = {
        symbol: 'ETHUSDT',
        action: 'SELL',
        confidence: 0.8,
        timestamp: Date.now(),
      };

      // Publish the event
      eventBus.publish('SignalGenerated', signal);

      // We need to wait for the promise to resolve if subscribe handler is async.
      await new Promise(process.nextTick);

      expect(executeSpy).toHaveBeenCalledWith(signal);
      expect(mockTradeRepo.saveTrade).toHaveBeenCalledTimes(1);
      
      const savedTrade = mockTradeRepo.saveTrade.mock.calls[0][0];
      expect(savedTrade.symbol).toBe('ETHUSDT');
      expect(savedTrade.action).toBe('SELL');
    });

    it('should handle errors gracefully when executing signals', async () => {
      const eventBus = new EventBus();
      
      // Make saveTrade throw an error
      mockTradeRepo.saveTrade.mockRejectedValue(new Error('Database error'));
      
      engine.startListening(eventBus);
      
      const signal: SignalGenerated = {
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      eventBus.publish('SignalGenerated', signal);
      
      await new Promise(process.nextTick);

      expect(consoleSpy).toHaveBeenCalledWith(
        'PaperTradingEngine failed to execute signal:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Risk Management', () => {
    it('should enforce max trades limit even with cooldown override', async () => {
      // Fill up to max (3 trades)
      await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 0.8,
        timestamp: Date.now(),
      });

      await engine.executeSignal({
        symbol: 'SOLUSDT',
        action: 'BUY',
        confidence: 0.85,
        timestamp: Date.now(),
      });

      expect(engine.getTotalOpenTrades()).toBe(3);

      // Try to add 4th trade - should fail even with different pair
      const result = await engine.executeSignal({
        symbol: 'ADAUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });

      expect(result).toBe(false);
      expect(engine.getTotalOpenTrades()).toBe(3);
    });

    it('should provide canOpenTrade check for risk management', async () => {
      // Initially should be able to trade
      const initialResult = await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });
      expect(initialResult).toBe(true);

      // After cooldown kicks in, second trade on same pair should fail
      const secondResult = await engine.executeSignal({
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 0.9,
        timestamp: Date.now(),
      });
      expect(secondResult).toBe(false);
    });
  });
});