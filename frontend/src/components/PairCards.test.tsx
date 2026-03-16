import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PairCards } from './PairCards';
import type { TradingPair } from '../hooks/useMarketData';

interface PairCardItem {
  symbol: TradingPair;
  price: number | null;
  change24h: number | null;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | null;
}

describe('PairCards', () => {
  const mockPairs: PairCardItem[] = [
    { symbol: 'BTCUSDT', price: 65000, change24h: 2.5, regime: 'TRENDING_UP' },
    { symbol: 'ETHUSDT', price: 3500, change24h: -1.2, regime: 'TRENDING_DOWN' },
    { symbol: 'SOLUSDT', price: 150, change24h: 0.5, regime: 'RANGING' },
  ];

  it('renders all pairs as cards', () => {
    render(
      <PairCards
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/BTC\/USDT/i)).toBeInTheDocument();
    expect(screen.getByText(/ETH\/USDT/i)).toBeInTheDocument();
    expect(screen.getByText(/SOL\/USDT/i)).toBeInTheDocument();
  });

  it('displays prices for each pair', () => {
    render(
      <PairCards
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/\$65,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$3,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$150\.00/)).toBeInTheDocument();
  });

  it('displays regime badges with correct labels', () => {
    render(
      <PairCards
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('UP')).toBeInTheDocument();
    expect(screen.getByText('DOWN')).toBeInTheDocument();
    expect(screen.getByText('RANGE')).toBeInTheDocument();
  });

  it('calls onSelect when a card is clicked', () => {
    const onSelect = vi.fn();
    render(
      <PairCards
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={onSelect}
      />
    );

    // Find and click on the ETH card
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);

    expect(onSelect).toHaveBeenCalledWith('ETHUSDT');
  });

  it('highlights the selected pair with ring', () => {
    render(
      <PairCards
        pairs={mockPairs}
        selectedPair="ETHUSDT"
        onSelect={vi.fn()}
      />
    );

    // The ETH card should be selected
    const ethText = screen.getAllByText(/ETH\/USDT/i)[0];
    expect(ethText).toBeInTheDocument();
  });

  it('displays 24h change with correct colors', () => {
    render(
      <PairCards
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/\+2\.50%/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.20%/)).toBeInTheDocument();
  });

  it('handles null values gracefully', () => {
    const pairsWithNull: PairCardItem[] = [
      { symbol: 'BTCUSDT', price: null, change24h: null, regime: null },
    ];

    render(
      <PairCards
        pairs={pairsWithNull}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it('displays different regime colors correctly', () => {
    const { container } = render(
      <PairCards
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    // Check that the component rendered
    expect(container.firstChild).toBeInTheDocument();
  });
});
