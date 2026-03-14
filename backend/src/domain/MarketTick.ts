export interface MarketTick {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
}
