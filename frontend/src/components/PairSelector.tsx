import { useState } from 'react';
import { cn } from '../utils/cn';

export const TRADING_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;

export type TradingPair = (typeof TRADING_PAIRS)[number];

export interface PairData {
  symbol: TradingPair;
  price: number | null;
  change24h: number | null;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | null;
}

interface PairSelectorProps {
  pairs: PairData[];
  selectedPair: TradingPair;
  onSelect: (pair: TradingPair) => void;
  isLoading?: boolean;
}

export function PairSelector({
  pairs,
  selectedPair,
  onSelect,
  isLoading = false,
}: PairSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const selectedPairData = pairs.find((p) => p.symbol === selectedPair);

  const getRegimeColor = (regime: PairData['regime']) => {
    switch (regime) {
      case 'TRENDING_UP':
        return 'bg-green-500';
      case 'TRENDING_DOWN':
        return 'bg-red-500';
      case 'RANGING':
        return 'bg-gray-500';
      default:
        return 'bg-gray-300';
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatChange = (change: number | null) => {
    if (change === null) return '—';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  return (
    <div className="w-full">
      {/* Mobile: Dropdown */}
      <div className="md:hidden relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={cn(
            'w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all',
            'bg-white border-slate-200 hover:border-slate-300',
            isDropdownOpen && 'border-blue-500 ring-2 ring-blue-200'
          )}
          disabled={isLoading}
        >
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-slate-900">
              {selectedPair.replace('USDT', '/USDT')}
            </span>
            {selectedPairData?.price && (
              <span className="text-slate-600 font-medium">
                ${formatPrice(selectedPairData.price)}
              </span>
            )}
          </div>
          <svg
            className={cn(
              'w-5 h-5 text-slate-400 transition-transform',
              isDropdownOpen && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
            {pairs.map((pair) => (
              <button
                key={pair.symbol}
                onClick={() => {
                  onSelect(pair.symbol);
                  setIsDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between p-4 transition-colors',
                  'hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg',
                  pair.symbol === selectedPair && 'bg-blue-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'w-3 h-3 rounded-full',
                      getRegimeColor(pair.regime)
                    )}
                  />
                  <span className="font-semibold text-slate-900">
                    {pair.symbol.replace('USDT', '/USDT')}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-slate-900">
                    ${formatPrice(pair.price)}
                  </div>
                  <div
                    className={cn(
                      'text-sm',
                      pair.change24h && pair.change24h >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    )}
                  >
                    {formatChange(pair.change24h)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: Tabs */}
      <div className="hidden md:flex gap-2">
        {pairs.map((pair) => (
          <button
            key={pair.symbol}
            onClick={() => onSelect(pair.symbol)}
            className={cn(
              'flex-1 flex items-center justify-between p-4 rounded-lg border-2 transition-all',
              'hover:shadow-md',
              pair.symbol === selectedPair
                ? 'bg-blue-50 border-blue-500 shadow-md'
                : 'bg-white border-slate-200 hover:border-slate-300'
            )}
            disabled={isLoading}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'w-3 h-3 rounded-full',
                  getRegimeColor(pair.regime)
                )}
              />
              <div>
                <div className="font-bold text-slate-900">
                  {pair.symbol.replace('USDT', '/USDT')}
                </div>
                <div
                  className={cn(
                    'text-xs font-medium',
                    pair.change24h && pair.change24h >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {formatChange(pair.change24h)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-slate-900">
                ${formatPrice(pair.price)}
              </div>
              {isLoading && pair.symbol === selectedPair && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <svg
                    className="animate-spin h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading...
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
