import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChartPanel } from './ChartPanel';
import type { MarketTick } from 'shared/src/events';

describe('ChartPanel', () => {
  it('renders a container for the chart', () => {
    const ticks: MarketTick[] = [
      { symbol: 'BTCUSDT', price: 65000, timestamp: 1000000, volume: 1.5 }
    ];
    
    render(<ChartPanel ticks={ticks} />);
    
    // We expect a container with a specific test id or class
    const container = screen.getByTestId('chart-container');
    expect(container).toBeInTheDocument();
  });

  it('displays the latest price if ticks are provided', () => {
    const ticks: MarketTick[] = [
      { symbol: 'BTCUSDT', price: 65000, timestamp: 1000000, volume: 1.5 },
      { symbol: 'BTCUSDT', price: 65100, timestamp: 1000060, volume: 2.0 }
    ];
    
    render(<ChartPanel ticks={ticks} />);
    
    expect(screen.getByText(/65100/)).toBeInTheDocument();
  });

  it('handles empty ticks array without crashing', () => {
    render(<ChartPanel ticks={[]} />);
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
  });
});
