import { EventBus } from './EventBus';
import { Candle, SignalGenerated } from 'shared/events';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('should allow subscribing to and publishing Candle events', () => {
    const handler = jest.fn();
    eventBus.subscribe<Candle>('market.tick', handler);

    const candle: Candle = {
      symbol: 'BTCUSDT',
      open: 50000,
      high: 50000,
      low: 50000,
      close: 50000,
      timestamp: Date.now(),
      volume: 1.5,
    };

    eventBus.publish('market.tick', candle);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(candle);
  });

  it('should support multiple subscribers to the same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    eventBus.subscribe<Candle>('market.tick', handler1);
    eventBus.subscribe<Candle>('market.tick', handler2);

    const candle: Candle = { symbol: 'ETHUSDT', open: 3000, high: 3000, low: 3000, close: 3000, timestamp: Date.now(), volume: 10 };
    eventBus.publish('market.tick', candle);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should allow unsubscribing from events', () => {
    const handler = jest.fn();
    const unsubscribe = eventBus.subscribe<Candle>('market.tick', handler);

    unsubscribe();

    const candle: Candle = { symbol: 'ETHUSDT', open: 3000, high: 3000, low: 3000, close: 3000, timestamp: Date.now(), volume: 10 };
    eventBus.publish('market.tick', candle);

    expect(handler).not.toHaveBeenCalled();
  });
});
