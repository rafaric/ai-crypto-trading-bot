import { MarketTick } from '../../../shared/src/events';

/**
 * Calculates Volume Weighted Average Price (VWAP)
 * Formula: VWAP = Σ(Price × Volume) / Σ(Volume)
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
   * Calculate VWAP from an array of ticks
   * Returns array of VWAP values (null for first period where volume is 0)
   */
  calculate(ticks: MarketTick[]): (number | null)[] {
    if (ticks.length === 0) {
      return [];
    }

    const result: (number | null)[] = [];
    let sumTypicalPriceVolume = 0;
    let sumVolume = 0;

    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i];
      
      // Typical Price = (High + Low + Close) / 3
      // Since we only have close price in MarketTick, we use that
      const typicalPrice = tick.price;
      
      sumTypicalPriceVolume += typicalPrice * tick.volume;
      sumVolume += tick.volume;

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
  calculateRolling(ticks: MarketTick[]): (number | null)[] {
    if (ticks.length === 0) {
      return [];
    }

    const result: (number | null)[] = [];

    for (let i = 0; i < ticks.length; i++) {
      const windowStart = Math.max(0, i - this.period + 1);
      const window = ticks.slice(windowStart, i + 1);
      
      let sumTypicalPriceVolume = 0;
      let sumVolume = 0;

      for (const tick of window) {
        sumTypicalPriceVolume += tick.price * tick.volume;
        sumVolume += tick.volume;
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
   * Update VWAP with a new tick (cumulative calculation)
   */
  update(tick: MarketTick): number {
    const typicalPrice = tick.price;
    
    this.cumulativeTypicalPriceVolume += typicalPrice * tick.volume;
    this.cumulativeVolume += tick.volume;
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