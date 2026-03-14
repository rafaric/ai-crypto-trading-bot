import { ChartPanel } from './components/ChartPanel';
import { SignalsPanel } from './components/SignalsPanel';
import { useMarketData } from './hooks/useMarketData';

function App() {
  const { ticks, signals, indicators, connected } = useMarketData();

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-800 font-sans">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AI Crypto Trading Agent</h1>
            <p className="text-gray-600">Real-time market analysis and automated trading</p>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartPanel 
            candles={ticks} 
            indicators={{
              ema: indicators?.indicators.ema?.value,
              vwap: indicators?.indicators.vwap?.value
            }}
          />
          
          {/* Indicators Panel */}
          {indicators && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Technical Indicators</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-gray-600">EMA 200</p>
                  <p className="text-lg font-bold text-blue-900">
                    {indicators.indicators.ema.value?.toFixed(2) || '—'}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded">
                  <p className="text-sm text-gray-600">VWAP</p>
                  <p className="text-lg font-bold text-purple-900">
                    {indicators.indicators.vwap.value?.toFixed(2) || '—'}
                  </p>
                </div>
                <div className={`p-4 rounded ${
                  indicators.indicators.rsi.value && indicators.indicators.rsi.value > 70 
                    ? 'bg-red-50' 
                    : indicators.indicators.rsi.value && indicators.indicators.rsi.value < 30
                    ? 'bg-green-50'
                    : 'bg-gray-50'
                }`}>
                  <p className="text-sm text-gray-600">RSI 14</p>
                  <p className={`text-lg font-bold ${
                    indicators.indicators.rsi.value && indicators.indicators.rsi.value > 70 
                      ? 'text-red-900' 
                      : indicators.indicators.rsi.value && indicators.indicators.rsi.value < 30
                      ? 'text-green-900'
                      : 'text-gray-900'
                  }`}>
                    {indicators.indicators.rsi.value?.toFixed(1) || '—'}
                  </p>
                  {indicators.indicators.rsi.signal && (
                    <p className="text-xs mt-1 capitalize">{indicators.indicators.rsi.signal}</p>
                  )}
                </div>
                <div className="bg-orange-50 p-4 rounded">
                  <p className="text-sm text-gray-600">ATR 14</p>
                  <p className="text-lg font-bold text-orange-900">
                    {indicators.indicators.atr.value?.toFixed(2) || '—'}
                  </p>
                </div>
              </div>
              
              {/* MACD */}
              <div className="mt-4 bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600 mb-2">MACD</p>
                <div className="flex gap-6">
                  <span>MACD: <strong>{indicators.indicators.macd.macd?.toFixed(2) || '—'}</strong></span>
                  <span>Signal: <strong>{indicators.indicators.macd.signal?.toFixed(2) || '—'}</strong></span>
                  <span>Histogram: <strong className={
                    (indicators.indicators.macd.histogram || 0) > 0 ? 'text-green-600' : 'text-red-600'
                  }>{indicators.indicators.macd.histogram?.toFixed(2) || '—'}</strong></span>
                </div>
              </div>

              {/* Candlestick Patterns */}
              {indicators.indicators.candlestick.patterns.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-2">Recent Patterns</p>
                  <div className="flex flex-wrap gap-2">
                    {indicators.indicators.candlestick.patterns.slice(-3).map((pattern, idx) => (
                      <span key={idx} className={`px-3 py-1 rounded-full text-sm ${
                        pattern.type === 'bullish' ? 'bg-green-100 text-green-800' :
                        pattern.type === 'bearish' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {pattern.pattern} ({(pattern.confidence * 100).toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <SignalsPanel signals={signals} />
          
          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-3">Session Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Candles processed:</span>
                <span className="font-medium">{ticks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Signals detected:</span>
                <span className="font-medium">{signals.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Last update:</span>
                <span className="font-medium">
                  {indicators ? new Date(indicators.timestamp).toLocaleTimeString() : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;