import { EventBus } from '../core/EventBus';
import { Candle, SignalGenerated } from '../../../shared/src/events';
import { EMA } from '../indicators/EMA';
import { VWAP } from '../indicators/VWAP';
import { RSI } from '../indicators/RSI';
import { MACD, MACDResult } from '../indicators/MACD';
import { ATR } from '../indicators/ATR';
import { CandlestickPatterns } from '../indicators/CandlestickPatterns';
import { MarketRegimeEvent } from './MarketRegimeDetector';

import type { IndicatorSeries } from '../../../shared/src/events';

export interface IndicatorValues {
  ema: {
    value: number | null;
    series: IndicatorSeries[];
    period: number;
  };
  vwap: {
    value: number | null;
    series: IndicatorSeries[];
    period: number;
  };
  rsi: {
    value: number | null;
    signal: 'overbought' | 'oversold' | 'neutral' | null;
    period: number;
  };
  macd: {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
    crossovers: MACDResult['crossovers'];
  };
  atr: {
    value: number | null;
    period: number;
  };
  candlestick: {
    patterns: Array<{
      pattern: string;
      type: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      timestamp: number;
      index: number;
    }>;
  };
}

export interface IndicatorsUpdatedEvent {
  symbol: string;
  indicators: IndicatorValues;
  timestamp: number;
}

export interface SignalDetectedEvent {
  symbol: string;
  signal: 'bullish' | 'bearish';
  pattern: string;
  confidence: number;
  timestamp: number;
}

const MAX_CANDLES_CACHE = 300;

export class IndicatorEngine {
  private eventBus: EventBus;
  
  // Multi-pair support: Map of symbol -> Candle[]
  private candlesCache: Map<string, Candle[]> = new Map();
  
  private unsubscribeFn: (() => void) | null = null;
  
  // Indicators - single instances calculate for any symbol
  private ema: EMA;
  private vwap: VWAP;
  private rsi: RSI;
  private macd: MACD;
  private atr: ATR;
  
  // Signal deduplication - track recently emitted signals to prevent spam
  // Key: "{symbol}-{pattern}"
  private recentSignals: Map<string, number> = new Map();
  private readonly SIGNAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  // Market regime state per pair: Map<symbol, MarketRegimeEvent>
  private currentRegimes: Map<string, MarketRegimeEvent> = new Map();
  private regimeUnsubscribeFn: (() => void) | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    // Initialize indicators with default periods
    this.ema = new EMA(200);
    this.vwap = new VWAP(14);
    this.rsi = new RSI(14);
    this.macd = new MACD(12, 26, 9);
    this.atr = new ATR(14);

    // Subscribe to candle_closed event
    this.unsubscribeFn = this.eventBus.subscribe<Candle>(
      'candle_closed',
      this.handleCandleClosed.bind(this)
    );

    // Subscribe to market_regime_changed event
    this.regimeUnsubscribeFn = this.eventBus.subscribe<MarketRegimeEvent>(
      'market_regime_changed',
      this.handleRegimeChanged.bind(this)
    );
  }

  /**
   * Handle market regime changes per pair
   */
  private handleRegimeChanged(regime: MarketRegimeEvent & { symbol?: string }): void {
    // The regime event should include the symbol
    const symbol = regime.symbol || 'UNKNOWN';
    this.currentRegimes.set(symbol, regime);
    console.log(`📊 IndicatorEngine: Market regime updated for ${symbol} - ${regime.regime} (${regime.trendDirection})`);
  }

  /**
   * Get current market regime for a specific pair
   */
  public getCurrentRegime(symbol: string): MarketRegimeEvent | null {
    return this.currentRegimes.get(symbol) || null;
  }

  /**
   * Get all current regimes
   */
  public getAllRegimes(): Map<string, MarketRegimeEvent> {
    return new Map(this.currentRegimes);
  }

  /**
   * Unsubscribe from events and cleanup
   */
  public unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    if (this.regimeUnsubscribeFn) {
      this.regimeUnsubscribeFn();
      this.regimeUnsubscribeFn = null;
    }
  }

  /**
   * Get current candles cache for a specific symbol
   */
  public getCandlesCache(symbol: string): Candle[] {
    const cache = this.candlesCache.get(symbol);
    return cache ? [...cache] : [];
  }

  /**
   * Get all candles caches (for debugging/monitoring)
   */
  public getAllCandlesCaches(): Map<string, Candle[]> {
    const result = new Map<string, Candle[]>();
    this.candlesCache.forEach((candles, symbol) => {
      result.set(symbol, [...candles]);
    });
    return result;
  }

  /**
   * Handle candle_closed event - process per pair
   */
  private handleCandleClosed(candle: Candle): void {
    const symbol = candle.symbol;
    console.log(`🕯️ Processing candle: ${symbol} @ $${candle.close.toFixed(2)}`);
    
    // Get or create cache for this symbol
    let symbolCache = this.candlesCache.get(symbol);
    if (!symbolCache) {
      symbolCache = [];
      this.candlesCache.set(symbol, symbolCache);
    }
    
    // Add candle to cache
    symbolCache.push(candle);
    
    // Maintain bounded cache (max 300 candles per pair)
    if (symbolCache.length > MAX_CANDLES_CACHE) {
      symbolCache.shift();
    }

    console.log(`📊 Cache size for ${symbol}: ${symbolCache.length} candles`);

    // Calculate all indicators for this pair
    const indicators = this.calculateAllIndicators(symbolCache);

    // Emit indicators_updated event with pair symbol included
    console.log('📤 Sending indicators:', {
      symbol,
      emaSeries: indicators.ema.series?.length,
      vwapSeries: indicators.vwap.series?.length,
      emaValue: indicators.ema.value,
      vwapValue: indicators.vwap.value,
    });
    this.eventBus.publish<IndicatorsUpdatedEvent>('indicators_updated', {
      symbol: symbol,
      indicators,
      timestamp: Date.now(),
    });

    // Skip signal generation for historical candles
    if (candle.isHistorical) {
      console.log(`⏳ Skipping signal check for historical candle on ${symbol}`);
      return;
    }

    // Check for signals and emit if found (with deduplication)
    const signal = this.checkForIndicators(symbol, indicators);
    if (signal && this.shouldEmitSignal(symbol, signal.pattern)) {
      console.log(`🚨 Signal detected: ${signal.pattern} (${signal.signal}) for ${symbol}`);
      this.eventBus.publish<SignalGenerated>('SignalGenerated', {
        symbol: symbol,
        action: signal.signal === 'bullish' ? 'BUY' : 'SELL',
        confidence: signal.confidence,
        strategy: signal.pattern,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Calculate all indicators from cache for a specific symbol
   */
  private calculateAllIndicators(candles: Candle[]): IndicatorValues {
    // Calculate EMA (needs at least 200 periods)
    let emaValue: number | null = null;
    let emaSeries: IndicatorSeries[] = [];
    if (candles.length >= this.ema.getPeriod()) {
      const emaValues = this.ema.calculate(candles);
      emaValue = emaValues[emaValues.length - 1] ?? null;
      // Build series with timestamps for chart rendering
      emaSeries = candles.slice(-emaValues.length).map((candle, index) => ({
        timestamp: candle.timestamp,
        value: emaValues[index]!,
      }));
    }

    // Calculate VWAP (works with any amount of data)
    let vwapValue: number | null = null;
    let vwapSeries: IndicatorSeries[] = [];
    if (candles.length > 0) {
      const vwapValues = this.vwap.calculateRolling(candles);
      vwapValue = vwapValues[vwapValues.length - 1] ?? null;
      // Build series with timestamps for chart rendering
      vwapSeries = candles.slice(-vwapValues.length).map((candle, index) => ({
        timestamp: candle.timestamp,
        value: vwapValues[index]!,
      }));
    }

    // Calculate RSI (needs at least 15 periods)
    let rsiValue: number | null = null;
    let rsiSignal: 'overbought' | 'oversold' | 'neutral' | null = null;
    if (candles.length >= this.rsi.getPeriod() + 1) {
      const rsiValues = this.rsi.calculate(candles);
      rsiValue = rsiValues[rsiValues.length - 1] ?? null;
      if (rsiValue !== null) {
        if (rsiValue > 70) rsiSignal = 'overbought';
        else if (rsiValue < 30) rsiSignal = 'oversold';
        else rsiSignal = 'neutral';
      }
    }

    // Calculate MACD (needs at least 35 periods)
    let macdResult: MACDResult = {
      macdLine: [],
      signalLine: [],
      histogram: [],
      crossovers: [],
    };
    if (candles.length >= this.macd.getSlowPeriod() + this.macd.getSignalPeriod()) {
      macdResult = this.macd.calculate(candles);
    }

    // Calculate ATR (needs candles with OHLC data)
    let atrValue: number | null = null;
    if (candles.length >= this.atr.getPeriod()) {
      const atrValues = this.atr.calculate(candles);
      atrValue = atrValues[atrValues.length - 1] ?? null;
    }

    // Scan for candlestick patterns
    let patterns: Array<{
      pattern: string;
      type: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      timestamp: number;
      index: number;
    }> = [];
    if (candles.length >= 2) {
      patterns = CandlestickPatterns.scan(candles);
    }

    return {
      ema: {
        value: emaValue,
        series: emaSeries,
        period: this.ema.getPeriod(),
      },
      vwap: {
        value: vwapValue,
        series: vwapSeries,
        period: this.vwap.getPeriod(),
      },
      rsi: {
        value: rsiValue,
        signal: rsiSignal,
        period: this.rsi.getPeriod(),
      },
      macd: {
        macd: macdResult.macdLine[macdResult.macdLine.length - 1] ?? null,
        signal: macdResult.signalLine[macdResult.signalLine.length - 1] ?? null,
        histogram: macdResult.histogram[macdResult.histogram.length - 1] ?? null,
        crossovers: macdResult.crossovers,
      },
      atr: {
        value: atrValue,
        period: this.atr.getPeriod(),
      },
      candlestick: {
        patterns,
      },
    };
  }

  /**
   * Check if we should emit a signal for this symbol+pattern combination
   * Prevents spam by enforcing a cooldown period between identical signals
   */
  private shouldEmitSignal(symbol: string, pattern: string): boolean {
    const key = `${symbol}-${pattern}`;
    const lastEmitted = this.recentSignals.get(key);
    const now = Date.now();
    
    if (lastEmitted && now - lastEmitted < this.SIGNAL_COOLDOWN_MS) {
      console.log(`⏳ Signal cooldown active for ${key} (${Math.round((this.SIGNAL_COOLDOWN_MS - (now - lastEmitted)) / 1000)}s remaining)`);
      return false;
    }
    
    this.recentSignals.set(key, now);
    return true;
  }

  /**
   * Check for trading signals based on patterns and indicators
   * Filters signals according to market regime per pair (Multi-Timeframe Analysis)
   */
  private checkForIndicators(symbol: string, indicators: IndicatorValues): {
    signal: 'bullish' | 'bearish';
    pattern: string;
    confidence: number;
  } | null {
    // Get regime for this specific pair
    const currentRegime = this.currentRegimes.get(symbol);
    
    // Don't emit signals until we have a calculated regime for this pair
    if (!currentRegime) {
      const cacheSize = this.candlesCache.get(symbol)?.length || 0;
      console.log(`⏳ Signal detection paused for ${symbol} - waiting for market regime calculation (${cacheSize}/300 candles)`);
      return null; // Skip signal emission
    }

    // Check for recent patterns from candlestick scanner
    const patterns = indicators.candlestick.patterns;

    if (patterns.length === 0) {
      return null;
    }

    // Get the most recent pattern
    const recentPattern = patterns[patterns.length - 1];

    // Only return signals for high-confidence patterns
    if (recentPattern.confidence >= 0.5) {
      const isBullish = recentPattern.type === 'bullish';
      const isBearish = recentPattern.type === 'bearish';

      // Apply Market Regime Filter (MTF Strategy)
      if (currentRegime.regime === 'RANGING') {
        console.log(`🚫 Signal filtered for ${symbol} - market ranging (${recentPattern.pattern})`);
        return null;
      }

      if (isBullish && currentRegime.regime !== 'TRENDING_UP') {
        console.log(`🚫 BUY signal filtered for ${symbol} - not aligned with trend (regime: ${currentRegime.regime})`);
        return null;
      }

      if (isBearish && currentRegime.regime !== 'TRENDING_DOWN') {
        console.log(`🚫 SELL signal filtered for ${symbol} - not aligned with trend (regime: ${currentRegime.regime})`);
        return null;
      }

      console.log(`✅ Signal aligned with trend for ${symbol} (${currentRegime.regime}): ${recentPattern.pattern}`);

      if (isBullish) {
        return {
          signal: 'bullish',
          pattern: recentPattern.pattern,
          confidence: recentPattern.confidence,
        };
      } else if (isBearish) {
        return {
          signal: 'bearish',
          pattern: recentPattern.pattern,
          confidence: recentPattern.confidence,
        };
      }
    }

    return null;
  }
}