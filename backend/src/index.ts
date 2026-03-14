import { EventBus } from './core/EventBus';
import { FrontendGateway } from './api/FrontendGateway';
import { IndicatorEngine } from './engine/IndicatorEngine';
import { PaperTradingEngine } from './execution/PaperTradingEngine';
import { ITradeRepository, Trade } from './infrastructure/db/ITradeRepository';
import { SignalGenerated, MarketTick } from '../../shared/src/events';
import { BingXWsClient } from './infrastructure/BingXWsClient';

// Simple in-memory trade repository for demo
class InMemoryTradeRepository implements ITradeRepository {
  private trades: Trade[] = [];

  async saveTrade(trade: Trade): Promise<void> {
    this.trades.push(trade);
    eventBus.publish('trade_executed', trade);
  }

  getTrades(): Trade[] {
    return [...this.trades];
  }
}

console.log('🚀 Starting AI Crypto Trading Bot...\n');

// Initialize core components
const eventBus = new EventBus();
const frontendGateway = new FrontendGateway(eventBus, 8081);

// Initialize IndicatorEngine (the brain)
const indicatorEngine = new IndicatorEngine(eventBus);
console.log('✅ IndicatorEngine initialized - calculating EMA, VWAP, RSI, MACD, ATR, Patterns');

// Initialize PaperTradingEngine (simulated execution)
const tradeRepository = new InMemoryTradeRepository();
const paperTradingEngine = new PaperTradingEngine(tradeRepository);
paperTradingEngine.startListening(eventBus);
console.log('✅ PaperTradingEngine initialized - ready to simulate trades\n');

// Subscribe to events to log activity
let candleCount = 0;
let signalCount = 0;

eventBus.subscribe<MarketTick>('candle_closed', (candle) => {
  candleCount++;
  process.stdout.write(`\r📊 Candles processed: ${candleCount} | Signals detected: ${signalCount}`);
});

eventBus.subscribe('indicators_updated', () => {
  // Indicators calculated - this happens automatically
});

eventBus.subscribe<SignalGenerated>('SignalGenerated', (signal) => {
  signalCount++;
  const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
  console.log(`\n${emoji} SIGNAL DETECTED!`);
  console.log(`   Symbol: ${signal.symbol}`);
  console.log(`   Action: ${signal.action}`);
  console.log(`   Strategy: ${signal.strategy || 'Unknown'}`);
  console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
  console.log(`   Time: ${new Date(signal.timestamp).toLocaleTimeString()}`);
});

eventBus.subscribe<Trade>('trade_executed', (trade) => {
  console.log(`\n💰 PAPER TRADE EXECUTED!`);
  console.log(`   Symbol: ${trade.symbol}`);
  console.log(`   Side: ${trade.action}`);
  console.log(`   Entry: $${trade.price.toFixed(2)}`);
  console.log(`   Simulated: ${trade.simulated}`);
});

console.log('✅ Frontend Gateway listening on ws://localhost:8081');
console.log('✅ All systems connected and running\n');

// Determine data source: Real BingX or Mock
let bingxClient: BingXWsClient | null = null;
let mockDataInterval: NodeJS.Timeout | null = null;
const hasBingXCredentials = process.env.BINGX_API_KEY && process.env.BINGX_API_SECRET;

if (hasBingXCredentials) {
  console.log('🔑 BingX API credentials found - connecting to real market data...');
  bingxClient = new BingXWsClient(eventBus, 'BTC-USDT');
  bingxClient.connect();
  console.log('✅ Connected to BingX WebSocket API\n');
} else {
  console.log('⚠️  No BingX API credentials found - using mock data');
  console.log('   Set BINGX_API_KEY and BINGX_API_SECRET in .env for real data\n');
}

// Generate realistic mock candle data (only if no BingX credentials)
let basePrice = 65000;
let trend = 1; // 1 for up, -1 for down

if (!hasBingXCredentials) {
  console.log('📈 Starting mock data generation...');
  console.log('   (Generating realistic candles to test pattern detection)\n');

  mockDataInterval = setInterval(() => {
    // Random walk with some trend persistence
    const change = (Math.random() - 0.5) * 200;

    // Occasionally change trend
    if (Math.random() < 0.1) {
      trend *= -1;
    }

    basePrice += change + (trend * 50);

    // Ensure price doesn't go negative or too low
    basePrice = Math.max(1000, basePrice);

    const candle = {
      symbol: 'BTC/USDT',
      price: basePrice,
      timestamp: Date.now(),
      volume: 0.5 + Math.random() * 4.5
    };

    eventBus.publish('candle_closed', candle);
  }, 2000);

  // Pre-load historical candles to initialize indicators
  console.log('\n📚 Pre-loading 250 historical candles...');
  let histPrice = 65000;
  for (let i = 0; i < 250; i++) {
    const change = (Math.random() - 0.5) * 150;
    histPrice += change;
    histPrice = Math.max(1000, histPrice);

    eventBus.publish<MarketTick>('candle_closed', {
      symbol: 'BTC/USDT',
      price: histPrice,
      timestamp: Date.now() - (250 - i) * 60000, // 1 min apart
      volume: 0.5 + Math.random() * 4.5
    });
  }
  console.log('✅ Historical data loaded - indicators initialized\n');
}

console.log('🎯 The bot is now running!');
console.log('   - Mode: ' + (hasBingXCredentials ? 'LIVE BingX Data' : 'MOCK Data'));
console.log('   - Trading: Paper Trading Only (simulated)');
console.log('   - Open http://localhost:5173 to see the dashboard');
console.log('   - Watch for pattern detection signals in this terminal\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  indicatorEngine.unsubscribe();
  frontendGateway.close();
  
  if (bingxClient) {
    bingxClient.close();
    console.log('✅ BingX WebSocket connection closed');
  }
  
  if (mockDataInterval) {
    clearInterval(mockDataInterval);
  }
  
  console.log('✅ All components stopped');
  process.exit(0);
});