import { useState, useEffect } from 'react';
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

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8081');

    ws.onopen = () => {
      console.log('✅ Connected to trading bot backend');
      setConnected(true);
    };

    ws.onclose = () => {
      console.log('❌ Disconnected from backend');
      setConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    const handleMessage = (event: MessageEvent) => {
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

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.close();
    };
  }, []);

  return { ticks, signals, indicators, connected };
}