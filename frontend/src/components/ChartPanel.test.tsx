import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChartPanel } from './ChartPanel';
import type { Candle } from 'shared/src/events';

describe('ChartPanel', () => {
  it('renders a container for the chart', () => {
    const candles: Candle[] = [
      { symbol: 'BTCUSDT', open: 64000, high: 66000, low: 63500, close: 65000, timestamp: 1000000, volume: 1.5 }
    ];
    
    render(<ChartPanel selectedPair="BTCUSDT" candles={candles} />);
    
    const container = screen.getByTestId('chart-container');
    expect(container).toBeInTheDocument();
  });

  it('displays the selected pair name in the title', () => {
    const candles: Candle[] = [
      { symbol: 'BTCUSDT', open: 64000, high: 66000, low: 63500, close: 65000, timestamp: 1000000, volume: 1.5 }
    ];
    
    render(<ChartPanel selectedPair="BTCUSDT" candles={candles} />);
    expect(screen.getByText(/BTC\/USDT Chart/i)).toBeInTheDocument();
  });

  it('displays different pair names correctly', () => {
    const candles: Candle[] = [
      { symbol: 'ETHUSDT', open: 3000, high: 3100, low: 2950, close: 3050, timestamp: 1000000, volume: 10 }
    ];
    
    render(<ChartPanel selectedPair="ETHUSDT" candles={candles} />);
    expect(screen.getByText(/ETH\/USDT Chart/i)).toBeInTheDocument();
  });

  it('handles empty candles array without crashing', () => {
    render(<ChartPanel selectedPair="BTCUSDT" candles={[]} />);
    expect(screen.getByText(/Waiting for candle data/i)).toBeInTheDocument();
  });

  it('displays EMA and VWAP values when provided', () => {
    const candles: Candle[] = [
      { symbol: 'BTCUSDT', open: 64000, high: 66000, low: 63500, close: 65000, timestamp: 1000000, volume: 1.5 }
    ];
    
    const indicators = {
      ema: 64500,
      vwap: 64800,
    };
    
    render(<ChartPanel selectedPair="BTCUSDT" candles={candles} indicators={indicators} />);
    expect(screen.getByText(/EMA 200: 64500/i)).toBeInTheDocument();
    expect(screen.getByText(/VWAP: 64800/i)).toBeInTheDocument();
  });

  it('displays the timeframe badge', () => {
    const candles: Candle[] = [
      { symbol: 'BTCUSDT', open: 64000, high: 66000, low: 63500, close: 65000, timestamp: 1000000, volume: 1.5 }
    ];
    
    render(<ChartPanel selectedPair="BTCUSDT" candles={candles} />);
    expect(screen.getByText(/5m/i)).toBeInTheDocument();
  });
});
