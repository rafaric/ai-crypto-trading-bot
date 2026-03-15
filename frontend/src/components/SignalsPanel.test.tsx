import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SignalsPanel } from './SignalsPanel';
import type { SignalGenerated } from 'shared/src/events';

describe('SignalsPanel', () => {
  it('renders a list of signals for the selected pair', () => {
    const signals: SignalGenerated[] = [
      { symbol: 'BTCUSDT', action: 'BUY', confidence: 0.95, timestamp: 1000000 },
      { symbol: 'BTCUSDT', action: 'SELL', confidence: 0.88, timestamp: 1000050 }
    ];
    
    render(<SignalsPanel selectedPair="BTCUSDT" signals={signals} />);
    
    expect(screen.getByText(/BTCUSDT/)).toBeInTheDocument();
    expect(screen.getByText(/BUY/)).toBeInTheDocument();
    expect(screen.getByText(/95%/)).toBeInTheDocument();
    
    expect(screen.getByText(/SELL/)).toBeInTheDocument();
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  it('renders an empty state with pair name when no signals are provided', () => {
    render(<SignalsPanel selectedPair="ETHUSDT" signals={[]} />);
    expect(screen.getByText(/No signals for ETH\/USDT/i)).toBeInTheDocument();
  });

  it('displays the selected pair in the title', () => {
    const signals: SignalGenerated[] = [
      { symbol: 'BTCUSDT', action: 'BUY', confidence: 0.95, timestamp: 1000000 },
    ];
    
    render(<SignalsPanel selectedPair="BTCUSDT" signals={signals} />);
    expect(screen.getByText(/Signals - BTC\/USDT/i)).toBeInTheDocument();
  });

  it('displays the correct pair name for different pairs', () => {
    const signals: SignalGenerated[] = [
      { symbol: 'SOLUSDT', action: 'BUY', confidence: 0.90, timestamp: 1000000 },
    ];
    
    render(<SignalsPanel selectedPair="SOLUSDT" signals={signals} />);
    expect(screen.getByText(/Signals - SOL\/USDT/i)).toBeInTheDocument();
  });
});
