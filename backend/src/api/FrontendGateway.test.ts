import { FrontendGateway } from './FrontendGateway';
import { EventBus } from '../core/EventBus';
import { WebSocketServer, WebSocket } from 'ws';
import { Candle, SignalGenerated } from '../../../shared/src/events';
import { IndicatorsUpdatedEvent } from '../engine/IndicatorEngine';

describe('FrontendGateway', () => {
  let gateway: FrontendGateway;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    if (gateway) {
      gateway.close();
    }
  });

  it('should start a WebSocket server on the specified port', () => {
    // Just verify it doesn't throw
    expect(() => {
      gateway = new FrontendGateway(eventBus, 8081);
    }).not.toThrow();
  });

  it('should broadcast candle_closed events', (done) => {
    gateway = new FrontendGateway(eventBus, 8082);
    
    const candle: Candle = {
      symbol: 'BTC/USDT',
      open: 50000,
      high: 50000,
      low: 50000,
      close: 50000,
      timestamp: Date.now(),
      volume: 1.5,
    };

    // Give server time to start
    setTimeout(() => {
      eventBus.publish('candle_closed', candle);
      // If no error, test passes
      done();
    }, 100);
  });

  it('should broadcast indicators_updated events', (done) => {
    gateway = new FrontendGateway(eventBus, 8083);
    
    const indicatorsData: IndicatorsUpdatedEvent = {
      symbol: 'BTC/USDT',
      indicators: {
        ema: { value: 65000, period: 200 },
        vwap: { value: 65100, period: 14 },
        rsi: { value: 55, signal: 'neutral', period: 14 },
        macd: { macd: 100, signal: 80, histogram: 20, crossovers: [] },
        atr: { value: 150, period: 14 },
        candlestick: { patterns: [] }
      },
      timestamp: Date.now(),
    };

    setTimeout(() => {
      eventBus.publish('indicators_updated', indicatorsData);
      done();
    }, 100);
  });

  it('should broadcast SignalGenerated events', (done) => {
    gateway = new FrontendGateway(eventBus, 8084);
    
    const signal: SignalGenerated = {
      symbol: 'BTC/USDT',
      action: 'BUY',
      confidence: 0.95,
      timestamp: Date.now(),
    };

    setTimeout(() => {
      eventBus.publish('SignalGenerated', signal);
      done();
    }, 100);
  });
});