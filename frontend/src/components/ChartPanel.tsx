import React from 'react';
import type { MarketTick } from 'shared/src/events';

interface ChartPanelProps {
  ticks: MarketTick[];
}

export const ChartPanel: React.FC<ChartPanelProps> = ({ ticks }) => {
  if (ticks.length === 0) {
    return <div>No data available</div>;
  }

  const latestTick = ticks[ticks.length - 1];

  return (
    <div className="flex flex-col p-4 border rounded-lg bg-white shadow-sm h-64">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{latestTick.symbol} Chart</h2>
        <div className="text-xl font-bold">
          ${latestTick.price.toFixed(2)}
        </div>
      </div>
      <div 
        data-testid="chart-container" 
        className="flex-1 bg-gray-50 border border-gray-200 rounded relative"
      >
        {/* Placeholder for lightweight-charts */}
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          Chart View (Lightweight Charts container)
        </div>
      </div>
    </div>
  );
};
