import { useState, useEffect, useRef } from 'react';
import type { MarketTick, SignalGenerated } from '../../../shared/src/events';

export interface IndicatorData {
  ema: { value: number | null; period: number };
  vwap: { value: number | null; period: number };
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

export function useMarketData() {
  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [signals, setSignals] = useState<SignalGenerated[]>([]);
  const [indicators, setIndicators] = useState<IndicatorsUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      };

      ws.onclose = (event) => {
        console.log('❌ Disconnected from backend', event.code, event.reason);
        setConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect after 3 seconds
        if (isSubscribed && !reconnectTimeoutRef.current) {
          console.log('🔄 Attempting to reconnect in 3s...');
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Don't set connected false here, let onclose handle it
      };

      const handleMessage = (event: MessageEvent) => {
        if (!isSubscribed) return;
        
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('🤖', message.payload.message);
              break;

            case 'candle_closed':
              setTicks((prev) => {
                const updated = [...prev, message.payload];
                if (updated.length > 200) {
                  return updated.slice(updated.length - 200);
                }
                return updated;
              });
              break;

            case 'indicators_updated':
              setIndicators(message.payload);
              break;

            case 'SignalGenerated':
              console.log('🚨 Signal received:', message.payload);
              setSignals((prev) => [...prev, message.payload]);
              break;

            default:
              console.log('📨 Unknown message type:', message.type);
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

  return { ticks, signals, indicators, connected };
}