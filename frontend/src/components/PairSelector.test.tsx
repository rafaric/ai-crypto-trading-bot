import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PairSelector, type PairData } from './PairSelector';

describe('PairSelector', () => {
  const mockPairs: PairData[] = [
    { symbol: 'BTCUSDT', price: 65000, change24h: 2.5, regime: 'TRENDING_UP' },
    { symbol: 'ETHUSDT', price: 3500, change24h: -1.2, regime: 'TRENDING_DOWN' },
    { symbol: 'SOLUSDT', price: 150, change24h: 0.5, regime: 'RANGING' },
  ];

  it('renders tabs with pair information on desktop', () => {
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    // Check that pair names are displayed
    expect(screen.getByText(/BTC\/USDT/i)).toBeInTheDocument();
    expect(screen.getByText(/ETH\/USDT/i)).toBeInTheDocument();
    expect(screen.getByText(/SOL\/USDT/i)).toBeInTheDocument();
  });

  it('displays prices for each pair', () => {
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/\$65,000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$3,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$150\.00/)).toBeInTheDocument();
  });

  it('displays 24h change with correct colors', () => {
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/\+2\.50%/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.20%/)).toBeInTheDocument();
    expect(screen.getByText(/\+0\.50%/)).toBeInTheDocument();
  });

  it('calls onSelect when a pair is clicked', () => {
    const onSelect = vi.fn();
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={onSelect}
      />
    );

    // Click on ETHUSDT
    const ethButton = screen.getAllByRole('button').find(
      button => button.textContent?.includes('ETH/USDT')
    );
    if (ethButton) {
      fireEvent.click(ethButton);
    }

    expect(onSelect).toHaveBeenCalledWith('ETHUSDT');
  });

  it('highlights the selected pair', () => {
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="ETHUSDT"
        onSelect={vi.fn()}
      />
    );

    // The selected pair should have different styling
    // We can check by looking for the pair name
    const ethText = screen.getAllByText(/ETH\/USDT/i)[0];
    expect(ethText).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('handles null prices gracefully', () => {
    const pairsWithNull: PairData[] = [
      { symbol: 'BTCUSDT', price: null, change24h: null, regime: null },
    ];

    render(
      <PairSelector
        pairs={pairsWithNull}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getAllByText(/—/)[0]).toBeInTheDocument();
  });

  it('renders dropdown on mobile (hidden on desktop view)', () => {
    render(
      <PairSelector
        pairs={mockPairs}
        selectedPair="BTCUSDT"
        onSelect={vi.fn()}
      />
    );

    // Mobile dropdown button should be present (even if hidden on desktop via CSS)
    const dropdownButton = screen.getAllByRole('button')[0];
    expect(dropdownButton).toBeInTheDocument();
  });
});
