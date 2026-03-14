import { renderHook, act } from '@testing-library/react';
import { useMarketData } from './useMarketData';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useMarketData', () => {
  let mockWebSocket: any;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    mockWebSocket = {
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    class MockWebSocket {
      constructor(url: string) {
        (globalThis as any)._lastWebSocketUrl = url;
        return mockWebSocket;
      }
    }

    globalThis.WebSocket = MockWebSocket as any;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.clearAllMocks();
    delete (globalThis as any)._lastWebSocketUrl;
  });

  it('should establish a WebSocket connection on mount', () => {
    renderHook(() => useMarketData());
    expect((globalThis as any)._lastWebSocketUrl).toBe('ws://localhost:8081');
  });

  it('should close WebSocket connection on unmount', () => {
    const { unmount } = renderHook(() => useMarketData());
    unmount();
    expect(mockWebSocket.close).toHaveBeenCalled();
  });

  it('should handle incoming MarketTick messages and limit ticks to 200', () => {
    const { result } = renderHook(() => useMarketData());

    // Extract the message handler
    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    expect(onMessageCall).toBeDefined();
    const handleMessage = onMessageCall[1];

    // Simulate sending 205 ticks
    act(() => {
      for (let i = 0; i < 205; i++) {
        handleMessage({
          data: JSON.stringify({
            type: 'MarketTick',
            payload: { symbol: 'BTC/USDT', price: 50000 + i, timestamp: Date.now(), volume: 1 },
          }),
        });
      }
    });

    expect(result.current.ticks.length).toBe(200);
    expect(result.current.ticks[199].price).toBe(50204); // The last one added
  });

  it('should handle incoming SignalGenerated messages', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    const handleMessage = onMessageCall[1];

    act(() => {
      handleMessage({
        data: JSON.stringify({
          type: 'SignalGenerated',
          payload: { symbol: 'ETH/USDT', action: 'BUY', confidence: 0.9, timestamp: Date.now() },
        }),
      });
    });

    expect(result.current.signals.length).toBe(1);
    expect(result.current.signals[0].symbol).toBe('ETH/USDT');
  });
});
