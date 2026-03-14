import { Candle } from '../domain/MarketTick';

/**
 * Binance API response format for klines endpoint
 * [timestamp, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVolume, takerBuyQuoteVolume, ignore]
 */
type BinanceKline = [
  number, // timestamp
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteVolume
  number, // trades
  string, // takerBuyBaseVolume
  string, // takerBuyQuoteVolume
  string  // ignore
];

export interface BinanceRestClientConfig {
  symbol: string;
  interval?: string;
  limit?: number;
}

/**
 * Binance REST API Client
 * Fetches historical candle/klines data from Binance public API
 * No authentication required - uses public endpoints
 */
export class BinanceRestClient {
  private readonly baseUrl = 'https://api.binance.com';
  private readonly symbol: string;
  private readonly interval: string;
  private readonly limit: number;

  constructor(config: BinanceRestClientConfig) {
    this.symbol = config.symbol.toUpperCase();
    this.interval = config.interval || '1m';
    this.limit = config.limit || 200;
  }

  /**
   * Fetch historical candles from Binance REST API
   * @returns Array of Candle objects with OHLC data (oldest first)
   */
  public async fetchHistoricalCandles(): Promise<Candle[]> {
    const url = `${this.baseUrl}/api/v3/klines?symbol=${this.symbol}&interval=${this.interval}&limit=${this.limit}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} ${errorText}`);
      }

      const klines: BinanceKline[] = await response.json();
      
      if (!Array.isArray(klines) || klines.length === 0) {
        throw new Error('No candles returned from Binance API');
      }

      // Transform Binance klines to Candle format with OHLC
      const candles: Candle[] = klines.map((kline) => ({
        symbol: this.symbol,
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        timestamp: kline[0], // open timestamp
        volume: parseFloat(kline[5]),
        isClosed: true,
        interval: this.interval,
        isHistorical: true,
      }));

      return candles;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch historical candles: ${error.message}`);
      }
      throw new Error('Failed to fetch historical candles: Unknown error');
    }
  }

  /**
   * Fetch candles with progress callback
   * @param onProgress Called with (current, total) as candles are fetched
   * @returns Array of Candle objects with OHLC data
   */
  public async fetchWithProgress(
    onProgress: (current: number, total: number) => void
  ): Promise<Candle[]> {
    onProgress(0, this.limit);
    
    const candles = await this.fetchHistoricalCandles();
    
    // Simulate progress for each candle since we get them all at once
    candles.forEach((_, index) => {
      onProgress(index + 1, this.limit);
    });

    return candles;
  }
}
