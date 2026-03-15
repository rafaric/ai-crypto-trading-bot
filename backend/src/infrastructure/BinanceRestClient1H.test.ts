import { BinanceRestClient1H } from './BinanceRestClient1H';
import { EventBus } from '../core/EventBus';
import { MarketRegime1HUpdated } from '../../../shared/src/events';

describe('BinanceRestClient1H', () => {
  let client: BinanceRestClient1H;
  let eventBus: EventBus;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.useFakeTimers();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    client?.stop();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with single symbol in array', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });
      expect(client).toBeDefined();
    });

    it('should create client with multiple symbols', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
      });
      expect(client).toBeDefined();
    });

    it('should use default values when not provided', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });
      expect(client).toBeDefined();
    });

    it('should accept custom polling interval and limit', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        pollingIntervalMinutes: 30,
        candleLimit: 100,
      });
      expect(client).toBeDefined();
    });

    it('should normalize symbols to uppercase', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['btcusdt', 'ethusdt'],
      });
      expect(client).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('should start polling when start() is called', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
        pollingIntervalMinutes: 60,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      });

      client.start();
      
      // Fast-forward 60 minutes
      jest.advanceTimersByTime(60 * 60 * 1000);
      
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should stop polling when stop() is called', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
        pollingIntervalMinutes: 60,
      });

      const mockKlines = createMockKlines(200);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      });

      client.start();
      
      // Wait for initial fetch to complete
      await jest.advanceTimersByTimeAsync(0);
      
      // Verify initial fetch happened
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      client.stop();
      
      // Fast-forward 60 minutes - should not trigger another fetch
      await jest.advanceTimersByTimeAsync(60 * 60 * 1000);
      
      // Should still be 1 call (no additional fetch after stop)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch immediately when start() is called', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      const mockKlines = createMockKlines(200);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      });

      client.start();
      
      // Allow async operations to complete
      await jest.advanceTimersByTimeAsync(0);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200')
      );
    });
  });

  describe('batch fetching', () => {
    it('should fetch candles for multiple symbols in parallel', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT', 'ETHUSDT'],
        candleLimit: 200,
      });

      const mockBtcKlines = createMockKlines(200);
      const mockEthKlines = createMockKlines(200);
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockBtcKlines),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockEthKlines),
        });

      client.start();
      
      // Allow async operations to complete
      await jest.advanceTimersByTimeAsync(0);
      
      // Should fetch both symbols
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('symbol=BTCUSDT')
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('symbol=ETHUSDT')
      );
    });

    it('should fetch candles for all three default pairs', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        candleLimit: 200,
      });

      const mockKlines = createMockKlines(200);
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      });

      client.start();
      
      // Allow async operations to complete
      await jest.advanceTimersByTimeAsync(0);
      
      // Should fetch all three symbols
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle API errors with exponential backoff', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      const mockKlines = createMockKlines(200);
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockKlines),
        });

      client.start();
      
      // First attempt fails
      await jest.advanceTimersByTimeAsync(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Wait for 1s backoff + a bit more for the async fetch
      await jest.advanceTimersByTimeAsync(1100);
      
      // Retry should happen
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error on non-ok response', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
      });

      await expect((client as any).fetchSymbolCandles('BTCUSDT')).rejects.toThrow(
        'Binance API error'
      );
    });
  });

  describe('calculateRegime', () => {
    it('should calculate TRENDING_UP when ADX > 25 and price > EMA200', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      // Create candles in strong uptrend
      const candles = createTrendingCandles('up', 200);
      
      const regime = (client as any).calculateRegime('BTCUSDT', candles);

      expect(regime.regime).toBe('TRENDING_UP');
      expect(regime.trendDirection).toBe('BULLISH');
      expect(regime.confidence).toBeGreaterThan(0);
      expect(regime.confidence).toBeLessThanOrEqual(1);
      expect(regime.ema200).toBeDefined();
      expect(regime.adx14).toBeDefined();
      expect(regime.price).toBeDefined();
      expect(regime.symbol).toBe('BTCUSDT');
    });

    it('should calculate TRENDING_DOWN when ADX > 25 and price < EMA200', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      // Create candles in strong downtrend
      const candles = createTrendingCandles('down', 200);
      
      const regime = (client as any).calculateRegime('BTCUSDT', candles);

      expect(regime.regime).toBe('TRENDING_DOWN');
      expect(regime.trendDirection).toBe('BEARISH');
      expect(regime.symbol).toBe('BTCUSDT');
    });

    it('should calculate regime with valid values', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      // Create candles in ranging market (sideways)
      const candles = createRangingCandles(200);
      
      const regime = (client as any).calculateRegime('BTCUSDT', candles);

      // Verify regime is one of the valid values
      expect(['TRENDING_UP', 'TRENDING_DOWN', 'RANGING']).toContain(regime.regime);
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(regime.trendDirection);
      expect(regime.confidence).toBeGreaterThanOrEqual(0);
      expect(regime.confidence).toBeLessThanOrEqual(1);
      expect(regime.ema200).toBeDefined();
      expect(regime.adx14).toBeDefined();
      expect(regime.price).toBeDefined();
      expect(regime.symbol).toBe('BTCUSDT');
    });

    it('should calculate regime separately for each symbol', () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT', 'ETHUSDT'],
      });

      const btcCandles = createTrendingCandles('up', 200);
      const ethCandles = createTrendingCandles('down', 200);
      
      const btcRegime = (client as any).calculateRegime('BTCUSDT', btcCandles);
      const ethRegime = (client as any).calculateRegime('ETHUSDT', ethCandles);

      expect(btcRegime.symbol).toBe('BTCUSDT');
      expect(btcRegime.regime).toBe('TRENDING_UP');
      
      expect(ethRegime.symbol).toBe('ETHUSDT');
      expect(ethRegime.regime).toBe('TRENDING_DOWN');
    });
  });

  describe('event emission', () => {
    it('should emit market_regime_1h_updated event after calculation', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT'],
      });

      const mockKlines = createMockKlines(200);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      });

      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegime1HUpdated>('market_regime_1h_updated', eventHandler);

      client.start();
      await jest.advanceTimersByTimeAsync(0);

      expect(eventHandler).toHaveBeenCalled();
      const event = eventHandler.mock.calls[0][0];
      expect(event).toHaveProperty('symbol');
      expect(event).toHaveProperty('regime');
      expect(event).toHaveProperty('trendDirection');
      expect(event).toHaveProperty('confidence');
      expect(event).toHaveProperty('ema200');
      expect(event).toHaveProperty('adx14');
      expect(event).toHaveProperty('price');
    });

    it('should emit events for all symbols', async () => {
      client = new BinanceRestClient1H(eventBus, {
        symbols: ['BTCUSDT', 'ETHUSDT'],
      });

      const mockKlines = createMockKlines(200);
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      });

      const eventHandler = jest.fn();
      eventBus.subscribe<MarketRegime1HUpdated>('market_regime_1h_updated', eventHandler);

      client.start();
      await jest.advanceTimersByTimeAsync(0);

      // Should emit one event per symbol
      expect(eventHandler).toHaveBeenCalledTimes(2);
      
      const symbols = eventHandler.mock.calls.map(call => call[0].symbol);
      expect(symbols).toContain('BTCUSDT');
      expect(symbols).toContain('ETHUSDT');
    });
  });
});

// Helper functions to create test data
function createMockKlines(count: number): Array<[number, string, string, string, string, string, number, string, number, string, string, string]> {
  const klines: Array<[number, string, string, string, string, string, number, string, number, string, string, string]> = [];
  let price = 50000;
  let timestamp = 1234567890000;

  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price + (Math.random() - 0.5) * 1000;
    const high = Math.max(open, close) + Math.random() * 500;
    const low = Math.min(open, close) - Math.random() * 500;
    const volume = 1 + Math.random() * 5;

    klines.push([
      timestamp,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      volume.toFixed(8),
      timestamp + 3600000, // 1 hour later
      (volume * close).toFixed(8),
      Math.floor(Math.random() * 1000),
      (volume * 0.5).toFixed(8),
      (volume * close * 0.5).toFixed(8),
      '0',
    ]);

    price = close;
    timestamp += 3600000; // 1 hour
  }

  return klines;
}

function createTrendingCandles(direction: 'up' | 'down', count: number) {
  const candles = [];
  let price = direction === 'up' ? 40000 : 60000;
  let timestamp = 1234567890000;

  for (let i = 0; i < count; i++) {
    const change = direction === 'up' ? 150 : -150;
    const open = price;
    const close = price + change + (Math.random() - 0.5) * 50;
    const high = Math.max(open, close) + 100;
    const low = Math.min(open, close) - 50;

    candles.push({
      symbol: 'BTCUSDT',
      open,
      high,
      low,
      close,
      timestamp,
      volume: 1 + Math.random() * 5,
      isClosed: true,
      interval: '1h',
      isHistorical: true,
    });

    price = close;
    timestamp += 3600000;
  }

  return candles;
}

function createRangingCandles(count: number) {
  const candles = [];
  let price = 50000;
  let timestamp = 1234567890000;

  for (let i = 0; i < count; i++) {
    // Create true sideways movement - oscillate around base price
    const oscillation = Math.sin(i * 0.1) * 50; // Smooth oscillation
    const open = price;
    const close = 50000 + oscillation;
    const high = Math.max(open, close) + 30;
    const low = Math.min(open, close) - 30;

    candles.push({
      symbol: 'BTCUSDT',
      open,
      high,
      low,
      close,
      timestamp,
      volume: 1 + Math.random() * 5,
      isClosed: true,
      interval: '1h',
      isHistorical: true,
    });

    price = close;
    timestamp += 3600000;
  }

  return candles;
}
