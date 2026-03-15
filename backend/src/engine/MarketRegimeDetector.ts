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

interface FifteenMinuteCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  volume: number;
}

const MAX_FIFTEEN_MINUTE_CANDLES = 50; // Enough for EMA20 + buffer
const ADX_THRESHOLD = 25;
const EMA_PROXIMITY_THRESHOLD = 0.005; // 0.5% proximity to EMA
const CANDLES_PER_15M = 15; // 15 candles of 1m = 1 candle of 15m

export class MarketRegimeDetector {
  private eventBus: EventBus;
  private unsubscribeFn: (() => void) | null = null;
  
  // 1-minute candles cache for aggregation
  private minuteCandles: Candle[] = [];
  
  // 15-minute aggregated candles
  private fifteenMinuteCandles: FifteenMinuteCandle[] = [];
  
  // Indicators for 15m timeframe
  private ema: EMA;
  private adx: ADX;
  
  // Current regime state
  private currentRegime: MarketRegimeEvent | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.ema = new EMA(20);
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
    this.minuteCandles.push(candle);

    // Check if we have enough candles to create a 15m candle
    if (this.minuteCandles.length >= CANDLES_PER_15M) {
      this.aggregateTo15m();
    }

    // Keep only recent 1-minute candles (last 2 periods for buffer)
    if (this.minuteCandles.length > CANDLES_PER_15M * 2) {
      this.minuteCandles.shift();
    }
  }

  /**
   * Aggregate 1-minute candles into 15-minute candles
   */
  private aggregateTo15m(): void {
    // Take the first 15 candles
    const candles = this.minuteCandles.slice(0, CANDLES_PER_15M);
    this.minuteCandles = this.minuteCandles.slice(CANDLES_PER_15M);

    // Create 15m candle from 1m candles
    const fifteenMinCandle: FifteenMinuteCandle = {
      open: candles[0].open,
      high: Math.max(...candles.map(c => c.high)),
      low: Math.min(...candles.map(c => c.low)),
      close: candles[candles.length - 1].close,
      timestamp: candles[0].timestamp,
      volume: candles.reduce((sum, c) => sum + c.volume, 0),
    };

    // Add to 15m candles array
    this.fifteenMinuteCandles.push(fifteenMinCandle);

    // Maintain bounded cache
    if (this.fifteenMinuteCandles.length > MAX_FIFTEEN_MINUTE_CANDLES) {
      this.fifteenMinuteCandles.shift();
    }

    // Recalculate regime after adding new 15m candle
    this.calculateAndEmitRegime();
  }

  /**
   * Calculate market regime and emit event if changed
   */
  private calculateAndEmitRegime(): void {
    // Need at least 20 fifteen-minute candles for EMA20
    console.log(`📊 MarketRegimeDetector: ${this.fifteenMinuteCandles.length}/20 fifteen-minute candles`);
    
    if (this.fifteenMinuteCandles.length < 20) {
      console.log(`⏳ Waiting for more 15m candles: ${this.fifteenMinuteCandles.length}/20`);
      return;
    }

    // Convert 15m candles to format expected by indicators
    const candlesForIndicators: Candle[] = this.fifteenMinuteCandles.map((f15: FifteenMinuteCandle) => ({
      symbol: 'BTC/USDT',
      open: f15.open,
      high: f15.high,
      low: f15.low,
      close: f15.close,
      timestamp: f15.timestamp,
      volume: f15.volume,
    }));

    // Calculate EMA20
    const emaValues = this.ema.calculate(candlesForIndicators);
    const currentEMA = emaValues[emaValues.length - 1];

    // Calculate ADX
    const adxValues = this.adx.calculate(candlesForIndicators);
    const currentADX = adxValues[adxValues.length - 1];

    if (currentEMA === null || currentADX === null) {
      return;
    }

    const lastCandle = this.fifteenMinuteCandles[this.fifteenMinuteCandles.length - 1];
    const currentPrice = lastCandle.close;

    // Determine regime
    let regime: MarketRegimeEvent['regime'];
    let trendDirection: MarketRegimeEvent['trendDirection'];
    let confidence: number;

    // Check if ADX indicates strong trend
    const isStrongTrend = currentADX >= ADX_THRESHOLD;
    
    // Check price position relative to EMA20
    const isAboveEMA = currentPrice > currentEMA;
    const isNearEMA = Math.abs(currentPrice - currentEMA) / currentEMA < EMA_PROXIMITY_THRESHOLD;

    if (!isStrongTrend || isNearEMA) {
      // Weak trend or price near EMA = ranging
      regime = 'RANGING';
      trendDirection = 'NEUTRAL';
      confidence = Math.max(0, (ADX_THRESHOLD - currentADX) / ADX_THRESHOLD);
    } else if (isAboveEMA) {
      // Price above EMA20 with strong trend
      regime = 'TRENDING_UP';
      trendDirection = 'BULLISH';
      confidence = Math.min(1, currentADX / 50); // Normalize ADX to confidence
    } else {
      // Price below EMA20 with strong trend
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
    if (this.currentRegime?.regime !== newRegime.regime) {
      this.currentRegime = newRegime;
      console.log(`🎯 Market regime changed: ${newRegime.regime} (${newRegime.trendDirection}) - Confidence: ${(newRegime.confidence * 100).toFixed(1)}%`);
      this.eventBus.publish<MarketRegimeEvent>('market_regime_changed', newRegime);
    } else {
      console.log(`📊 Regime stable: ${newRegime.regime} (${newRegime.trendDirection})`);
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
