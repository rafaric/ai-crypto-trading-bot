import { BinanceWsClient } from './BinanceWsClient';
import { EventBus } from '../core/EventBus';
import WebSocket from 'ws';
import { Candle } from '../../../shared/src/events';

// Mock WebSocket
jest.mock('ws');

describe('BinanceWsClient', () => {
  let client: BinanceWsClient;
  let eventBus: EventBus;
  let mockWebSocket: jest.MockedClass<typeof WebSocket>;

  beforeEach(() => {
    eventBus = new EventBus();
    mockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;
    mockWebSocket.mockClear();
  });

  afterEach(() => {
    client?.close();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default 5m interval', () => {
      client = new BinanceWsClient(eventBus, 'btcusdt');
      expect(client).toBeDefined();
      expect(client.getCurrentCandle()).toBeNull();
    });

    it('should allow custom symbol and interval', () => {
      client = new BinanceWsClient(eventBus, 'ethusdt', '15m');
      expect(client).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect to Binance WebSocket with 5m stream', () => {
      const mockWsInstance = {
        on: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      client = new BinanceWsClient(eventBus, 'btcusdt');
      client.connect();

      expect(mockWebSocket).toHaveBeenCalledWith(
        'wss://stream.binance.com:9443/ws/btcusdt@kline_5m'
      );
    });

    it('should use provided interval in WebSocket URL', () => {
      const mockWsInstance = {
        on: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      client = new BinanceWsClient(eventBus, 'ethusdt', '15m');
      client.connect();

      expect(mockWebSocket).toHaveBeenCalledWith(
        'wss://stream.binance.com:9443/ws/ethusdt@kline_15m'
      );
    });
  });

  describe('message handling', () => {
    it('should parse 5m candle message and emit candle_closed event', () => {
      const messageHandlers: { [key: string]: Function } = {};
      const mockWsInstance = {
        on: jest.fn((event: string, handler: Function) => {
          messageHandlers[event] = handler;
        }),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      const eventHandler = jest.fn();
      eventBus.subscribe<Candle>('candle_closed', eventHandler);

      client = new BinanceWsClient(eventBus, 'btcusdt');
      client.connect();

      // Simulate WebSocket open
      messageHandlers['open']?.();

      // Simulate incoming 5m candle message
      const candleMessage = JSON.stringify({
        e: 'kline',
        E: 1234567890000,
        s: 'BTCUSDT',
        k: {
          t: 1234567800000,
          o: '50000.00',
          h: '51000.00',
          l: '49000.00',
          c: '50500.00',
          v: '1.50000000',
          x: true,
          i: '5m',
        },
      });

      messageHandlers['message']?.(Buffer.from(candleMessage));

      expect(eventHandler).toHaveBeenCalled();
      const emittedCandle = eventHandler.mock.calls[0][0];
      expect(emittedCandle.interval).toBe('5m');
      expect(emittedCandle.symbol).toBe('BTCUSDT');
      expect(emittedCandle.open).toBe(50000.00);
      expect(emittedCandle.close).toBe(50500.00);
      expect(emittedCandle.isClosed).toBe(true);
    });

    it('should track current candle for real-time updates', () => {
      const messageHandlers: { [key: string]: Function } = {};
      const mockWsInstance = {
        on: jest.fn((event: string, handler: Function) => {
          messageHandlers[event] = handler;
        }),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      client = new BinanceWsClient(eventBus, 'btcusdt');
      client.connect();

      // Simulate incoming candle message (not closed)
      const candleMessage = JSON.stringify({
        e: 'kline',
        E: 1234567890000,
        s: 'BTCUSDT',
        k: {
          t: 1234567800000,
          o: '50000.00',
          h: '51000.00',
          l: '49000.00',
          c: '50500.00',
          v: '1.50000000',
          x: false,
          i: '5m',
        },
      });

      messageHandlers['message']?.(Buffer.from(candleMessage));

      const currentCandle = client.getCurrentCandle();
      expect(currentCandle).not.toBeNull();
      expect(currentCandle?.interval).toBe('5m');
      expect(currentCandle?.close).toBe(50500.00);
    });

    it('should only emit candle_closed when candle is closed (x: true)', () => {
      const messageHandlers: { [key: string]: Function } = {};
      const mockWsInstance = {
        on: jest.fn((event: string, handler: Function) => {
          messageHandlers[event] = handler;
        }),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      const eventHandler = jest.fn();
      eventBus.subscribe<Candle>('candle_closed', eventHandler);

      client = new BinanceWsClient(eventBus, 'btcusdt');
      client.connect();

      // Simulate open candle (not closed)
      const openCandleMessage = JSON.stringify({
        e: 'kline',
        E: 1234567890000,
        s: 'BTCUSDT',
        k: {
          t: 1234567800000,
          o: '50000.00',
          h: '51000.00',
          l: '49000.00',
          c: '50500.00',
          v: '1.50000000',
          x: false,
          i: '5m',
        },
      });

      messageHandlers['message']?.(Buffer.from(openCandleMessage));
      expect(eventHandler).not.toHaveBeenCalled();

      // Simulate closed candle
      const closedCandleMessage = JSON.stringify({
        e: 'kline',
        E: 1234567890001,
        s: 'BTCUSDT',
        k: {
          t: 1234568100000,
          o: '50500.00',
          h: '51500.00',
          l: '50000.00',
          c: '51000.00',
          v: '2.00000000',
          x: true,
          i: '5m',
        },
      });

      messageHandlers['message']?.(Buffer.from(closedCandleMessage));
      expect(eventHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('reconnection', () => {
    it('should reconnect with exponential backoff on close', () => {
      jest.useFakeTimers();
      
      const messageHandlers: { [key: string]: Function } = {};
      const mockWsInstance = {
        on: jest.fn((event: string, handler: Function) => {
          messageHandlers[event] = handler;
        }),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      client = new BinanceWsClient(eventBus, 'btcusdt');
      client.connect();

      // Simulate connection close
      messageHandlers['close']?.();

      // Should attempt reconnection after 1s
      jest.advanceTimersByTime(1000);
      expect(mockWebSocket).toHaveBeenCalledTimes(2);

      // Simulate another close
      messageHandlers['close']?.();

      // Should attempt reconnection after 2s (exponential backoff)
      jest.advanceTimersByTime(2000);
      expect(mockWebSocket).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe('close', () => {
    it('should close WebSocket and stop reconnecting', () => {
      jest.useFakeTimers();
      
      const mockWsInstance = {
        on: jest.fn(),
        close: jest.fn(),
        removeAllListeners: jest.fn(),
      };
      mockWebSocket.mockImplementation(() => mockWsInstance as any);

      client = new BinanceWsClient(eventBus, 'btcusdt');
      client.connect();

      client.close();

      // Fast-forward timer - should not reconnect
      jest.advanceTimersByTime(60000);
      expect(mockWebSocket).toHaveBeenCalledTimes(1); // Only initial connection

      jest.useRealTimers();
    });
  });
});
