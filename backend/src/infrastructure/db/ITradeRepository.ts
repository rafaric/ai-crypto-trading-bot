// Dummy structure for testing

export interface Trade {
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  simulated: boolean;
}

export interface ITradeRepository {
  saveTrade(trade: Trade): Promise<void>;
}
