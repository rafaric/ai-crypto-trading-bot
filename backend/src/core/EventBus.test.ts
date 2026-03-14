import { EventBus } from './EventBus';
import { MarketTick, SignalGenerated } from 'shared/events';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('should allow subscribing to and publishing MarketTick events', () => {
    const handler = jest.fn();
    eventBus.subscribe<MarketTick>('market.tick', handler);

    const tick: MarketTick = {
      symbol: 'BTCUSDT',
      price: 50000,
      timestamp: Date.now(),
      volume: 1.5,
    };

    eventBus.publish('market.tick', tick);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(tick);
  });

  it('should support multiple subscribers to the same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    eventBus.subscribe<MarketTick>('market.tick', handler1);
    eventBus.subscribe<MarketTick>('market.tick', handler2);

    const tick: MarketTick = { symbol: 'ETHUSDT', price: 3000, timestamp: Date.now(), volume: 10 };
    eventBus.publish('market.tick', tick);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should allow unsubscribing from events', () => {
    const handler = jest.fn();
    const unsubscribe = eventBus.subscribe<MarketTick>('market.tick', handler);

    unsubscribe();

    const tick: MarketTick = { symbol: 'ETHUSDT', price: 3000, timestamp: Date.now(), volume: 10 };
    eventBus.publish('market.tick', tick);

    expect(handler).not.toHaveBeenCalled();
  });
});
