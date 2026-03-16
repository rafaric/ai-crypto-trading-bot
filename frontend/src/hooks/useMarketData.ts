import { useState, useEffect, useRef } from 'react';
import type { Candle, SignalGenerated } from '../../../shared/src/events';

export const TRADING_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
export type TradingPair = (typeof TRADING_PAIRS)[number];

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

export interface IndicatorSeries {
  timestamp: number;
  value: number;
}

export interface IndicatorData {
  ema: { value: number | null; series: IndicatorSeries[]; period: number };
  vwap: { value: number | null; series: IndicatorSeries[]; period: number };
  rsi: { value: number | null; signal: string | null; period: number };
  macd: { macd: number | null; signal: number | null; histogram: number | null };
  atr: { value: number | null; period: number };
  candlestick: { patterns: Array<{ pattern: string; type: string; confidence: number }> };
}

export interface IndicatorsUpdate {
  symbol: string;
  indicators: IndicatorData;
  timestamp: number;
}

export interface MarketRegime {
  symbol: string;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
}

export interface PairData {
  symbol: TradingPair;
  ticks: Candle[];
  indicators: IndicatorsUpdate | null;
  regime: MarketRegime | null;
  currentPrice: number | null;
  change24h: number | null;
}

export interface UseMarketDataReturn {
  // All pairs data
  allPairs: Map<string, PairData>;
  // Currently selected pair
  selectedPair: TradingPair;
  setSelectedPair: (pair: TradingPair) => void;
  // Data for selected pair
  currentPairData: PairData;
  // Legacy props for backward compatibility
  ticks: Candle[];
  signals: SignalGenerated[];
  indicators: IndicatorsUpdate | null;
  marketRegime: MarketRegime | null;
  connected: boolean;
  isLoading: boolean;
  // Trade/account data
  trades: Trade[];
  account: AccountSummary;
  // Send message to backend
  sendMessage: (type: string, payload: any) => void;
}

const MAX_CANDLES_PER_PAIR = 201;

export function useMarketData(): UseMarketDataReturn {
  const [selectedPair, setSelectedPair] = useState<TradingPair>('BTCUSDT');
  const [allPairs, setAllPairs] = useState<Map<string, PairData>>(new Map());
  const [signals, setSignals] = useState<SignalGenerated[]>([]);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Trade and account state
  const [trades, setTrades] = useState<Trade[]>([]);
  const [account, setAccount] = useState<AccountSummary>({
    initialBalance: 500,
    currentBalance: 500,
    totalPnl: 0,
    totalPnlPercent: 0,
    winRate: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectDelay = 30000; // Max 30 seconds

  // Initialize pairs map
  useEffect(() => {
    const initialPairs = new Map<string, PairData>();
    TRADING_PAIRS.forEach((pair) => {
      initialPairs.set(pair, {
        symbol: pair,
        ticks: [],
        indicators: null,
        regime: null,
        currentPrice: null,
        change24h: null,
      });
    });
    setAllPairs(initialPairs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    const connect = () => {
      if (!isSubscribed) return;
      
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      console.log('🔌 Connecting to WebSocket...');
      const ws = new WebSocket('ws://localhost:8081');
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isSubscribed) {
          ws.close();
          return;
        }
        console.log('✅ Connected to trading bot backend');
        setConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection
        
        // Send ping every 25 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
        
        // Store interval to clear on close
        (ws as any).pingInterval = pingInterval;
      };

      ws.onclose = (event) => {
        if (!isSubscribed) return;
        
        // Clear ping interval
        if ((ws as any).pingInterval) {
          clearInterval((ws as any).pingInterval);
        }
        
        console.log('❌ Disconnected from backend', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;
        
        // Exponential backoff for reconnection
        if (!reconnectTimeoutRef.current) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            maxReconnectDelay
          );
          reconnectAttemptsRef.current++;
          
          console.log(`🔄 Attempting to reconnect in ${delay}ms... (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      const handleMessage = (event: MessageEvent) => {
        if (!isSubscribed) return;
        
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              // Welcome message received
              break;

            case 'candle_closed': {
              const candle: Candle = message.payload;
              const symbol = candle.symbol as TradingPair;
              
              setAllPairs((prev) => {
                const updated = new Map(prev);
                const pairData = updated.get(symbol);
                if (pairData) {
                  const newTicks = [...pairData.ticks, candle];
                  if (newTicks.length > MAX_CANDLES_PER_PAIR) {
                    newTicks.shift();
                  }
                  updated.set(symbol, {
                    ...pairData,
                    ticks: newTicks,
                    currentPrice: candle.close,
                  });
                }
                return updated;
              });
              break;
            }

            case 'indicators_updated': {
              const indicatorsData: IndicatorsUpdate = message.payload;
              const symbol = indicatorsData.symbol as TradingPair;
              
              setAllPairs((prev) => {
                const updated = new Map(prev);
                const pairData = updated.get(symbol);
                if (pairData) {
                  updated.set(symbol, {
                    ...pairData,
                    indicators: indicatorsData,
                  });
                }
                return updated;
              });
              break;
            }

            case 'SignalGenerated': {
              const signal: SignalGenerated = message.payload;
              setSignals((prev) => [...prev, signal]);
              break;
            }

            case 'market_regime_changed': {
              const regimeData: MarketRegime = message.payload;
              const symbol = regimeData.symbol as TradingPair;
              
              console.log('📊 Market regime updated:', { symbol, regime: regimeData.regime });
              
              setAllPairs((prev) => {
                const updated = new Map(prev);
                const pairData = updated.get(symbol);
                if (pairData) {
                  updated.set(symbol, {
                    ...pairData,
                    regime: regimeData,
                  });
                }
                return updated;
              });
              break;
            }

            case 'price_update': {
              const { symbol, price, change24h } = message.payload;
              const pairSymbol = symbol as TradingPair;
              
              setAllPairs((prev) => {
                const updated = new Map(prev);
                const pairData = updated.get(pairSymbol);
                if (pairData) {
                  updated.set(pairSymbol, {
                    ...pairData,
                    currentPrice: price,
                    change24h: change24h,
                  });
                }
                return updated;
              });
              break;
            }

            case 'trade_executed': {
              const trade: Trade = message.payload;
              console.log('[DEBUG] Received trade_executed:', trade);
              setTrades((prev) => {
                const existing = prev.find((t) => t.id === trade.id);
                if (existing) {
                  return prev.map((t) => (t.id === trade.id ? trade : t));
                }
                return [...prev, trade];
              });
              break;
            }

            case 'positions_update': {
              const positions: Trade[] = message.payload;
              console.log('[DEBUG] Received positions_update:', positions);
              setTrades((prev) => {
                // Get IDs of new positions
                const newPositionIds = new Set(positions.map(p => p.id));
                // Keep existing OPEN trades that are NOT in the new positions list
                const existingOpenTrades = prev.filter(
                  (t) => t.status === 'OPEN' && !newPositionIds.has(t.id)
                );
                // Merge: existing OPEN trades + new positions from backend
                const closedTrades = prev.filter((t) => t.status !== 'OPEN');
                return [...closedTrades, ...existingOpenTrades, ...positions];
              });
              break;
            }

            case 'account_update': {
              const accountUpdate: AccountSummary = message.payload;
              console.log('[DEBUG] Received account_update:', accountUpdate);
              setAccount(accountUpdate);
              break;
            }
          }
        } catch (e) {
          console.error('Failed to parse websocket message:', e);
        }
      };

      ws.addEventListener('message', handleMessage);
    };

    // Small delay to prevent React Strict Mode issues
    const initialTimeout = setTimeout(() => {
      connect();
    }, 100);

    return () => {
      isSubscribed = false;
      clearTimeout(initialTimeout);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Get current pair data
  const currentPairData = allPairs.get(selectedPair) || {
    symbol: selectedPair,
    ticks: [],
    indicators: null,
    regime: null,
    currentPrice: null,
    change24h: null,
  };

  // Filter signals for selected pair
  const filteredSignals = signals.filter(
    (signal) => signal.symbol === selectedPair
  );

  return {
    allPairs,
    selectedPair,
    setSelectedPair,
    currentPairData,
    // Legacy props
    ticks: currentPairData.ticks,
    signals: filteredSignals,
    indicators: currentPairData.indicators,
    marketRegime: currentPairData.regime,
    connected,
    isLoading,
    // Trade/account data
    trades,
    account,
    // Send message to backend
    sendMessage: (type: string, payload: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type, payload }));
      } else {
        console.warn('WebSocket not connected, cannot send message');
      }
    },
  };
}
