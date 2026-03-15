import type { MarketRegime } from '../hooks/useMarketData';
import type { TradingPair } from '../hooks/useMarketData';

interface MarketRegimePanelProps {
  selectedPair: TradingPair;
  regime: MarketRegime | null;
}

export function MarketRegimePanel({ selectedPair, regime }: MarketRegimePanelProps) {
  if (!regime) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-base font-bold text-slate-100 mb-3">
          {selectedPair.replace('USDT', '/USDT')} - 1H Trend Analysis
        </h3>
        <div className="text-slate-400 text-sm italic">
          Analyzing market conditions...
        </div>
      </div>
    );
  }

  const getRegimeStyles = () => {
    switch (regime.regime) {
      case 'TRENDING_UP':
        return {
          backgroundColor: '#10b981',
          color: 'white',
          borderColor: '#059669',
        };
      case 'TRENDING_DOWN':
        return {
          backgroundColor: '#ef4444',
          color: 'white',
          borderColor: '#dc2626',
        };
      case 'RANGING':
        return {
          backgroundColor: '#6b7280',
          color: 'white',
          borderColor: '#4b5563',
        };
      default:
        return {
          backgroundColor: '#6b7280',
          color: 'white',
          borderColor: '#4b5563',
        };
    }
  };

  const getRegimeEmoji = () => {
    switch (regime.regime) {
      case 'TRENDING_UP':
        return '📈';
      case 'TRENDING_DOWN':
        return '📉';
      case 'RANGING':
        return '➡️';
      default:
        return '❓';
    }
  };

  const getTrendLabel = () => {
    switch (regime.trendDirection) {
      case 'BULLISH':
        return 'Bullish Trend';
      case 'BEARISH':
        return 'Bearish Trend';
      case 'NEUTRAL':
        return 'Neutral / Ranging';
      default:
        return 'Unknown';
    }
  };

  const getSignalInstruction = () => {
    switch (regime.regime) {
      case 'TRENDING_UP':
        return 'Only BUY signals allowed';
      case 'TRENDING_DOWN':
        return 'Only SELL signals allowed';
      case 'RANGING':
        return 'No signals - avoid trading';
      default:
        return '';
    }
  };

  const regimeStyles = getRegimeStyles();

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <h3 className="text-base font-bold text-slate-100 mb-3">
        {selectedPair.replace('USDT', '/USDT')} - 1H Trend Analysis
      </h3>
      <div
        className="p-4 rounded-lg border-2 text-center"
        style={{
          backgroundColor: regimeStyles.backgroundColor,
          borderColor: regimeStyles.borderColor,
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-2xl">{getRegimeEmoji()}</span>
          <span className="text-lg font-bold text-white">
            {regime.regime.replace('_', ' ')}
          </span>
        </div>
        <div className="text-sm text-white/90 mb-1">{getTrendLabel()}</div>
        <div className="text-xs text-white/80 mb-3">
          Confidence: {(regime.confidence * 100).toFixed(0)}%
        </div>
        <div className="inline-block text-xs font-bold text-white px-2 py-1 rounded bg-black/20">
          {getSignalInstruction()}
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-400 leading-relaxed">
        Based on 1H timeframe: EMA 200 + ADX
        <br />
        Signals filtered to trade only with the trend
      </div>
    </div>
  );
}
