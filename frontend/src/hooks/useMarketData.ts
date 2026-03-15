import { useState, useEffect, useRef } from 'react';
import type { MarketTick, SignalGenerated } from '../../../shared/src/events';

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
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
}

export function useMarketData() {
  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [signals, setSignals] = useState<SignalGenerated[]>([]);
  const [indicators, setIndicators] = useState<IndicatorsUpdate | null>(null);
  const [marketRegime, setMarketRegime] = useState<MarketRegime | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectDelay = 30000; // Max 30 seconds

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
        // Don't set connected false here, let onclose handle it
      };

      const handleMessage = (event: MessageEvent) => {
        if (!isSubscribed) return;
        
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              // Welcome message received
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
              console.log('📥 Received indicators:', {
                emaSeries: message.payload.indicators?.ema?.series?.length,
                vwapSeries: message.payload.indicators?.vwap?.series?.length,
                emaValue: message.payload.indicators?.ema?.value,
                vwapValue: message.payload.indicators?.vwap?.value,
              });
              setIndicators(message.payload);
              break;

            case 'SignalGenerated':
              setSignals((prev) => [...prev, message.payload]);
              break;

            case 'market_regime_changed':
              console.log('📊 Market regime updated:', message.payload);
              setMarketRegime(message.payload);
              break;
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

  return { ticks, signals, indicators, marketRegime, connected };
}