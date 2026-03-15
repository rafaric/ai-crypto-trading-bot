import type { SignalGenerated } from 'shared/src/events';
import type { TradingPair } from '../hooks/useMarketData';

interface SignalsPanelProps {
  selectedPair: TradingPair;
  signals: SignalGenerated[];
}

export function SignalsPanel({ selectedPair, signals }: SignalsPanelProps) {
  const formatPairName = (pair: TradingPair) => {
    return pair.replace('USDT', '/USDT');
  };

  if (signals.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-base font-bold text-slate-900 mb-3">
          Signals - {formatPairName(selectedPair)}
        </h3>
        <div className="flex items-center justify-center h-32 text-slate-500 text-sm border rounded-lg border-slate-200 bg-slate-50">
          No signals for {formatPairName(selectedPair)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-base font-bold text-slate-900 mb-3">
        Signals - {formatPairName(selectedPair)}
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {signals.map((signal, index) => (
          <div
            key={`${signal.symbol}-${signal.timestamp}-${index}`}
            className="flex items-center justify-between p-3 border rounded-md bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className={`font-bold ${
                  signal.action === 'BUY'
                    ? 'text-green-600'
                    : signal.action === 'SELL'
                    ? 'text-red-600'
                    : 'text-slate-600'
                }`}
              >
                {signal.action}
              </span>
              <span className="font-semibold text-slate-800">
                {signal.symbol}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-slate-600">
                Confidence: {Math.round(signal.confidence * 100)}%
              </span>
              <span className="text-xs text-slate-400">
                {new Date(signal.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
