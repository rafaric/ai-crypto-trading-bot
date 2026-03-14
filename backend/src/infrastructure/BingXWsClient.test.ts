import { BingXWsClient } from './BingXWsClient';
import { EventBus } from '../core/EventBus';

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

  it('should parse BingX candle format to MarketTick', (done) => {
    client = new BingXWsClient(eventBus, 'BTC-USDT');
    
    // Subscribe to candle_closed event
    eventBus.subscribe('candle_closed', (tick) => {
      expect(tick.symbol).toBe('BTC-USDT');
      expect(tick.price).toBe(65000);
      expect(tick.volume).toBe(1.5);
      expect(tick.timestamp).toBe(1234567890);
      done();
    });

    // Simulate the client publishing a candle
    const candle = {
      symbol: 'BTC-USDT',
      price: 65000,
      timestamp: 1234567890,
      volume: 1.5,
    };
    
    eventBus.publish('candle_closed', candle);
  });

  it('should close without errors', () => {
    client = new BingXWsClient(eventBus, 'BTC-USDT');
    
    expect(() => {
      client.close();
    }).not.toThrow();
  });
});