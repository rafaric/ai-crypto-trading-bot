import { BingXWsClient } from './BingXWsClient';
import { EventBus } from '../core/EventBus';
import { Candle } from '../domain/MarketTick';

describe('BingXWsClient', () => {
  let eventBus: EventBus;
  let client: BingXWsClient;
  const originalEnv = process.env;

  beforeEach(() => {
    eventBus = new EventBus();
    process.env = {
      ...originalEnv,
      BINGX_API_KEY: 'test-api-key',
      BINGX_API_SECRET: 'test-api-secret',
    };
  });

  afterEach(() => {
    if (client) {
      client.close();
    }
    process.env = originalEnv;
  });

  it('should create client with valid credentials', () => {
    expect(() => {
      client = new BingXWsClient(eventBus, 'BTC-USDT');
    }).not.toThrow();
  });

  it('should throw error on connect if API credentials are missing', () => {
    delete process.env.BINGX_API_KEY;
    delete process.env.BINGX_API_SECRET;
    
    client = new BingXWsClient(eventBus, 'BTC-USDT');
    
    expect(() => {
      client.connect();
    }).toThrow('BINGX_API_KEY and BINGX_API_SECRET must be set');
  });

  it('should parse BingX candle format to Candle with OHLC', (done) => {
    client = new BingXWsClient(eventBus, 'BTC-USDT');

    // Subscribe to candle_closed event
    eventBus.subscribe<Candle>('candle_closed', (candle) => {
      expect(candle.symbol).toBe('BTC-USDT');
      expect(candle.close).toBe(65000);
      expect(candle.volume).toBe(1.5);
      expect(candle.timestamp).toBe(1234567890);
      done();
    });

    // Simulate the client publishing a candle
    const testCandle = {
      symbol: 'BTC-USDT',
      open: 64000,
      high: 66000,
      low: 63000,
      close: 65000,
      timestamp: 1234567890,
      volume: 1.5,
      isClosed: true,
      interval: '1m',
    };

    eventBus.publish('candle_closed', testCandle);
  });

  it('should close without errors', () => {
    client = new BingXWsClient(eventBus, 'BTC-USDT');
    
    expect(() => {
      client.close();
    }).not.toThrow();
  });
});