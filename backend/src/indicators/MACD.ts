import { MarketTick } from '../../../shared/src/events';
import { EMA } from './EMA';

export interface MACDResult {
  macdLine: (number | null)[];
  signalLine: (number | null)[];
  histogram: (number | null)[];
  crossovers: Array<{
    type: 'bullish' | 'bearish';
    index: number;
    timestamp: number;
  }>;
}

export interface MACDUpdateResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover?: 'bullish' | 'bearish';
}

/**
 * Calculates Moving Average Convergence Divergence (MACD)
 * Formula:
 *   MACD Line = Fast EMA - Slow EMA
 *   Signal Line = EMA of MACD Line (usually 9 periods)
 *   Histogram = MACD Line - Signal Line
 * 
 * Standard periods: Fast=12, Slow=26, Signal=9
 */
export class MACD {
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;
  private fastEMA: EMA;
  private slowEMA: EMA;
  private signalEMA: EMA | null = null;
  private initialized: boolean = false;
  private macdHistory: number[] = [];
  private previousHistogram: number | null = null;

  constructor(fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    if (fastPeriod >= slowPeriod) {
      throw new Error('Fast period must be less than slow period');
    }
    this.fastPeriod = fastPeriod;
    this.slowPeriod = slowPeriod;
    this.signalPeriod = signalPeriod;
    this.fastEMA = new EMA(fastPeriod);
    this.slowEMA = new EMA(slowPeriod);
  }

  /**
   * Initialize MACD with historical ticks
   * Need at least slowPeriod + signalPeriod ticks
   */
  initialize(ticks: MarketTick[]): void {
    const minRequired = this.slowPeriod + this.signalPeriod;
    if (ticks.length < minRequired) {
      throw new Error(`Need at least ${minRequired} ticks to initialize MACD. Got ${ticks.length}`);
    }

    const closes = ticks.map(t => t.price);
    
    // Initialize both EMAs
    this.fastEMA.initialize(closes);
    this.slowEMA.initialize(closes);
    
    // Calculate MACD line for all ticks
    this.macdHistory = [];
    const fastValues = this.fastEMA.calculate(ticks);
    const slowValues = this.slowEMA.calculate(ticks);
    
    for (let i = 0; i < ticks.length; i++) {
      if (fastValues[i] !== null && slowValues[i] !== null) {
        this.macdHistory.push(fastValues[i]! - slowValues[i]!);
      }
    }

    // Initialize Signal EMA with MACD values
    this.signalEMA = new EMA(this.signalPeriod);
    this.signalEMA.initialize(this.macdHistory);
    
    // Store last histogram for crossover detection
    const lastSignal = this.signalEMA.getCurrentValue();
    if (lastSignal !== null && this.macdHistory.length > 0) {
      this.previousHistogram = this.macdHistory[this.macdHistory.length - 1] - lastSignal;
    }
    
    this.initialized = true;
  }

  /**
   * Update MACD with a new tick
   */
  update(tick: MarketTick): MACDUpdateResult {
    if (!this.initialized) {
      throw new Error('MACD not initialized. Call initialize() first with historical data.');
    }

    const price = tick.price;
    
    // Update both EMAs
    const fastValue = this.fastEMA.update(price);
    const slowValue = this.slowEMA.update(price);
    
    // Calculate new MACD value
    const macd = fastValue - slowValue;
    this.macdHistory.push(macd);
    
    // Update Signal EMA
    const signal = this.signalEMA!.update(macd);
    
    // Calculate histogram
    const histogram = macd - signal;
    
    // Detect crossover
    let crossover: 'bullish' | 'bearish' | undefined;
    if (this.previousHistogram !== null) {
      if (this.previousHistogram < 0 && histogram > 0) {
        crossover = 'bullish';
      } else if (this.previousHistogram > 0 && histogram < 0) {
        crossover = 'bearish';
      }
    }
    
    this.previousHistogram = histogram;
    
    return { macd, signal, histogram, crossover };
  }

  /**
   * Calculate MACD from an array of ticks
   */
  calculate(ticks: MarketTick[]): MACDResult {
    const minRequired = this.slowPeriod + this.signalPeriod;
    
    if (ticks.length < minRequired) {
      return {
        macdLine: new Array(ticks.length).fill(null),
        signalLine: new Array(ticks.length).fill(null),
        histogram: new Array(ticks.length).fill(null),
        crossovers: []
      };
    }

    // Calculate Fast and Slow EMAs
    const fastValues = this.fastEMA.calculate(ticks);
    const slowValues = this.slowEMA.calculate(ticks);
    
    // Calculate MACD line
    const macdLine: (number | null)[] = [];
    for (let i = 0; i < ticks.length; i++) {
      if (fastValues[i] !== null && slowValues[i] !== null) {
        macdLine.push(fastValues[i]! - slowValues[i]!);
      } else {
        macdLine.push(null);
      }
    }

    // Calculate Signal line (EMA of MACD)
    const signalLine: (number | null)[] = new Array(ticks.length).fill(null);
    const validMacdValues: number[] = [];
    const validIndices: number[] = [];
    
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] !== null) {
        validMacdValues.push(macdLine[i]!);
        validIndices.push(i);
      }
    }

    if (validMacdValues.length >= this.signalPeriod) {
      const signalEMA = new EMA(this.signalPeriod);
      const signalValues = signalEMA.calculate(
        validMacdValues.map((v, i) => ({
          symbol: 'TEMP',
          price: v,
          timestamp: i,
          volume: 1
        }))
      );
      
      // Map signal values back to original indices
      for (let i = 0; i < signalValues.length; i++) {
        if (signalValues[i] !== null) {
          signalLine[validIndices[i]] = signalValues[i];
        }
      }
    }

    // Calculate histogram
    const histogram: (number | null)[] = [];
    for (let i = 0; i < ticks.length; i++) {
      if (macdLine[i] !== null && signalLine[i] !== null) {
        histogram.push(macdLine[i]! - signalLine[i]!);
      } else {
        histogram.push(null);
      }
    }

    // Detect crossovers
    const crossovers: Array<{ type: 'bullish' | 'bearish'; index: number; timestamp: number }> = [];
    for (let i = 1; i < histogram.length; i++) {
      if (histogram[i - 1] !== null && histogram[i] !== null) {
        if (histogram[i - 1]! < 0 && histogram[i]! > 0) {
          crossovers.push({
            type: 'bullish',
            index: i,
            timestamp: ticks[i].timestamp
          });
        } else if (histogram[i - 1]! > 0 && histogram[i]! < 0) {
          crossovers.push({
            type: 'bearish',
            index: i,
            timestamp: ticks[i].timestamp
          });
        }
      }
    }

    return { macdLine, signalLine, histogram, crossovers };
  }

  getFastPeriod(): number {
    return this.fastPeriod;
  }

  getSlowPeriod(): number {
    return this.slowPeriod;
  }

  getSignalPeriod(): number {
    return this.signalPeriod;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getCurrentMACD(): number | null {
    if (!this.initialized || this.macdHistory.length === 0) {
      return null;
    }
    return this.macdHistory[this.macdHistory.length - 1];
  }

  getCurrentSignal(): number | null {
    if (!this.initialized || !this.signalEMA) {
      return null;
    }
    return this.signalEMA.getCurrentValue();
  }

  getCurrentHistogram(): number | null {
    const macd = this.getCurrentMACD();
    const signal = this.getCurrentSignal();
    if (macd === null || signal === null) {
      return null;
    }
    return macd - signal;
  }
}
