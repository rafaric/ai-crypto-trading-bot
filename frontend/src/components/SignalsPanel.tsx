import React from 'react';
import type { SignalGenerated } from 'shared/src/events';

interface SignalsPanelProps {
  signals: SignalGenerated[];
}

export const SignalsPanel: React.FC<SignalsPanelProps> = ({ signals }) => {
  if (signals.length === 0) {
    return (
      <div className="p-4 border rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-500 h-64">
        No signals generated yet.
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm h-64 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Latest Signals</h2>
      <ul className="space-y-2">
        {signals.map((signal, index) => (
          <li 
            key={`${signal.symbol}-${signal.timestamp}-${index}`}
            className="flex items-center justify-between p-3 border rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className={`font-bold ${
                signal.action === 'BUY' ? 'text-green-600' : 
                signal.action === 'SELL' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {signal.action}
              </span>
              <span className="font-semibold text-gray-800">{signal.symbol}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-600">
                Confidence: {Math.round(signal.confidence * 100)}%
              </span>
              <span className="text-xs text-gray-400">
                {new Date(signal.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
