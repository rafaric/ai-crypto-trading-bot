import { useState, useEffect } from 'react';
import type { MarketTick, SignalGenerated } from '../../../shared/src/events';

export function useMarketData() {
  const [ticks, setTicks] = useState<MarketTick[]>([]);
  const [signals, setSignals] = useState<SignalGenerated[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8081');

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'MarketTick') {
          setTicks((prev) => {
            const updated = [...prev, message.payload];
            if (updated.length > 200) {
              return updated.slice(updated.length - 200);
            }
            return updated;
          });
        } else if (message.type === 'SignalGenerated') {
          setSignals((prev) => [...prev, message.payload]);
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
      ws.close();
    };
  }, []);

  return { ticks, signals };
}
