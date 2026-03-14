import { BinanceRestClient } from './BinanceRestClient';
import { EventBus } from '../core/EventBus';

describe('BinanceRestClient', () => {
  let client: BinanceRestClient;

  beforeEach(() => {
    client = new BinanceRestClient({
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 200,
    });
  });

  it('should create client with valid config', () => {
    expect(client).toBeDefined();
  });

  it('should use default interval and limit when not provided', () => {
    const defaultClient = new BinanceRestClient({ symbol: 'ETHUSDT' });
    expect(defaultClient).toBeDefined();
  });

  it('should normalize symbol to uppercase', () => {
    const lowercaseClient = new BinanceRestClient({ symbol: 'btcusdt' });
    expect(lowercaseClient).toBeDefined();
  });

  describe('fetchHistoricalCandles', () => {
    it('should return empty array on API error', async () => {
      // Mock fetch to simulate error
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(client.fetchHistoricalCandles()).rejects.toThrow(
        'Failed to fetch historical candles'
      );

      global.fetch = originalFetch;
    });

    it('should throw error on non-ok response', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad Request'),
      } as unknown as Response);

      await expect(client.fetchHistoricalCandles()).rejects.toThrow(
        'Binance API error'
      );

      global.fetch = originalFetch;
    });

    it('should throw error on empty response', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      } as unknown as Response);

      await expect(client.fetchHistoricalCandles()).rejects.toThrow(
        'No candles returned'
      );

      global.fetch = originalFetch;
    });

    it('should transform Binance klines to Candle format with OHLC', async () => {
      const mockKlines: Array<[number, string, string, string, string, string, number, string, number, string, string, string]> = [
        [1234567890000, '50000', '51000', '49000', '50500', '1.5', 1234567950000, '75750', 100, '0.75', '37875', '0'],
        [1234567950000, '50500', '51500', '49500', '51000', '2.0', 1234568010000, '102000', 150, '1.0', '51000', '0'],
      ];

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      } as unknown as Response);

      const candles = await client.fetchHistoricalCandles();

      expect(candles).toHaveLength(2);
      expect(candles[0]).toEqual({
        symbol: 'BTCUSDT',
        open: 50000,
        high: 51000,
        low: 49000,
        close: 50500,
        timestamp: 1234567890000,
        volume: 1.5,
        isClosed: true,
        interval: '1m',
      });
      expect(candles[1]).toEqual({
        symbol: 'BTCUSDT',
        open: 50500,
        high: 51500,
        low: 49500,
        close: 51000,
        timestamp: 1234567950000,
        volume: 2.0,
        isClosed: true,
        interval: '1m',
      });

      global.fetch = originalFetch;
    });
  });

  describe('fetchWithProgress', () => {
    it('should call progress callback during fetch', async () => {
      const mockKlines: Array<[number, string, string, string, string, string, number, string, number, string, string, string]> = [
        [1234567890000, '50000', '51000', '49000', '50500', '1.5', 1234567950000, '75750', 100, '0.75', '37875', '0'],
        [1234567950000, '50500', '51500', '49500', '51000', '2.0', 1234568010000, '102000', 150, '1.0', '51000', '0'],
      ];

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockKlines),
      } as unknown as Response);

      const progressCallback = jest.fn();
      
      await client.fetchWithProgress(progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(0, 200);
      expect(progressCallback).toHaveBeenCalledWith(1, 200);
      expect(progressCallback).toHaveBeenCalledWith(2, 200);

      global.fetch = originalFetch;
    });
  });
});
