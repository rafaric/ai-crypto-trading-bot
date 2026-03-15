import { EventBus } from '../core/EventBus';
import { Candle, MarketRegime1HUpdated } from '../../../shared/src/events';
import { EMA } from '../indicators/EMA';
import { ADX } from '../indicators/ADX';

export interface BinanceRestClient1HConfig {
  symbols: string[];
  pollingIntervalMinutes?: number;
  candleLimit?: number;
}

export interface SymbolCandles {
  symbol: string;
  candles: Candle[];
}

/**
 * Binance REST Client for 1H timeframe data
 * Supports multiple trading pairs - fetches all in parallel
 * Polls Binance API every 60 minutes (configurable)
 * Calculates EMA200 and ADX14 for macro trend analysis per symbol
 * Emits market_regime_1h_updated events for each symbol
 */
export class BinanceRestClient1H {
  private readonly baseUrl = 'https://api.binance.com';
  private readonly eventBus: EventBus;
  private readonly symbols: string[];
  private readonly pollingIntervalMs: number;
  private readonly candleLimit: number;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private retryAttempts = 0;
  private readonly maxRetryDelay = 60000;
  private readonly baseRetryDelay = 1000;

  // Indicators per symbol for regime calculation
  private emaIndicators: Map<string, EMA> = new Map();
  private adxIndicators: Map<string, ADX> = new Map();

  constructor(eventBus: EventBus, config: BinanceRestClient1HConfig) {
    this.eventBus = eventBus;
    this.symbols = config.symbols.map(s => s.toUpperCase());
    this.pollingIntervalMs = (config.pollingIntervalMinutes || 60) * 60 * 1000;
    this.candleLimit = config.candleLimit || 200;

    // Initialize indicators for each symbol
    for (const symbol of this.symbols) {
      this.emaIndicators.set(symbol, new EMA(200));
      this.adxIndicators.set(symbol, new ADX(14));
    }
  }

  /**
   * Start polling for 1H data
   * Fetches immediately, then polls at configured interval
   */
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ BinanceRestClient1H already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 BinanceRestClient1H started - polling ${this.symbols.length} symbols 1H candles every ${this.pollingIntervalMs / 60000} minutes`);

    // Fetch immediately on start
    this.fetchAndCalculate();

    // Set up polling interval
    this.pollingTimer = setInterval(() => {
      this.fetchAndCalculate();
    }, this.pollingIntervalMs);
  }

  /**
   * Stop polling and cleanup
   */
  public stop(): void {
    this.isRunning = false;

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    console.log('🛑 BinanceRestClient1H stopped');
  }

  /**
   * Fetch 1H candles for all symbols and calculate regime
   * Private - called by start() and polling timer
   */
  private async fetchAndCalculate(): Promise<void> {
    try {
      console.log(`📊 Fetching ${this.candleLimit} 1H candles for ${this.symbols.length} symbols...`);
      
      const results = await this.fetchAllSymbols();
      console.log(`✅ Fetched 1H candles for ${results.size} symbols`);

      // Calculate and emit regime for each symbol
      for (const [symbol, candles] of results) {
        const regime = this.calculateRegime(symbol, candles);
        console.log(`📊 1H Regime [${symbol}]: ${regime.regime} (${regime.trendDirection}) - EMA200: ${regime.ema200.toFixed(2)}, ADX14: ${regime.adx14.toFixed(2)}`);
        
        // Emit regime event with symbol
        this.eventBus.publish<MarketRegime1HUpdated>('market_regime_1h_updated', regime);
      }

      // Reset retry attempts on success
      this.retryAttempts = 0;
    } catch (error) {
      console.error('❌ Failed to fetch 1H data:', error);
      this.handleError();
    }
  }

  /**
   * Fetch historical 1H candles from Binance REST API for all symbols in parallel
   */
  private async fetchAllSymbols(): Promise<Map<string, Candle[]>> {
    const promises = this.symbols.map(symbol => this.fetchSymbolCandles(symbol));
    const results = await Promise.all(promises);
    
    const candlesMap = new Map<string, Candle[]>();
    for (const result of results) {
      candlesMap.set(result.symbol, result.candles);
    }
    return candlesMap;
  }

  /**
   * Fetch historical 1H candles for a single symbol
   */
  private async fetchSymbolCandles(symbol: string): Promise<SymbolCandles> {
    const url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=1h&limit=${this.candleLimit}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Binance API error: ${response.status} ${errorText}`);
      }

      const klines: Array<[number, string, string, string, string, string, number, string, number, string, string, string]> = await response.json();

      if (!Array.isArray(klines) || klines.length === 0) {
        throw new Error('No candles returned from Binance API');
      }

      // Transform Binance klines to Candle format
      const candles: Candle[] = klines.map((kline) => ({
        symbol: symbol,
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        timestamp: kline[0],
        volume: parseFloat(kline[5]),
        isClosed: true,
        interval: '1h',
        isHistorical: true,
      }));

      return { symbol, candles };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch candles for ${symbol}: ${error.message}`);
      }
      throw new Error(`Failed to fetch candles for ${symbol}: Unknown error`);
    }
  }

  /**
   * Calculate market regime from 1H candles for a specific symbol
   * Uses EMA200 and ADX14
   */
  private calculateRegime(symbol: string, candles: Candle[]): MarketRegime1HUpdated {
    const ema = this.emaIndicators.get(symbol);
    const adx = this.adxIndicators.get(symbol);

    if (!ema || !adx) {
      throw new Error(`Indicators not initialized for symbol: ${symbol}`);
    }

    // Calculate EMA200
    const emaValues = ema.calculate(candles);
    const currentEMA200 = emaValues[emaValues.length - 1];

    // Calculate ADX14
    const adxValues = adx.calculate(candles);
    const currentADX14 = adxValues[adxValues.length - 1];

    // Get current price (last close)
    const currentPrice = candles[candles.length - 1].close;

    if (currentEMA200 === null || currentADX14 === null) {
      // Fallback if indicators can't be calculated
      return {
        symbol,
        regime: 'RANGING',
        trendDirection: 'NEUTRAL',
        confidence: 0,
        timestamp: Date.now(),
        ema200: currentPrice,
        adx14: 0,
        price: currentPrice,
      };
    }

    // Determine regime
    const ADX_THRESHOLD = 25;
    const isStrongTrend = currentADX14 >= ADX_THRESHOLD;
    const isAboveEMA = currentPrice > currentEMA200;

    let regime: MarketRegime1HUpdated['regime'];
    let trendDirection: MarketRegime1HUpdated['trendDirection'];
    let confidence: number;

    if (!isStrongTrend) {
      regime = 'RANGING';
      trendDirection = 'NEUTRAL';
      confidence = Math.max(0, (ADX_THRESHOLD - currentADX14) / ADX_THRESHOLD);
    } else if (isAboveEMA) {
      regime = 'TRENDING_UP';
      trendDirection = 'BULLISH';
      confidence = Math.min(1, currentADX14 / 50);
    } else {
      regime = 'TRENDING_DOWN';
      trendDirection = 'BEARISH';
      confidence = Math.min(1, currentADX14 / 50);
    }

    return {
      symbol,
      regime,
      trendDirection,
      confidence,
      timestamp: Date.now(),
      ema200: currentEMA200,
      adx14: currentADX14,
      price: currentPrice,
    };
  }

  /**
   * Handle fetch errors with exponential backoff retry
   */
  private handleError(): void {
    if (!this.isRunning) {
      return;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, this.retryAttempts),
      this.maxRetryDelay
    );

    this.retryAttempts++;
    console.log(`🔄 Retrying 1H fetch in ${delay}ms (attempt ${this.retryAttempts})`);

    setTimeout(() => {
      if (this.isRunning) {
        this.fetchAndCalculate();
      }
    }, delay);
  }
}
