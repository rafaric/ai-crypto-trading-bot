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
}

export interface SignalGenerated {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  strategy?: string;
  timestamp: number;
}

// Deprecated: Use Candle instead
export type MarketTick = Candle;
