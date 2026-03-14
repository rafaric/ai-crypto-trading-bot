import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SignalsPanel } from './SignalsPanel';
import type { SignalGenerated } from 'shared/src/events';

describe('SignalsPanel', () => {
  it('renders a list of signals', () => {
    const signals: SignalGenerated[] = [
      { symbol: 'BTCUSDT', action: 'BUY', confidence: 0.95, timestamp: 1000000 },
      { symbol: 'ETHUSDT', action: 'SELL', confidence: 0.88, timestamp: 1000050 }
    ];
    
    render(<SignalsPanel signals={signals} />);
    
    expect(screen.getByText(/BTCUSDT/)).toBeInTheDocument();
    expect(screen.getByText(/BUY/)).toBeInTheDocument();
    expect(screen.getByText(/95%/)).toBeInTheDocument();
    
    expect(screen.getByText(/ETHUSDT/)).toBeInTheDocument();
    expect(screen.getByText(/SELL/)).toBeInTheDocument();
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  it('renders an empty state when no signals are provided', () => {
    render(<SignalsPanel signals={[]} />);
    expect(screen.getByText(/No signals/i)).toBeInTheDocument();
  });
});
