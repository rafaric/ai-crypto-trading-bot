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
      // But EventEmitter in Node is synchronous unless handlers are async and we await them.
      // Since executeSignal returns a promise, we can just await a microtask to ensure it ran.
      await new Promise(process.nextTick);

      expect(executeSpy).toHaveBeenCalledWith(signal);
      expect(mockTradeRepo.saveTrade).toHaveBeenCalledTimes(1);
      
      const savedTrade = mockTradeRepo.saveTrade.mock.calls[0][0];
      expect(savedTrade.symbol).toBe('ETHUSDT');
      expect(savedTrade.action).toBe('SELL');
      expect(savedTrade.simulated).toBe(true);
    });
  });
});
