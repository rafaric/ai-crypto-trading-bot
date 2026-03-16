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

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'OPEN' | 'CLOSED';
  pnl?: number;
  pnlPercent?: number;
  result?: 'WIN' | 'LOSS';
  openTime: number;
  closeTime?: number;
}

export interface AccountSummary {
  initialBalance: number;
  currentBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}
