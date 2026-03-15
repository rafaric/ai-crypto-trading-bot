import { EventBus } from '../core/EventBus';
import { Candle } from '../../../shared/src/events';
import { EMA } from '../indicators/EMA';
import { ADX } from '../indicators/ADX';

export interface MarketRegimeEvent {
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
}

interface HourlyCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  volume: number;
}

const MAX_HOURLY_CANDLES = 250; // Enough for EMA200 + buffer
const ADX_THRESHOLD = 25;
const EMA_PROXIMITY_THRESHOLD = 0.005; // 0.5% proximity to EMA

export class MarketRegimeDetector {
  private eventBus: EventBus;
  private unsubscribeFn: (() => void) | null = null;
  
  // 1-minute candles cache for aggregation
  private oneMinuteCandles: Candle[] = [];
  
  // 1-hour aggregated candles
  private hourlyCandles: HourlyCandle[] = [];
  
  // Indicators for 1H timeframe
  private ema200: EMA;
  private adx: ADX;
  
  // Current regime state
  private currentRegime: MarketRegimeEvent | null = null;
  
  // Track current hour for aggregation
  private currentHourTimestamp: number | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.ema200 = new EMA(200);
    this.adx = new ADX(14);
    
    // Subscribe to candle_closed event
    this.unsubscribeFn = this.eventBus.subscribe<Candle>(
      'candle_closed',
      this.handleCandleClosed.bind(this)
    );
  }

  /**
   * Unsubscribe from events and cleanup
   */
  public unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
  }

  /**
   * Get current market regime
   */
  public getCurrentRegime(): MarketRegimeEvent | null {
    return this.currentRegime;
  }

  /**
   * Handle candle_closed event
   */
  private handleCandleClosed(candle: Candle): void {
    // Store 1-minute candle
    this.oneMinuteCandles.push(candle);
    
    // Keep only recent 1-minute candles (last 2 hours)
    if (this.oneMinuteCandles.length > 120) {
      this.oneMinuteCandles.shift();
    }

    // Aggregate into 1-hour candle
    this.aggregateToHourly(candle);
  }

  /**
   * Aggregate 1-minute candles into 1-hour candles
   */
  private aggregateToHourly(candle: Candle): void {
    const hourTimestamp = this.getHourTimestamp(candle.timestamp);
    
    if (this.currentHourTimestamp === null) {
      this.currentHourTimestamp = hourTimestamp;
    }

    if (hourTimestamp !== this.currentHourTimestamp) {
      // Hour changed, finalize previous hour candle
      this.finalizeHourlyCandle();
      this.currentHourTimestamp = hourTimestamp;
    }

    // Add to current hour's candles
    // The hourly candle is built incrementally
    const existingHourlyCandle = this.hourlyCandles.find(
      c => c.timestamp === this.currentHourTimestamp
    );

    if (existingHourlyCandle) {
      // Update existing hourly candle
      existingHourlyCandle.high = Math.max(existingHourlyCandle.high, candle.high);
      existingHourlyCandle.low = Math.min(existingHourlyCandle.low, candle.low);
      existingHourlyCandle.close = candle.close;
      existingHourlyCandle.volume += candle.volume;
    } else {
      // Create new hourly candle
      this.hourlyCandles.push({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        timestamp: this.currentHourTimestamp,
        volume: candle.volume,
      });
    }

    // Maintain bounded cache
    if (this.hourlyCandles.length > MAX_HOURLY_CANDLES) {
      this.hourlyCandles.shift();
    }

    // Check if we should recalculate regime
    // Only recalculate when we have enough data and a new hour starts
    if (hourTimestamp !== this.currentHourTimestamp || this.hourlyCandles.length >= 200) {
      this.calculateAndEmitRegime();
    }
  }

  /**
   * Finalize the current hourly candle when hour changes
   */
  private finalizeHourlyCandle(): void {
    // Trigger regime calculation when an hour completes
    this.calculateAndEmitRegime();
  }

  /**
   * Get hour timestamp (floor to nearest hour)
   */
  private getHourTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    date.setMinutes(0, 0, 0);
    return date.getTime();
  }

  /**
   * Calculate market regime and emit event if changed
   */
  private calculateAndEmitRegime(): void {
    // Need at least 200 hourly candles for EMA200
    if (this.hourlyCandles.length < 200) {
      return;
    }

    // Convert hourly candles to format expected by indicators
    const candlesForIndicators: Candle[] = this.hourlyCandles.map(h => ({
      symbol: 'BTC/USDT',
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      timestamp: h.timestamp,
      volume: h.volume,
    }));

    // Calculate EMA200
    const emaValues = this.ema200.calculate(candlesForIndicators);
    const currentEMA = emaValues[emaValues.length - 1];

    // Calculate ADX
    const adxValues = this.adx.calculate(candlesForIndicators);
    const currentADX = adxValues[adxValues.length - 1];

    if (currentEMA === null || currentADX === null) {
      return;
    }

    const lastCandle = this.hourlyCandles[this.hourlyCandles.length - 1];
    const currentPrice = lastCandle.close;

    // Determine regime
    let regime: MarketRegimeEvent['regime'];
    let trendDirection: MarketRegimeEvent['trendDirection'];
    let confidence: number;

    // Check if ADX indicates strong trend
    const isStrongTrend = currentADX >= ADX_THRESHOLD;
    
    // Check price position relative to EMA200
    const isAboveEMA = currentPrice > currentEMA;
    const isNearEMA = Math.abs(currentPrice - currentEMA) / currentEMA < EMA_PROXIMITY_THRESHOLD;

    if (!isStrongTrend || isNearEMA) {
      // Weak trend or price near EMA = ranging
      regime = 'RANGING';
      trendDirection = 'NEUTRAL';
      confidence = Math.max(0, (ADX_THRESHOLD - currentADX) / ADX_THRESHOLD);
    } else if (isAboveEMA) {
      // Price above EMA200 with strong trend
      regime = 'TRENDING_UP';
      trendDirection = 'BULLISH';
      confidence = Math.min(1, currentADX / 50); // Normalize ADX to confidence
    } else {
      // Price below EMA200 with strong trend
      regime = 'TRENDING_DOWN';
      trendDirection = 'BEARISH';
      confidence = Math.min(1, currentADX / 50); // Normalize ADX to confidence
    }

    // Create new regime event
    const newRegime: MarketRegimeEvent = {
      regime,
      trendDirection,
      confidence,
      timestamp: Date.now(),
    };

    // Only emit if regime changed
    if (this.shouldEmitRegimeChange(newRegime)) {
      this.currentRegime = newRegime;
      this.eventBus.publish<MarketRegimeEvent>('market_regime_changed', newRegime);
      console.log(`📊 Market Regime Changed: ${regime} (${trendDirection}) - Confidence: ${(confidence * 100).toFixed(1)}%`);
    }
  }

  /**
   * Check if regime changed significantly enough to emit event
   */
  private shouldEmitRegimeChange(newRegime: MarketRegimeEvent): boolean {
    if (!this.currentRegime) {
      return true;
    }

    // Emit if regime type changed
    if (this.currentRegime.regime !== newRegime.regime) {
      return true;
    }

    // Emit if confidence changed significantly (>20% change)
    const confidenceDiff = Math.abs(this.currentRegime.confidence - newRegime.confidence);
    if (confidenceDiff > 0.2) {
      return true;
    }

    return false;
  }
}
