import { BingXWsIngester } from './BingXWsIngester';
import { EventBus } from '../core/EventBus';
import { Candle } from '../domain/MarketTick';
import WebSocket from 'ws';

jest.mock('ws');

describe('BingXWsIngester', () => {
  let eventBus: EventBus;
  let ingester: BingXWsIngester;
  let wsMock: jest.Mocked<WebSocket>;
  let wsConstructorMock: jest.Mock;
  let eventHandlers: Record<string, Function>;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.clearAllMocks();
    jest.useFakeTimers();

    eventHandlers = {};

    wsMock = {
      on: jest.fn().mockImplementation((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
      send: jest.fn(),
      close: jest.fn(),
      terminate: jest.fn(),
      removeAllListeners: jest.fn(),
      readyState: WebSocket.OPEN,
    } as unknown as jest.Mocked<WebSocket>;

    wsConstructorMock = WebSocket as unknown as jest.Mock;
    wsConstructorMock.mockImplementation(() => wsMock);
  });

  afterEach(() => {
    if (ingester) {
      ingester.stop();
    }
    jest.useRealTimers();
  });

  it('Test 1: successfully parses a mocked BingX K-line JSON message and publishes a Candle', () => {
    ingester = new BingXWsIngester(eventBus, 'BTC-USDT');
    ingester.start();
    
    // Simulate open event to trigger subscription
    if (eventHandlers['open']) eventHandlers['open']();

    // Verify subscription was sent
    expect(wsMock.send).toHaveBeenCalled();

    // Spy on the EventBus
    const emitSpy = jest.spyOn(eventBus, 'publish');

    // Simulate BingX WS K-line message
    // Note: BingX WS often sends compressed data, but for this test we'll assume JSON strings per requirements
    // Format according to BingX v3 swap kline
    const mockMessage = JSON.stringify({
      dataType: "BTC-USDT@kline_1m",
      data: [
        {
          c: "43500.50",
          v: "2.5",
          T: 1614567890000
        }
      ]
    });

    if (eventHandlers['message']) {
      eventHandlers['message'](Buffer.from(mockMessage));
    }

    expect(emitSpy).toHaveBeenCalledWith('candle_closed', {
      symbol: 'BTC-USDT',
      open: 43500.5,
      high: 43500.5,
      low: 43500.5,
      close: 43500.5,
      timestamp: 1614567890000,
      volume: 2.5,
      isClosed: true,
      interval: '1m'
    });
  });

  it('handles ping/pong appropriately', () => {
    ingester = new BingXWsIngester(eventBus, 'BTC-USDT');
    ingester.start();
    
    // BingX ping looks like "Ping"
    if (eventHandlers['message']) {
      eventHandlers['message'](Buffer.from('Ping'));
    }

    expect(wsMock.send).toHaveBeenCalledWith('Pong');
  });

  it('Test 2: triggers exponential backoff reconnect logic when connection drops', () => {
    ingester = new BingXWsIngester(eventBus, 'BTC-USDT');
    ingester.start();
    
    expect(wsConstructorMock).toHaveBeenCalledTimes(1);

    // Simulate connection drop
    if (eventHandlers['close']) {
      eventHandlers['close'](1006, 'Abnormal Closure');
    }

    // Should not reconnect immediately (initial delay say 1s)
    expect(wsConstructorMock).toHaveBeenCalledTimes(1);

    // Advance timer by 1000ms
    jest.advanceTimersByTime(1000);
    expect(wsConstructorMock).toHaveBeenCalledTimes(2);

    // Simulate another drop
    if (eventHandlers['close']) {
      eventHandlers['close'](1006, 'Abnormal Closure');
    }

    // Should wait longer (exponential, say 2s)
    jest.advanceTimersByTime(1000);
    expect(wsConstructorMock).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(1000);
    expect(wsConstructorMock).toHaveBeenCalledTimes(3);
  });
});
