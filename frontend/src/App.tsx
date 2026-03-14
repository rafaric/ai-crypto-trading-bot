import { ChartPanel } from './components/ChartPanel';
import { SignalsPanel } from './components/SignalsPanel';
import { useMarketData } from './hooks/useMarketData';

function App() {
  const { ticks, signals } = useMarketData();

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-800 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AI Crypto Trading Agent</h1>
        <p className="text-gray-600">Real-time market analysis and automated trading</p>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartPanel ticks={ticks} />
        </div>
        <div>
          <SignalsPanel signals={signals} />
        </div>
      </main>
    </div>
  );
}

export default App;
