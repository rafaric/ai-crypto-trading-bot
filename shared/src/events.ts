export interface Candle {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  volume: number;
  isClosed?: boolean;
  interval?: string;
  isHistorical?: boolean;
}

export interface IndicatorSeries {
  timestamp: number;
  value: number;
}

export interface SignalGenerated {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy?: string;
  timestamp: number;
}

export interface MarketRegime1HUpdated {
  symbol: string;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
  ema200: number;
  adx14: number;
  price: number;
}

// Deprecated: Use Candle instead
export type MarketTick = Candle;
