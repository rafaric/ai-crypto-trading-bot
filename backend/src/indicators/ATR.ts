import { Candle } from './CandlestickPatterns';

/**
 * Calculates Average True Range (ATR)
 * 
 * True Range = max(high-low, |high-previous_close|, |low-previous_close|)
 * ATR = Wilder's smoothing of True Range over N periods
 * 
 * Standard period: 14
 * Used for: volatility measurement, stop loss placement
 */
export class ATR {
  private period: number;
  private currentATR: number | null = null;
  private initialized: boolean = false;
  private previousClose: number | null = null;

  constructor(period: number = 14) {
    this.period = period;
  }

  /**
   * Calculate True Range for a single candle
   * TR = max(high-low, |high-prevClose|, |low-prevClose|)
   */
  calculateTrueRange(candle: Candle, prevClose: number | null): number {
    const highLow = candle.high - candle.low;
    
    if (prevClose === null) {
      // First candle: TR = high - low
      return highLow;
    }
    
    const highPrevClose = Math.abs(candle.high - prevClose);
    const lowPrevClose = Math.abs(candle.low - prevClose);
    
    return Math.max(highLow, highPrevClose, lowPrevClose);
  }

  /**
   * Initialize ATR with historical candles using Wilder's smoothing
   */
  initialize(candles: Candle[]): void {
    if (candles.length < this.period) {
      throw new Error(`Need at least ${this.period} candles to initialize ATR. Got ${candles.length}`);
    }

    // Calculate True Range for each candle
    const trueRanges: number[] = [];
    let prevClose: number | null = null;

    for (const candle of candles) {
      const tr = this.calculateTrueRange(candle, prevClose);
      trueRanges.push(tr);
      prevClose = candle.close;
    }

    // First ATR is simple average of first N periods
    let atr = trueRanges.slice(0, this.period).reduce((sum, tr) => sum + tr, 0) / this.period;
    
    // Apply Wilder's smoothing for subsequent periods
    for (let i = this.period; i < trueRanges.length; i++) {
      atr = ((atr * (this.period - 1)) + trueRanges[i]) / this.period;
    }

    this.currentATR = atr;
    this.previousClose = candles[candles.length - 1].close;
    this.initialized = true;
  }

  /**
   * Update ATR with a new candle using Wilder's smoothing
   */
  update(candle: Candle): number {
    if (!this.initialized) {
      throw new Error('ATR not initialized. Call initialize() first with historical data.');
    }

    const tr = this.calculateTrueRange(candle, this.previousClose);
    
    // Wilder's smoothing: ATR = ((ATR_prev * (N-1)) + TR) / N
    this.currentATR = ((this.currentATR! * (this.period - 1)) + tr) / this.period;
    this.previousClose = candle.close;

    return this.currentATR;
  }

  /**
   * Calculate ATR from an array of candles
   * Returns array of ATR values (null for first N-1 periods)
   */
  calculate(candles: Candle[]): (number | null)[] {
    if (candles.length < this.period) {
      return new Array(candles.length).fill(null);
    }

    const result: (number | null)[] = [];
    const trueRanges: number[] = [];
    let prevClose: number | null = null;

    // Calculate all True Ranges
    for (const candle of candles) {
      const tr = this.calculateTrueRange(candle, prevClose);
      trueRanges.push(tr);
      prevClose = candle.close;
    }

    // First ATR is simple average of first N periods
    let atr = trueRanges.slice(0, this.period).reduce((sum, tr) => sum + tr, 0) / this.period;
    
    // Fill nulls for first N-1 periods
    for (let i = 0; i < this.period - 1; i++) {
      result.push(null);
    }
    
    // First ATR value
    result.push(atr);

    // Apply Wilder's smoothing for subsequent periods
    for (let i = this.period; i < trueRanges.length; i++) {
      atr = ((atr * (this.period - 1)) + trueRanges[i]) / this.period;
      result.push(atr);
    }

    return result;
  }

  /**
   * Calculate stop loss price based on ATR
   * @param entryPrice - Entry price of the trade
   * @param position - 'long' or 'short'
   * @param multiplier - ATR multiplier (default: 2)
   * @returns Stop loss price
   */
  calculateStopLoss(entryPrice: number, position: 'long' | 'short', multiplier: number = 2): number {
    if (!this.initialized || this.currentATR === null) {
      throw new Error('ATR not initialized. Call initialize() first with historical data.');
    }

    const stopDistance = this.currentATR * multiplier;

    if (position === 'long') {
      return entryPrice - stopDistance;
    } else {
      return entryPrice + stopDistance;
    }
  }

  /**
   * Calculate take profit price based on risk:reward ratio
   * @param entryPrice - Entry price of the trade
   * @param stopLoss - Stop loss price
   * @param position - 'long' or 'short'
   * @param riskRewardRatio - Risk to reward ratio (default: 2)
   * @returns Take profit price
   */
  calculateTakeProfit(entryPrice: number, stopLoss: number, position: 'long' | 'short', riskRewardRatio: number = 2): number {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = risk * riskRewardRatio;

    if (position === 'long') {
      return entryPrice + reward;
    } else {
      return entryPrice - reward;
    }
  }

  getPeriod(): number {
    return this.period;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentATR(): number | null {
    return this.currentATR;
  }
}
