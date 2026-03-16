import { cn } from '../utils/cn';
import type { TradingPair } from '../hooks/useMarketData';

interface PairCardItem {
  symbol: TradingPair;
  price: number | null;
  change24h: number | null;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | null;
}

interface PairCardsProps {
  pairs: PairCardItem[];
  selectedPair: TradingPair;
  onSelect: (pair: TradingPair) => void;
}

export function PairCards({ pairs, selectedPair, onSelect }: PairCardsProps) {
  const getRegimeStyles = (regime: PairCardItem['regime']) => {
    switch (regime) {
      case 'TRENDING_UP':
        return {
          border: 'border-green-500',
          bg: 'bg-green-50',
          text: 'text-green-700',
          badge: 'bg-green-500',
        };
      case 'TRENDING_DOWN':
        return {
          border: 'border-red-500',
          bg: 'bg-red-50',
          text: 'text-red-700',
          badge: 'bg-red-500',
        };
      case 'RANGING':
        return {
          border: 'border-slate-500',
          bg: 'bg-slate-50',
          text: 'text-slate-700',
          badge: 'bg-slate-500',
        };
      default:
        return {
          border: 'border-slate-300',
          bg: 'bg-white',
          text: 'text-slate-600',
          badge: 'bg-slate-300',
        };
    }
  };

  const getRegimeLabel = (regime: PairCardItem['regime']) => {
    switch (regime) {
      case 'TRENDING_UP':
        return 'UP';
      case 'TRENDING_DOWN':
        return 'DOWN';
      case 'RANGING':
        return 'RANGE';
      default:
        return '—';
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {pairs.map((pair) => {
        const styles = getRegimeStyles(pair.regime);
        const isSelected = pair.symbol === selectedPair;

        return (
          <button
            key={pair.symbol}
            onClick={() => onSelect(pair.symbol)}
            className={cn(
              'relative p-4 rounded-lg border-2 transition-all text-left',
              'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500',
              styles.bg,
              isSelected ? 'ring-2 ring-blue-500 shadow-md' : styles.border
            )}
          >
            {/* Regime Badge */}
            <div
              className={cn(
                'absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold text-white',
                styles.badge
              )}
            >
              {getRegimeLabel(pair.regime)}
            </div>

            {/* Pair Name */}
            <div className="mb-2">
              <span className="font-bold text-lg text-slate-900">
                {pair.symbol.replace('USDT', '/USDT')}
              </span>
            </div>

            {/* Price */}
            <div className="mb-1">
              <span className="text-2xl font-bold text-slate-900">
                ${formatPrice(pair.price)}
              </span>
            </div>

            {/* 24h Change */}
            <div
              className={cn(
                'text-sm font-medium',
                pair.change24h && pair.change24h >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              )}
            >
              {formatChange(pair.change24h)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
