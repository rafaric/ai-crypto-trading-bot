import { Candle } from '../../../shared/src/events';

/**
 * Calculates Relative Strength Index (RSI)
 * Formula: RSI = 100 - (100 / (1 + RS))
 * where RS = Average Gain / Average Loss
 * 
 * Standard period: 14
 * RSI > 70: Overbought
 * RSI < 30: Oversold
 */
export class RSI {
  private period: number;
  private previousValue: number | null = null;
  private avgGain: number = 0;
  private avgLoss: number = 0;
  private initialized: boolean = false;

  constructor(period: number = 14) {
    this.period = period;
  }

  /**
   * Initialize RSI with historical data using Wilder's smoothing
   */
  initialize(closes: number[]): number {
    if (closes.length < this.period + 1) {
      throw new Error(`Need at least ${this.period + 1} closes to initialize RSI. Got ${closes.length}`);
    }

    // Calculate initial averages
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= this.period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    this.avgGain = gains / this.period;
    this.avgLoss = losses / this.period;
    this.previousValue = closes[closes.length - 1];
    this.initialized = true;

    return this.calculateRSI();
  }

  /**
   * Update RSI with a new price using Wilder's smoothing
   */
  update(price: number): number {
    if (!this.initialized) {
      throw new Error('RSI not initialized. Call initialize() first with historical data.');
    }

    const change = price - this.previousValue!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    // Wilder's smoothing
    this.avgGain = ((this.avgGain * (this.period - 1)) + gain) / this.period;
    this.avgLoss = ((this.avgLoss * (this.period - 1)) + loss) / this.period;
    this.previousValue = price;

    return this.calculateRSI();
  }

  /**
   * Calculate RSI from an array of candles
   * Returns array of RSI values (null for first N periods)
   */
  calculate(candles: Candle[]): (number | null)[] {
    if (candles.length < this.period + 1) {
      return new Array(candles.length).fill(null);
    }

    const closes = candles.map(c => c.close);
    const result: (number | null)[] = new Array(this.period).fill(null);

    // Initialize
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= this.period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    let avgGain = gains / this.period;
    let avgLoss = losses / this.period;

    result.push(this.computeRSI(avgGain, avgLoss));

    // Calculate subsequent RSI values
    for (let i = this.period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      // Wilder's smoothing
      avgGain = ((avgGain * (this.period - 1)) + gain) / this.period;
      avgLoss = ((avgLoss * (this.period - 1)) + loss) / this.period;

      result.push(this.computeRSI(avgGain, avgLoss));
    }

    return result;
  }

  private calculateRSI(): number {
    return this.computeRSI(this.avgGain, this.avgLoss);
  }

  private computeRSI(avgGain: number, avgLoss: number): number {
    if (avgLoss === 0) {
      return 100; // All gains, no losses
    }

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  getPeriod(): number {
    return this.period;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentRSI(): number | null {
    if (!this.initialized) {
      return null;
    }
    return this.calculateRSI();
  }

  /**
   * Get RSI interpretation
   */
  getSignal(): 'overbought' | 'oversold' | 'neutral' | null {
    const rsi = this.getCurrentRSI();
    if (rsi === null) return null;
    
    if (rsi > 70) return 'overbought';
    if (rsi < 30) return 'oversold';
    return 'neutral';
  }
}