import { EventBus } from '../core/EventBus';
import { Candle, SignalGenerated } from '../../../shared/src/events';
import { EMA } from '../indicators/EMA';
import { VWAP } from '../indicators/VWAP';
import { RSI } from '../indicators/RSI';
import { MACD, MACDResult } from '../indicators/MACD';
import { ATR } from '../indicators/ATR';
import { CandlestickPatterns } from '../indicators/CandlestickPatterns';

export interface IndicatorValues {
  ema: {
    value: number | null;
    period: number;
  };
  vwap: {
    value: number | null;
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
  private candlesCache: Candle[] = [];
  private unsubscribeFn: (() => void) | null = null;
  
  // Indicators
  private ema: EMA;
  private vwap: VWAP;
  private rsi: RSI;
  private macd: MACD;
  private atr: ATR;
  
  // Signal deduplication - track recently emitted signals to prevent spam
  private recentSignals: Map<string, number> = new Map();
  private readonly SIGNAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

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
   * Get current candles cache
   */
  public getCandlesCache(): Candle[] {
    return [...this.candlesCache];
  }

  /**
   * Handle candle_closed event
   */
  private handleCandleClosed(candle: Candle): void {
    console.log(`🕯️ Processing candle: ${candle.symbol} @ $${candle.close.toFixed(2)}`);
    
    // Add candle to cache
    this.candlesCache.push(candle);
    
    // Maintain bounded cache (max 300 candles)
    if (this.candlesCache.length > MAX_CANDLES_CACHE) {
      this.candlesCache.shift();
    }

    console.log(`📊 Cache size: ${this.candlesCache.length} candles`);

    // Calculate all indicators
    const indicators = this.calculateAllIndicators();

    // Emit indicators_updated event
    this.eventBus.publish<IndicatorsUpdatedEvent>('indicators_updated', {
      symbol: candle.symbol,
      indicators,
      timestamp: Date.now(),
    });

    // Skip signal generation for historical candles
    if (candle.isHistorical) {
      console.log(`⏳ Skipping signal check for historical candle`);
      return;
    }

    // Check for signals and emit if found (with deduplication)
    const signal = this.checkForSignals(indicators);
    if (signal && this.shouldEmitSignal(candle.symbol, signal.pattern)) {
      console.log(`🚨 Signal detected: ${signal.pattern} (${signal.signal}) for ${candle.symbol}`);
      this.eventBus.publish<SignalGenerated>('SignalGenerated', {
        symbol: candle.symbol,
        action: signal.signal === 'bullish' ? 'BUY' : 'SELL',
        confidence: signal.confidence,
        strategy: signal.pattern,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Calculate all indicators from current cache
   */
  private calculateAllIndicators(): IndicatorValues {
    const candles = this.candlesCache;

    // Calculate EMA (needs at least 200 periods)
    let emaValue: number | null = null;
    if (candles.length >= this.ema.getPeriod()) {
      const emaValues = this.ema.calculate(candles);
      emaValue = emaValues[emaValues.length - 1] ?? null;
    }

    // Calculate VWAP (works with any amount of data)
    let vwapValue: number | null = null;
    if (candles.length > 0) {
      const vwapValues = this.vwap.calculateRolling(candles);
      vwapValue = vwapValues[vwapValues.length - 1] ?? null;
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
        period: this.ema.getPeriod(),
      },
      vwap: {
        value: vwapValue,
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
   */
  private checkForSignals(indicators: IndicatorValues): { 
    signal: 'bullish' | 'bearish'; 
    pattern: string; 
    confidence: number;
  } | null {
    // Check for recent patterns from candlestick scanner
    const patterns = indicators.candlestick.patterns;
    
    if (patterns.length === 0) {
      return null;
    }

    // Get the most recent pattern
    const recentPattern = patterns[patterns.length - 1];
    
    // Only return signals for high-confidence patterns
    if (recentPattern.confidence >= 0.5) {
      if (recentPattern.type === 'bullish') {
        return {
          signal: 'bullish',
          pattern: recentPattern.pattern,
          confidence: recentPattern.confidence,
        };
      } else if (recentPattern.type === 'bearish') {
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
