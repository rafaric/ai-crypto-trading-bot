export interface MarketTick {
    symbol: string;
    price: number;
    timestamp: number;
    volume: number;
}
export interface SignalGenerated {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    timestamp: number;
}
