import { Candle } from '../../../shared/src/events';

/**
 * Calculates Volume Weighted Average Price (VWAP)
 * Formula: VWAP = Σ(TypicalPrice × Volume) / Σ(Volume)
 * Typical Price = (High + Low + Close) / 3
 * 
 * VWAP is cumulative during a trading session.
 * For crypto 24/7, we calculate it over a rolling window of N periods
 */
export class VWAP {
  private period: number;
  private cumulativeTypicalPriceVolume: number = 0;
  private cumulativeVolume: number = 0;
  private values: number[] = [];

  constructor(period: number = 14) {
    this.period = period;
  }

  /**
   * Calculate typical price for a candle
   * Typical Price = (High + Low + Close) / 3
   */
  private calculateTypicalPrice(candle: Candle): number {
    return (candle.high + candle.low + candle.close) / 3;
  }

  /**
   * Calculate VWAP from an array of candles
   * Returns array of VWAP values (null for first period where volume is 0)
   */
  calculate(candles: Candle[]): (number | null)[] {
    if (candles.length === 0) {
      return [];
    }

    const result: (number | null)[] = [];
    let sumTypicalPriceVolume = 0;
    let sumVolume = 0;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const typicalPrice = this.calculateTypicalPrice(candle);
      
      sumTypicalPriceVolume += typicalPrice * candle.volume;
      sumVolume += candle.volume;

      if (sumVolume === 0) {
        result.push(null);
      } else {
        const vwap = sumTypicalPriceVolume / sumVolume;
        result.push(vwap);
      }
    }

    return result;
  }

  /**
   * Calculate rolling VWAP over a window
   * Only considers last N periods for calculation
   */
  calculateRolling(candles: Candle[]): (number | null)[] {
    if (candles.length === 0) {
      return [];
    }

    const result: (number | null)[] = [];

    for (let i = 0; i < candles.length; i++) {
      const windowStart = Math.max(0, i - this.period + 1);
      const window = candles.slice(windowStart, i + 1);
      
      let sumTypicalPriceVolume = 0;
      let sumVolume = 0;

      for (const candle of window) {
        const typicalPrice = this.calculateTypicalPrice(candle);
        sumTypicalPriceVolume += typicalPrice * candle.volume;
        sumVolume += candle.volume;
      }

      if (sumVolume === 0) {
        result.push(null);
      } else {
        result.push(sumTypicalPriceVolume / sumVolume);
      }
    }

    return result;
  }

  /**
   * Update VWAP with a new candle (cumulative calculation)
   */
  update(candle: Candle): number {
    const typicalPrice = this.calculateTypicalPrice(candle);
    
    this.cumulativeTypicalPriceVolume += typicalPrice * candle.volume;
    this.cumulativeVolume += candle.volume;
    this.values.push(this.cumulativeTypicalPriceVolume / this.cumulativeVolume);
    
    // Keep only last N values for rolling calculation
    if (this.values.length > this.period) {
      this.values.shift();
    }

    return this.getCurrentValue()!;
  }

  /**
   * Get current VWAP value
   */
  getCurrentValue(): number | null {
    if (this.cumulativeVolume === 0) {
      return null;
    }
    return this.cumulativeTypicalPriceVolume / this.cumulativeVolume;
  }

  /**
   * Reset cumulative calculation
   */
  reset(): void {
    this.cumulativeTypicalPriceVolume = 0;
    this.cumulativeVolume = 0;
    this.values = [];
  }

  getPeriod(): number {
    return this.period;
  }
}
