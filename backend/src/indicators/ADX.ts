import { Candle } from '../../../shared/src/events';

/**
 * Average Directional Index (ADX) - Mide la fuerza de la tendencia
 * ADX > 25: Tendencia fuerte
 * ADX < 25: Mercado en rango (sin tendencia)
 * 
 * Cálculo:
 * 1. Calculate True Range (TR)
 * 2. Calculate +DM and -DM
 * 3. Calculate +DI and -DI
 * 4. Calculate DX
 * 5. Calculate ADX (smoothed DX)
 */
export class ADX {
  private period: number;

  constructor(period: number = 14) {
    this.period = period;
  }

  getPeriod(): number {
    return this.period;
  }

  /**
   * Calculate ADX from an array of candles
   * Returns array of ADX values aligned with input (null for first N-1 periods)
   */
  calculate(candles: Candle[]): (number | null)[] {
    if (candles.length < this.period * 2) {
      return new Array(candles.length).fill(null);
    }

    const trValues: number[] = [];
    const plusDMValues: number[] = [];
    const minusDMValues: number[] = [];

    // Calculate TR, +DM, -DM for each candle
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];

      // True Range
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      trValues.push(Math.max(tr1, tr2, tr3));

      // +DM and -DM
      const upMove = current.high - previous.high;
      const downMove = previous.low - current.low;

      let plusDM = 0;
      let minusDM = 0;

      if (upMove > downMove && upMove > 0) {
        plusDM = upMove;
      }
      if (downMove > upMove && downMove > 0) {
        minusDM = downMove;
      }

      plusDMValues.push(plusDM);
      minusDMValues.push(minusDM);
    }

    // Calculate smoothed averages using Wilder's smoothing
    const atrValues = this.wilderSmooth(trValues, this.period);
    const plusDIValues = this.wilderSmooth(plusDMValues, this.period);
    const minusDIValues = this.wilderSmooth(minusDMValues, this.period);

    // Calculate DX
    const dxValues: (number | null)[] = [];
    for (let i = 0; i < atrValues.length; i++) {
      if (atrValues[i] === null || atrValues[i] === 0) {
        dxValues.push(null);
      } else {
        const plusDI = 100 * (plusDIValues[i]! / atrValues[i]!);
        const minusDI = 100 * (minusDIValues[i]! / atrValues[i]!);
        const diDiff = Math.abs(plusDI - minusDI);
        const diSum = plusDI + minusDI;
        
        if (diSum === 0) {
          dxValues.push(null);
        } else {
          dxValues.push(100 * (diDiff / diSum));
        }
      }
    }

    // Calculate ADX (smoothed DX)
    const adxValues: (number | null)[] = new Array(this.period - 1).fill(null);
    
    // First ADX is average of first N DX values
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.period && i < dxValues.length; i++) {
      if (dxValues[i] !== null) {
        sum += dxValues[i]!;
        count++;
      }
    }
    
    if (count > 0) {
      let adx = sum / count;
      adxValues.push(adx);

      // Subsequent ADX values using smoothing
      for (let i = this.period; i < dxValues.length; i++) {
        if (dxValues[i] !== null) {
          adx = ((adx * (this.period - 1)) + dxValues[i]!) / this.period;
          adxValues.push(adx);
        } else {
          adxValues.push(null);
        }
      }
    }

    // Pad with nulls at the beginning to align with input
    const padding = candles.length - adxValues.length;
    return [...new Array(padding).fill(null), ...adxValues];
  }

  /**
   * Wilder's smoothing method
   */
  private wilderSmooth(values: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    
    // Need at least 'period' values
    if (values.length < period) {
      return new Array(values.length).fill(null);
    }

    // First value is simple average
    const firstSum = values.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothed = firstSum / period;
    
    // Pad with nulls for the first period-1 values
    for (let i = 0; i < period - 1; i++) {
      result.push(null);
    }
    result.push(smoothed);

    // Apply Wilder's smoothing formula
    for (let i = period; i < values.length; i++) {
      smoothed = ((smoothed * (period - 1)) + values[i]) / period;
      result.push(smoothed);
    }

    return result;
  }
}
