import { EventBus } from '../core/EventBus';
import { Candle, MarketRegime1HUpdated } from '../../../shared/src/events';
import { EMA } from '../indicators/EMA';
import { ADX } from '../indicators/ADX';

export interface BinanceRestClient1HConfig {
  symbol: string;
  pollingIntervalMinutes?: number;
  candleLimit?: number;
}

/**
 * Binance REST Client for 1H timeframe data
 * Polls Binance API every 60 minutes (configurable)
 * Calculates EMA200 and ADX14 for macro trend analysis
 * Emits market_regime_1h_updated events
 */
export class BinanceRestClient1H {
  private readonly baseUrl = 'https://api.binance.com';
  private readonly eventBus: EventBus;
  private readonly symbol: string;
  private readonly pollingIntervalMs: number;
  private readonly candleLimit: number;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private retryAttempts = 0;
  private readonly maxRetryDelay = 60000;
  private readonly baseRetryDelay = 1000;

  // Indicators for regime calculation
  private ema: EMA;
  private adx: ADX;

  constructor(eventBus: EventBus, config: BinanceRestClient1HConfig) {
    this.eventBus = eventBus;
    this.symbol = config.symbol.toUpperCase();
    this.pollingIntervalMs = (config.pollingIntervalMinutes || 60) * 60 * 1000;
    this.candleLimit = config.candleLimit || 200;

    // Initialize indicators
    this.ema = new EMA(200);
    this.adx = new ADX(14);
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
    console.log(`🚀 BinanceRestClient1H started - polling ${this.symbol} 1H candles every ${this.pollingIntervalMs / 60000} minutes`);

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
   * Fetch 1H candles and calculate regime
   * Private - called by start() and polling timer
   */
  private async fetchAndCalculate(): Promise<void> {
    try {
      console.log(`📊 Fetching ${this.candleLimit} 1H candles for ${this.symbol}...`);
      
      const candles = await this.fetchHistoricalCandles();
      console.log(`✅ Fetched ${candles.length} 1H candles`);

      const regime = this.calculateRegime(candles);
      
      console.log(`📊 1H Regime: ${regime.regime} (${regime.trendDirection}) - EMA200: ${regime.ema200.toFixed(2)}, ADX14: ${regime.adx14.toFixed(2)}`);

      // Emit regime event
      this.eventBus.publish<MarketRegime1HUpdated>('market_regime_1h_updated', regime);

      // Reset retry attempts on success
      this.retryAttempts = 0;
    } catch (error) {
      console.error('❌ Failed to fetch 1H data:', error);
      this.handleError();
    }
  }

  /**
   * Fetch historical 1H candles from Binance REST API
   */
  private async fetchHistoricalCandles(): Promise<Candle[]> {
    const url = `${this.baseUrl}/api/v3/klines?symbol=${this.symbol}&interval=1h&limit=${this.candleLimit}`;

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
        symbol: this.symbol,
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

      return candles;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch historical candles: ${error.message}`);
      }
      throw new Error('Failed to fetch historical candles: Unknown error');
    }
  }

  /**
   * Calculate market regime from 1H candles
   * Uses EMA200 and ADX14
   */
  private calculateRegime(candles: Candle[]): MarketRegime1HUpdated {
    // Calculate EMA200
    const emaValues = this.ema.calculate(candles);
    const currentEMA200 = emaValues[emaValues.length - 1];

    // Calculate ADX14
    const adxValues = this.adx.calculate(candles);
    const currentADX14 = adxValues[adxValues.length - 1];

    // Get current price (last close)
    const currentPrice = candles[candles.length - 1].close;

    if (currentEMA200 === null || currentADX14 === null) {
      // Fallback if indicators can't be calculated
      return {
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
