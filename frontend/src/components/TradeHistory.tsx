import type { Trade, AccountSummary } from '../hooks/useMarketData';

interface TradeHistoryProps {
  trades: Trade[];
  account: AccountSummary;
  connected: boolean;
  sendMessage: (type: string, payload: any) => void;
}

export function TradeHistory({ trades, account, connected, sendMessage }: TradeHistoryProps) {
  const openPositions = trades.filter((t) => t.status === 'OPEN');
  const closedTrades = trades.filter((t) => t.status === 'CLOSED').sort((a, b) => (b.closeTime || 0) - (a.closeTime || 0));

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPnl = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}$${pnl.toFixed(2)}`;
  };

  const formatPnlPercent = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${pnl.toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">Trade History</h3>
        <div className={`text-xs ${connected ? 'text-green-600' : 'text-red-600'}`}>
          {connected ? '● Live' : '○ Disconnected'}
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Account Balance</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div>
            <p className="text-slate-500 text-xs">Initial</p>
            <p className="font-medium">${account.initialBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Current</p>
            <p className="font-medium">${account.currentBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Total P&L</p>
            <p className={`font-medium ${account.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPnl(account.totalPnl)} ({formatPnlPercent(account.totalPnlPercent)})
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Win Rate</p>
            <p className="font-medium">{account.winRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Open Positions */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Open Positions ({openPositions.length})</h4>
        {openPositions.length === 0 ? (
          <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded border border-slate-200">
            No open positions
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Symbol</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Side</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Entry</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">SL</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">TP</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Qty</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">P&L</th>
                  <th className="px-2 py-1.5 text-center font-medium text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((trade) => {
                  const currentPnl = trade.exitPrice
                    ? (trade.exitPrice - trade.entryPrice) * (trade.side === 'BUY' ? 1 : -1) * trade.quantity
                    : 0;
                  return (
                    <tr key={trade.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-medium">{trade.symbol}</td>
                      <td className={`px-2 py-1.5 font-bold ${trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                        {trade.side}
                      </td>
                      <td className="px-2 py-1.5 text-right">{formatPrice(trade.entryPrice)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-500">{trade.stopLoss ? formatPrice(trade.stopLoss) : '—'}</td>
                      <td className="px-2 py-1.5 text-right text-slate-500">{trade.takeProfit ? formatPrice(trade.takeProfit) : '—'}</td>
                      <td className="px-2 py-1.5 text-right">{trade.quantity.toFixed(4)}</td>
                      <td className={`px-2 py-1.5 text-right font-medium ${currentPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPnl(currentPnl)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          onClick={() => {
                            console.log('[DEBUG] TradeHistory close button clicked:', { positionId: trade.id, symbol: trade.symbol });
                            sendMessage('close_position', { positionId: trade.id, symbol: trade.symbol });
                          }}
                          className="px-2 py-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Trades */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">Trade History ({closedTrades.length})</h4>
        {closedTrades.length === 0 ? (
          <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded border border-slate-200">
            No closed trades
          </div>
        ) : (
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Date/Time</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Symbol</th>
                  <th className="px-2 py-1.5 text-left font-medium text-slate-600">Side</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Entry</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">Exit</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">P&L ($)</th>
                  <th className="px-2 py-1.5 text-right font-medium text-slate-600">P&L (%)</th>
                  <th className="px-2 py-1.5 text-center font-medium text-slate-600">Result</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-600">{trade.closeTime ? formatTime(trade.closeTime) : '—'}</td>
                    <td className="px-2 py-1.5 font-medium">{trade.symbol}</td>
                    <td className={`px-2 py-1.5 font-bold ${trade.side === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.side}
                    </td>
                    <td className="px-2 py-1.5 text-right">{formatPrice(trade.entryPrice)}</td>
                    <td className="px-2 py-1.5 text-right">{trade.exitPrice ? formatPrice(trade.exitPrice) : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-medium ${(trade.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl !== undefined ? formatPnl(trade.pnl) : '—'}
                    </td>
                    <td className={`px-2 py-1.5 text-right font-medium ${(trade.pnlPercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnlPercent !== undefined ? formatPnlPercent(trade.pnlPercent) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {trade.result && (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${trade.result === 'WIN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {trade.result}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}