// Load environment variables from .env file
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { EventBus } from './core/EventBus';
import { FrontendGateway } from './api/FrontendGateway';
import { IndicatorEngine } from './engine/IndicatorEngine';
import { PaperTradingEngine } from './execution/PaperTradingEngine';
import { ITradeRepository, Trade } from './infrastructure/db/ITradeRepository';
import { SignalGenerated, MarketTick } from '../../shared/src/events';
import { BinanceWsClient } from './infrastructure/BinanceWsClient';

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

// Use Binance WebSocket (public, no auth required) for real market data
console.log('🔌 Connecting to Binance WebSocket for real-time data...');
const binanceClient = new BinanceWsClient(eventBus, 'btcusdt');
binanceClient.connect();
console.log('✅ Connected to Binance WebSocket API\n');

console.log('🎯 The bot is now running!');
console.log('   - Mode: LIVE Binance Data');
console.log('   - Trading: Paper Trading Only (simulated)');
console.log('   - Open http://localhost:5173 to see the dashboard');
console.log('   - Watch for pattern detection signals in this terminal\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  indicatorEngine.unsubscribe();
  frontendGateway.close();
  binanceClient.close();
  console.log('✅ Binance WebSocket connection closed');
  console.log('✅ All components stopped');
  process.exit(0);
});