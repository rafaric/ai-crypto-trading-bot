import { Candle } from '../../../shared/src/events';

/**
 * Calculates Exponential Moving Average (EMA)
 * Formula: EMA = Close(t) × k + EMA(y) × (1 − k)
 * where k = 2/(N+1)
 */
export class EMA {
  private period: number;
  private multiplier: number;
  private previousEMA: number | null = null;
  private initialized: boolean = false;

  constructor(period: number = 200) {
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }

  /**
   * Initialize EMA with SMA (Simple Moving Average) of first N periods
   */
  initialize(closes: number[]): number {
    if (closes.length < this.period) {
      throw new Error(`Need at least ${this.period} closes to initialize EMA. Got ${closes.length}`);
    }

    const sma = closes.slice(0, this.period).reduce((sum, close) => sum + close, 0) / this.period;
    this.previousEMA = sma;
    this.initialized = true;
    return sma;
  }

  /**
   * Update EMA with a new close price
   */
  update(close: number): number {
    if (!this.initialized) {
      throw new Error('EMA not initialized. Call initialize() first with historical data.');
    }

    const ema = close * this.multiplier + this.previousEMA! * (1 - this.multiplier);
    this.previousEMA = ema;
    return ema;
  }

  /**
   * Calculate EMA from an array of candles
   * Returns array of EMA values aligned with input (null for first N-1 periods)
   */
  calculate(candles: Candle[]): (number | null)[] {
    if (candles.length < this.period) {
      return new Array(candles.length).fill(null);
    }

    const closes = candles.map(c => c.close);
    const result: (number | null)[] = new Array(this.period - 1).fill(null);

    // Initialize with SMA
    let ema = closes.slice(0, this.period).reduce((sum, close) => sum + close, 0) / this.period;
    result.push(ema);

    // Calculate subsequent EMAs
    for (let i = this.period; i < closes.length; i++) {
      ema = closes[i] * this.multiplier + ema * (1 - this.multiplier);
      result.push(ema);
    }

    return result;
  }

  getPeriod(): number {
    return this.period;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentValue(): number | null {
    return this.previousEMA;
  }
}