import { BinanceWsClient } from './BinanceWsClient';
import { EventBus } from '../core/EventBus';
import WebSocket from 'ws';
import { Candle } from '../../../shared/src/events';

const mockWsInstance = {
  on: jest.fn(),
  close: jest.fn(),
  removeAllListeners: jest.fn(),
};

jest.mock('ws', () => ({
  __esModule: true,
  default: jest.fn(() => mockWsInstance),
  WebSocket: jest.fn(() => mockWsInstance),
}));

describe('BinanceWsClient', () => {
  let client: BinanceWsClient;
  let eventBus: EventBus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWsModule: any;

  beforeEach(() => {
    eventBus = new EventBus();
    mockWsModule = WebSocket as any;
  });

  afterEach(() => {
    client?.close();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client with default symbols array', () => {
      client = new BinanceWsClient(eventBus);
      expect(client).toBeDefined();
      expect(client.getCurrentCandle()).toBeNull();
    });

    it('should create client with multiple symbols', () => {
      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt', 'solusdt']);
      expect(client).toBeDefined();
    });

    it('should allow custom interval', () => {
      client = new BinanceWsClient(eventBus, ['btcusdt'], '15m');
      expect(client).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect to Binance WebSocket with combined stream for multiple pairs', () => {
      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt']);
      client.connect();

      const wsCall = mockWsModule.default.mock.calls[0];
      expect(wsCall[0]).toBe('wss://stream.binance.com:9443/ws/btcusdt@kline_5m/ethusdt@kline_5m');
    });

    it('should use provided interval in combined WebSocket URL', () => {
      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt'], '15m');
      client.connect();

      const wsCall = mockWsModule.default.mock.calls[0];
      expect(wsCall[0]).toBe('wss://stream.binance.com:9443/ws/btcusdt@kline_15m/ethusdt@kline_15m');
    });

    it('should support three default pairs (BTCUSDT, ETHUSDT, SOLUSDT)', () => {
      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt', 'solusdt'], '5m');
      client.connect();

      const wsCall = mockWsModule.default.mock.calls[0];
      expect(wsCall[0]).toBe('wss://stream.binance.com:9443/ws/btcusdt@kline_5m/ethusdt@kline_5m/solusdt@kline_5m');
    });
  });

  describe('message handling', () => {
    it('should parse combined stream candle message and emit candle_closed event', () => {
      const messageHandlers: { [key: string]: Function } = {};
      mockWsInstance.on.mockImplementation((event: string, handler: Function) => {
        messageHandlers[event] = handler;
      });

      const eventHandler = jest.fn();
      eventBus.subscribe<Candle>('candle_closed', eventHandler);

      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt']);
      client.connect();

      messageHandlers['open']?.();

      const candleMessage = JSON.stringify({
        stream: 'btcusdt@kline_5m',
        data: {
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

    it('should parse direct stream candle message (backward compatibility)', () => {
      const messageHandlers: { [key: string]: Function } = {};
      mockWsInstance.on.mockImplementation((event: string, handler: Function) => {
        messageHandlers[event] = handler;
      });

      const eventHandler = jest.fn();
      eventBus.subscribe<Candle>('candle_closed', eventHandler);

      client = new BinanceWsClient(eventBus, ['btcusdt']);
      client.connect();

      messageHandlers['open']?.();

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
      expect(emittedCandle.symbol).toBe('BTCUSDT');
      expect(emittedCandle.close).toBe(50500.00);
    });

    it('should track current candles per symbol for real-time updates', () => {
      const messageHandlers: { [key: string]: Function } = {};
      mockWsInstance.on.mockImplementation((event: string, handler: Function) => {
        messageHandlers[event] = handler;
      });

      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt']);
      client.connect();

      const btcMessage = JSON.stringify({
        stream: 'btcusdt@kline_5m',
        data: {
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
        },
      });

      messageHandlers['message']?.(Buffer.from(btcMessage));

      const btcCandle = client.getCurrentCandle('BTCUSDT');
      expect(btcCandle).not.toBeNull();
      expect(btcCandle?.symbol).toBe('BTCUSDT');
      expect(btcCandle?.close).toBe(50500.00);

      const ethMessage = JSON.stringify({
        stream: 'ethusdt@kline_5m',
        data: {
          e: 'kline',
          E: 1234567890000,
          s: 'ETHUSDT',
          k: {
            t: 1234567800000,
            o: '3000.00',
            h: '3100.00',
            l: '2900.00',
            c: '3050.00',
            v: '10.50000000',
            x: false,
            i: '5m',
          },
        },
      });

      messageHandlers['message']?.(Buffer.from(ethMessage));

      const ethCandle = client.getCurrentCandle('ETHUSDT');
      expect(ethCandle).not.toBeNull();
      expect(ethCandle?.symbol).toBe('ETHUSDT');
      expect(ethCandle?.close).toBe(3050.00);

      expect(client.getCurrentCandle('BTCUSDT')?.close).toBe(50500.00);
    });

    it('should only emit candle_closed when candle is closed (x: true)', () => {
      const messageHandlers: { [key: string]: Function } = {};
      mockWsInstance.on.mockImplementation((event: string, handler: Function) => {
        messageHandlers[event] = handler;
      });

      const eventHandler = jest.fn();
      eventBus.subscribe<Candle>('candle_closed', eventHandler);

      client = new BinanceWsClient(eventBus, ['btcusdt']);
      client.connect();

      const openCandleMessage = JSON.stringify({
        stream: 'btcusdt@kline_5m',
        data: {
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
        },
      });

      messageHandlers['message']?.(Buffer.from(openCandleMessage));
      expect(eventHandler).not.toHaveBeenCalled();

      const closedCandleMessage = JSON.stringify({
        stream: 'btcusdt@kline_5m',
        data: {
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
      mockWsInstance.on.mockImplementation((event: string, handler: Function) => {
        messageHandlers[event] = handler;
      });

      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt']);
      client.connect();

      messageHandlers['close']?.();

      jest.advanceTimersByTime(1000);
      expect(mockWsModule.default).toHaveBeenCalledTimes(2);

      messageHandlers['close']?.();

      jest.advanceTimersByTime(2000);
      expect(mockWsModule.default).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe('close', () => {
    it('should close WebSocket and stop reconnecting', () => {
      jest.useFakeTimers();
      
      client = new BinanceWsClient(eventBus, ['btcusdt']);
      client.connect();

      client.close();

      jest.advanceTimersByTime(60000);
      expect(mockWsModule.default).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('getCurrentCandles', () => {
    it('should return all current candles as a Map', () => {
      const messageHandlers: { [key: string]: Function } = {};
      mockWsInstance.on.mockImplementation((event: string, handler: Function) => {
        messageHandlers[event] = handler;
      });

      client = new BinanceWsClient(eventBus, ['btcusdt', 'ethusdt']);
      client.connect();

      const btcMessage = JSON.stringify({
        stream: 'btcusdt@kline_5m',
        data: {
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
        },
      });

      messageHandlers['message']?.(Buffer.from(btcMessage));

      const allCandles = client.getCurrentCandles();
      expect(allCandles.size).toBe(1);
      expect(allCandles.has('BTCUSDT')).toBe(true);
    });
  });
});
