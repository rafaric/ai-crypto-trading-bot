import { ChartPanel } from './components/ChartPanel';
import { SignalsPanel } from './components/SignalsPanel';
import { MarketRegimePanel } from './components/MarketRegimePanel';
import { PairSelector } from './components/PairSelector';
import { PairSummary } from './components/PairSummary';
import { useMarketData } from './hooks/useMarketData';

function App() {
  const {
    allPairs,
    selectedPair,
    setSelectedPair,
    currentPairData,
    signals,
    indicators,
    marketRegime,
    connected,
    isLoading,
  } = useMarketData();

  // Convert Map to array for PairSelector
  const pairsArray = Array.from(allPairs.values()).map((pair) => ({
    symbol: pair.symbol,
    price: pair.currentPrice,
    change24h: pair.change24h,
    regime: pair.regime?.regime || null,
  }));

  // Calculate total candles
  const totalCandles = Array.from(allPairs.values()).reduce(
    (sum, pair) => sum + pair.ticks.length,
    0
  );

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-800 font-sans">
      <header className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              AI Crypto Trading Agent
            </h1>
            <p className="text-slate-600 text-sm md:text-base">
              Real-time market analysis and automated trading
            </p>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium self-start md:self-auto ${
              connected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {connected ? '● Connected' : '○ Disconnected'}
          </div>
        </div>
      </header>

      {/* Pair Selector - Mobile Dropdown / Desktop Tabs */}
      <div className="mb-6">
        <PairSelector
          pairs={pairsArray}
          selectedPair={selectedPair}
          onSelect={setSelectedPair}
          isLoading={isLoading}
        />
      </div>

      {/* Optional: Mini Pair Summary Cards */}
      <div className="mb-6">
        <PairSummary
          pairs={pairsArray}
          selectedPair={selectedPair}
          onSelect={setSelectedPair}
        />
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column: Chart and Indicators */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Chart Panel */}
          <ChartPanel
            selectedPair={selectedPair}
            candles={currentPairData.ticks}
            indicators={
              indicators
                ? {
                    ema: indicators.indicators.ema?.value,
                    emaSeries: indicators.indicators.ema?.series,
                    vwap: indicators.indicators.vwap?.value,
                    vwapSeries: indicators.indicators.vwap?.series,
                  }
                : undefined
            }
          />

          {/* Indicators Panel */}
          {indicators ? (
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-4">
                Technical Indicators - {selectedPair.replace('USDT', '/USDT')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-blue-50 p-3 md:p-4 rounded">
                  <p className="text-xs md:text-sm text-slate-600">EMA 200</p>
                  <p className="text-base md:text-lg font-bold text-blue-900">
                    {indicators.indicators.ema.value?.toFixed(2) || '—'}
                  </p>
                </div>
                <div className="bg-purple-50 p-3 md:p-4 rounded">
                  <p className="text-xs md:text-sm text-slate-600">VWAP</p>
                  <p className="text-base md:text-lg font-bold text-purple-900">
                    {indicators.indicators.vwap.value?.toFixed(2) || '—'}
                  </p>
                </div>
                <div
                  className={`p-3 md:p-4 rounded ${
                    indicators.indicators.rsi.value &&
                    indicators.indicators.rsi.value > 70
                      ? 'bg-red-50'
                      : indicators.indicators.rsi.value &&
                        indicators.indicators.rsi.value < 30
                      ? 'bg-green-50'
                      : 'bg-slate-50'
                  }`}
                >
                  <p className="text-xs md:text-sm text-slate-600">RSI 14</p>
                  <p
                    className={`text-base md:text-lg font-bold ${
                      indicators.indicators.rsi.value &&
                      indicators.indicators.rsi.value > 70
                        ? 'text-red-900'
                        : indicators.indicators.rsi.value &&
                          indicators.indicators.rsi.value < 30
                        ? 'text-green-900'
                        : 'text-slate-900'
                    }`}
                  >
                    {indicators.indicators.rsi.value?.toFixed(1) || '—'}
                  </p>
                  {indicators.indicators.rsi.signal && (
                    <p className="text-xs mt-1 capitalize">
                      {indicators.indicators.rsi.signal}
                    </p>
                  )}
                </div>
                <div className="bg-orange-50 p-3 md:p-4 rounded">
                  <p className="text-xs md:text-sm text-slate-600">ATR 14</p>
                  <p className="text-base md:text-lg font-bold text-orange-900">
                    {indicators.indicators.atr.value?.toFixed(2) || '—'}
                  </p>
                </div>
              </div>

              {/* MACD */}
              <div className="mt-4 bg-slate-50 p-3 md:p-4 rounded">
                <p className="text-xs md:text-sm text-slate-600 mb-2">MACD</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    MACD:{' '}
                    <strong>
                      {indicators.indicators.macd.macd?.toFixed(2) || '—'}
                    </strong>
                  </span>
                  <span>
                    Signal:{' '}
                    <strong>
                      {indicators.indicators.macd.signal?.toFixed(2) || '—'}
                    </strong>
                  </span>
                  <span>
                    Histogram:{' '}
                    <strong
                      className={
                        (indicators.indicators.macd.histogram || 0) > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {indicators.indicators.macd.histogram?.toFixed(2) || '—'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Candlestick Patterns */}
              {indicators.indicators.candlestick.patterns.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs md:text-sm text-slate-600 mb-2">
                    Recent Patterns
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {indicators.indicators.candlestick.patterns
                      .slice(-3)
                      .map((pattern, idx) => (
                        <span
                          key={idx}
                          className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm ${
                            pattern.type === 'bullish'
                              ? 'bg-green-100 text-green-800'
                              : pattern.type === 'bearish'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {pattern.pattern} (
                          {(pattern.confidence * 100).toFixed(0)}%)
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-4">
                Technical Indicators - {selectedPair.replace('USDT', '/USDT')}
              </h2>
              <div className="flex items-center justify-center h-32 text-slate-500">
                <div className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
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
                  Loading indicators...
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Market Regime, Signals, Stats */}
        <div className="space-y-4 md:space-y-6">
          <MarketRegimePanel
            selectedPair={selectedPair}
            regime={marketRegime}
          />
          <SignalsPanel selectedPair={selectedPair} signals={signals} />

          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3">
              Session Stats
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Active Pair:</span>
                <span className="font-medium">
                  {selectedPair.replace('USDT', '/USDT')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Candles (this pair):</span>
                <span className="font-medium">
                  {currentPairData.ticks.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total candles:</span>
                <span className="font-medium">{totalCandles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Signals (this pair):</span>
                <span className="font-medium">{signals.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Last update:</span>
                <span className="font-medium">
                  {indicators
                    ? new Date(indicators.timestamp).toLocaleTimeString()
                    : '—'}
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
