import { Candle } from '../../../shared/src/events';

/**
 * Detects candlestick patterns for trading signals
 * All patterns return confidence score (0.0 to 1.0) based on pattern quality
 */
export class CandlestickPatterns {

  /**
   * Bullish Engulfing Pattern
   * Current green candle completely engulfs previous red candle
   * Strong reversal signal at support levels
   */
  static isBullishEngulfing(prev: Candle, curr: Candle): { detected: boolean; confidence: number } {
    // Previous candle must be bearish (red)
    const prevIsRed = prev.close < prev.open;
    
    // Current candle must be bullish (green)
    const currIsGreen = curr.close > curr.open;
    
    // Current candle must engulf previous
    const engulfs = curr.open < prev.close && curr.close > prev.open;
    
    if (!prevIsRed || !currIsGreen || !engulfs) {
      return { detected: false, confidence: 0 };
    }
    
    // Calculate confidence based on engulfing strength
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);
    const engulfingRatio = currBody / prevBody;
    
    // Higher ratio = stronger signal (cap at 2.0 for max confidence)
    const confidence = Math.min(engulfingRatio / 2, 1.0);
    
    return { detected: true, confidence };
  }

  /**
   * Bearish Engulfing Pattern
   * Current red candle completely engulfs previous green candle
   * Strong reversal signal at resistance levels
   */
  static isBearishEngulfing(prev: Candle, curr: Candle): { detected: boolean; confidence: number } {
    // Previous candle must be bullish (green)
    const prevIsGreen = prev.close > prev.open;
    
    // Current candle must be bearish (red)
    const currIsRed = curr.close < curr.open;
    
    // Current candle must engulf previous
    const engulfs = curr.open > prev.close && curr.close < prev.open;
    
    if (!prevIsGreen || !currIsRed || !engulfs) {
      return { detected: false, confidence: 0 };
    }
    
    // Calculate confidence based on engulfing strength
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);
    const engulfingRatio = currBody / prevBody;
    
    const confidence = Math.min(engulfingRatio / 2, 1.0);
    
    return { detected: true, confidence };
  }

  /**
   * Pin Bar (Hammer or Shooting Star)
   * Small body with long wick indicating rejection
   * Bullish: Long lower wick (Hammer) - rejection of lower prices
   * Bearish: Long upper wick (Shooting Star) - rejection of higher prices
   */
  static isPinBar(candle: Candle): { 
    detected: boolean; 
    type: 'bullish' | 'bearish' | null; 
    confidence: number 
  } {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    
    // Must have visible range
    if (totalRange === 0) {
      return { detected: false, type: null, confidence: 0 };
    }
    
    // Body should be small relative to range (less than 30%)
    const bodyRatio = bodySize / totalRange;
    if (bodyRatio > 0.3) {
      return { detected: false, type: null, confidence: 0 };
    }
    
    const isBullish = candle.close > candle.open;
    
    if (isBullish) {
      // Bullish pin bar: long lower wick
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      
      // Lower wick should be at least 2x the body and longer than upper wick
      if (lowerWick >= bodySize * 2 && lowerWick > upperWick) {
        const wickRatio = lowerWick / bodySize;
        const confidence = Math.min(wickRatio / 4, 1.0); // Cap at 4x body
        return { detected: true, type: 'bullish', confidence };
      }
    } else {
      // Bearish pin bar: long upper wick
      const upperWick = candle.high - Math.max(candle.open, candle.close);
      const lowerWick = Math.min(candle.open, candle.close) - candle.low;
      
      // Upper wick should be at least 2x the body and longer than lower wick
      if (upperWick >= bodySize * 2 && upperWick > lowerWick) {
        const wickRatio = upperWick / bodySize;
        const confidence = Math.min(wickRatio / 4, 1.0);
        return { detected: true, type: 'bearish', confidence };
      }
    }
    
    return { detected: false, type: null, confidence: 0 };
  }

  /**
   * Doji Pattern
   * Open and close are very close together indicating indecision
   * Can signal reversal or continuation depending on context
   */
  static isDoji(candle: Candle, threshold: number = 0.1): { 
    detected: boolean; 
    confidence: number 
  } {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    
    if (totalRange === 0) {
      return { detected: false, confidence: 0 };
    }
    
    // Body should be very small (less than threshold % of range)
    const bodyRatio = bodySize / totalRange;
    
    if (bodyRatio > threshold) {
      return { detected: false, confidence: 0 };
    }
    
    // Confidence increases as body gets smaller
    const confidence = 1.0 - (bodyRatio / threshold);
    
    return { detected: true, confidence };
  }

  /**
   * Scan multiple candles for patterns
   * Returns array of detected patterns with timestamps
   */
  static scan(candles: Candle[]): Array<{
    pattern: string;
    type: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    timestamp: number;
    index: number;
  }> {
    const patterns: Array<{
      pattern: string;
      type: 'bullish' | 'bearish' | 'neutral';
      confidence: number;
      timestamp: number;
      index: number;
    }> = [];

    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];

      // Check engulfing patterns
      const bullishEngulfing = this.isBullishEngulfing(prev, curr);
      if (bullishEngulfing.detected) {
        patterns.push({
          pattern: 'Bullish Engulfing',
          type: 'bullish',
          confidence: bullishEngulfing.confidence,
          timestamp: curr.timestamp,
          index: i
        });
      }

      const bearishEngulfing = this.isBearishEngulfing(prev, curr);
      if (bearishEngulfing.detected) {
        patterns.push({
          pattern: 'Bearish Engulfing',
          type: 'bearish',
          confidence: bearishEngulfing.confidence,
          timestamp: curr.timestamp,
          index: i
        });
      }

      // Check pin bar on current candle
      const pinBar = this.isPinBar(curr);
      if (pinBar.detected) {
        patterns.push({
          pattern: pinBar.type === 'bullish' ? 'Hammer' : 'Shooting Star',
          type: pinBar.type!,
          confidence: pinBar.confidence,
          timestamp: curr.timestamp,
          index: i
        });
      }

      // Check doji on current candle
      const doji = this.isDoji(curr);
      if (doji.detected) {
        patterns.push({
          pattern: 'Doji',
          type: 'neutral',
          confidence: doji.confidence,
          timestamp: curr.timestamp,
          index: i
        });
      }
    }

    return patterns;
  }
}
