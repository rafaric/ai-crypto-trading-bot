import { FrontendGateway } from './FrontendGateway';
import { EventBus } from '../core/EventBus';
import { WebSocketServer, WebSocket } from 'ws';
import { MarketTick, SignalGenerated } from '../../../shared/src/events';

jest.mock('ws');

describe('FrontendGateway', () => {
  let gateway: FrontendGateway;
  let eventBus: EventBus;
  let mockWssInstance: jest.Mocked<WebSocketServer>;
  let mockClient: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();

    eventBus = new EventBus();

    mockClient = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
    } as unknown as jest.Mocked<WebSocket>;

    mockWssInstance = {
      clients: new Set([mockClient]),
      on: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<WebSocketServer>;

    (WebSocketServer as unknown as jest.Mock).mockImplementation(() => mockWssInstance);
  });

  afterEach(() => {
    if (gateway) {
      gateway.close();
    }
  });

  it('should start a WebSocket server on the specified port', () => {
    gateway = new FrontendGateway(eventBus, 8081);
    expect(WebSocketServer).toHaveBeenCalledWith({ port: 8081 });
  });

  it('should broadcast MarketTick events to connected clients', () => {
    gateway = new FrontendGateway(eventBus, 8081);

    const tick: MarketTick = {
      symbol: 'BTC/USDT',
      price: 50000,
      timestamp: Date.now(),
      volume: 1.5,
    };

    eventBus.publish('MarketTick', tick);

    expect(mockClient.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'MarketTick', payload: tick })
    );
  });

  it('should broadcast SignalGenerated events to connected clients', () => {
    gateway = new FrontendGateway(eventBus, 8081);

    const signal: SignalGenerated = {
      symbol: 'BTC/USDT',
      action: 'BUY',
      confidence: 0.95,
      timestamp: Date.now(),
    };

    eventBus.publish('SignalGenerated', signal);

    expect(mockClient.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'SignalGenerated', payload: signal })
    );
  });

  it('should not send to disconnected clients', () => {
    // We recreate the mock client for this test to be closed
    const closedMockClient = {
      readyState: WebSocket.CLOSED,
      send: jest.fn(),
    } as unknown as jest.Mocked<WebSocket>;
    mockWssInstance.clients = new Set([closedMockClient]);

    gateway = new FrontendGateway(eventBus, 8081);

    const tick: MarketTick = {
      symbol: 'ETH/USDT',
      price: 3000,
      timestamp: Date.now(),
      volume: 10,
    };

    eventBus.publish('MarketTick', tick);

    expect(closedMockClient.send).not.toHaveBeenCalled();
  });
});
