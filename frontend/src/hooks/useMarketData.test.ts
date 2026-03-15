import { renderHook, act } from '@testing-library/react';
import { useMarketData, TRADING_PAIRS } from './useMarketData';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Candle, SignalGenerated } from '../../../shared/src/events';

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

  it('should initialize all trading pairs', () => {
    const { result } = renderHook(() => useMarketData());
    
    expect(result.current.allPairs.size).toBe(TRADING_PAIRS.length);
    TRADING_PAIRS.forEach((pair) => {
      expect(result.current.allPairs.has(pair)).toBe(true);
    });
  });

  it('should default selectedPair to BTCUSDT', () => {
    const { result } = renderHook(() => useMarketData());
    expect(result.current.selectedPair).toBe('BTCUSDT');
  });

  it('should allow changing selectedPair', () => {
    const { result } = renderHook(() => useMarketData());
    
    act(() => {
      result.current.setSelectedPair('ETHUSDT');
    });
    
    expect(result.current.selectedPair).toBe('ETHUSDT');
  });

  it('should handle incoming candle_closed messages for multiple pairs', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    expect(onMessageCall).toBeDefined();
    const handleMessage = onMessageCall[1];

    const candle1: Candle = {
      symbol: 'BTCUSDT',
      open: 50000,
      high: 51000,
      low: 49500,
      close: 50500,
      timestamp: Date.now(),
      volume: 1.5,
    };

    const candle2: Candle = {
      symbol: 'ETHUSDT',
      open: 3000,
      high: 3100,
      low: 2950,
      close: 3050,
      timestamp: Date.now(),
      volume: 10,
    };

    act(() => {
      handleMessage({
        data: JSON.stringify({
          type: 'candle_closed',
          payload: candle1,
        }),
      });
      handleMessage({
        data: JSON.stringify({
          type: 'candle_closed',
          payload: candle2,
        }),
      });
    });

    expect(result.current.allPairs.get('BTCUSDT')?.ticks.length).toBe(1);
    expect(result.current.allPairs.get('ETHUSDT')?.ticks.length).toBe(1);
    expect(result.current.ticks.length).toBe(1); // Only selected pair's ticks
  });

  it('should limit candles to 200 per pair', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    const handleMessage = onMessageCall[1];

    act(() => {
      for (let i = 0; i < 205; i++) {
        handleMessage({
          data: JSON.stringify({
            type: 'candle_closed',
            payload: {
              symbol: 'BTCUSDT',
              open: 50000 + i,
              high: 51000 + i,
              low: 49500 + i,
              close: 50500 + i,
              timestamp: Date.now() + i * 1000,
              volume: 1,
            } as Candle,
          }),
        });
      }
    });

    expect(result.current.allPairs.get('BTCUSDT')?.ticks.length).toBe(200);
  });

  it('should handle incoming SignalGenerated messages and filter by selected pair', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    const handleMessage = onMessageCall[1];

    const signal1: SignalGenerated = {
      symbol: 'BTCUSDT',
      action: 'BUY',
      confidence: 0.9,
      timestamp: Date.now(),
    };

    const signal2: SignalGenerated = {
      symbol: 'ETHUSDT',
      action: 'SELL',
      confidence: 0.85,
      timestamp: Date.now(),
    };

    act(() => {
      handleMessage({
        data: JSON.stringify({
          type: 'SignalGenerated',
          payload: signal1,
        }),
      });
      handleMessage({
        data: JSON.stringify({
          type: 'SignalGenerated',
          payload: signal2,
        }),
      });
    });

    // Should have both signals in internal state
    // But only BTC signals should be returned (since selectedPair is BTCUSDT)
    expect(result.current.signals.length).toBe(1);
    expect(result.current.signals[0].symbol).toBe('BTCUSDT');
  });

  it('should update signals when selectedPair changes', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    const handleMessage = onMessageCall[1];

    // Add signals for both pairs
    act(() => {
      handleMessage({
        data: JSON.stringify({
          type: 'SignalGenerated',
          payload: {
            symbol: 'BTCUSDT',
            action: 'BUY',
            confidence: 0.9,
            timestamp: Date.now(),
          } as SignalGenerated,
        }),
      });
      handleMessage({
        data: JSON.stringify({
          type: 'SignalGenerated',
          payload: {
            symbol: 'ETHUSDT',
            action: 'SELL',
            confidence: 0.85,
            timestamp: Date.now(),
          } as SignalGenerated,
        }),
      });
    });

    // Initially shows BTC signals
    expect(result.current.signals.length).toBe(1);
    expect(result.current.signals[0].symbol).toBe('BTCUSDT');

    // Switch to ETH
    act(() => {
      result.current.setSelectedPair('ETHUSDT');
    });

    // Now should show ETH signals
    expect(result.current.signals.length).toBe(1);
    expect(result.current.signals[0].symbol).toBe('ETHUSDT');
  });

  it('should handle market_regime_changed messages', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    const handleMessage = onMessageCall[1];

    act(() => {
      handleMessage({
        data: JSON.stringify({
          type: 'market_regime_changed',
          payload: {
            symbol: 'BTCUSDT',
            regime: 'TRENDING_UP',
            trendDirection: 'BULLISH',
            confidence: 0.85,
            timestamp: Date.now(),
          },
        }),
      });
    });

    const btcData = result.current.allPairs.get('BTCUSDT');
    expect(btcData?.regime?.regime).toBe('TRENDING_UP');
    expect(btcData?.regime?.trendDirection).toBe('BULLISH');
  });

  it('should handle price_update messages', () => {
    const { result } = renderHook(() => useMarketData());

    const onMessageCall = mockWebSocket.addEventListener.mock.calls.find(
      (call: any[]) => call[0] === 'message'
    );
    const handleMessage = onMessageCall[1];

    act(() => {
      handleMessage({
        data: JSON.stringify({
          type: 'price_update',
          payload: {
            symbol: 'BTCUSDT',
            price: 65000,
            change24h: 2.5,
          },
        }),
      });
    });

    const btcData = result.current.allPairs.get('BTCUSDT');
    expect(btcData?.currentPrice).toBe(65000);
    expect(btcData?.change24h).toBe(2.5);
  });

  it('should expose currentPairData for the selected pair', () => {
    const { result } = renderHook(() => useMarketData());

    expect(result.current.currentPairData.symbol).toBe('BTCUSDT');
    expect(result.current.currentPairData.ticks).toEqual([]);

    // Change to ETH
    act(() => {
      result.current.setSelectedPair('ETHUSDT');
    });

    expect(result.current.currentPairData.symbol).toBe('ETHUSDT');
  });
});
