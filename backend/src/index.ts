// Load environment variables from .env file
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { EventBus } from './core/EventBus';
import { FrontendGateway } from './api/FrontendGateway';
import { IndicatorEngine } from './engine/IndicatorEngine';
import { PaperTradingEngine } from './execution/PaperTradingEngine';
import { ITradeRepository, Trade } from './infrastructure/db/ITradeRepository';
import { SignalGenerated, Candle } from '../../shared/src/events';
import { BinanceWsClient } from './infrastructure/BinanceWsClient';
import { BinanceRestClient } from './infrastructure/BinanceRestClient';
import { TelegramService } from './services/TelegramService';

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

// Initialize Telegram Service for notifications
const telegramService = new TelegramService();
const telegramConfigured = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;

// Flag to ensure welcome message is sent only once (even on reconnections)
let telegramWelcomeSent = false;

if (telegramConfigured) {
  console.log('📱 Telegram notifications enabled');
  if (!telegramWelcomeSent) {
    telegramWelcomeSent = true;
    telegramService.sendMessage('🤖 <b>AI Crypto Trading Bot</b> iniciado\n\n✅ Conectado a Binance\n✅ Paper Trading activo\n✅ Listo para detectar señales');
  }
} else {
  console.log('⚠️  Telegram not configured - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
}

// Subscribe to events to log activity
let candleCount = 0;
let signalCount = 0;

eventBus.subscribe<Candle>('candle_closed', (candle) => {
  candleCount++;
  process.stdout.write(`\r📊 Candles processed: ${candleCount} | Signals detected: ${signalCount}`);
});

eventBus.subscribe('indicators_updated', () => {
  // Indicators calculated - this happens automatically
});

eventBus.subscribe<SignalGenerated>('SignalGenerated', async (signal) => {
  signalCount++;
  const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
  console.log(`\n${emoji} SIGNAL DETECTED!`);
  console.log(`   Symbol: ${signal.symbol}`);
  console.log(`   Action: ${signal.action}`);
  console.log(`   Strategy: ${signal.strategy || 'Unknown'}`);
  console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
  console.log(`   Time: ${new Date(signal.timestamp).toLocaleTimeString()}`);
  
  // Send Telegram notification
  await telegramService.sendSignalAlert(signal);
});

// Track recent trades to prevent spam
const recentTrades: Map<string, number> = new Map();
const TRADE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

eventBus.subscribe<Trade>('trade_executed', async (trade) => {
  console.log(`\n💰 PAPER TRADE EXECUTED!`);
  console.log(`   Symbol: ${trade.symbol}`);
  console.log(`   Side: ${trade.action}`);
  console.log(`   Entry: $${trade.price.toFixed(2)}`);
  console.log(`   Simulated: ${trade.simulated}`);
  
  // Check cooldown to prevent Telegram spam
  const tradeKey = `${trade.symbol}-${trade.action}`;
  const lastTradeTime = recentTrades.get(tradeKey);
  const now = Date.now();
  
  if (lastTradeTime && now - lastTradeTime < TRADE_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((TRADE_COOLDOWN_MS - (now - lastTradeTime)) / 1000);
    console.log(`⏱️  Trade notification skipped (cooldown): ${remainingSeconds}s remaining`);
    return;
  }
  
  // Update last trade time
  recentTrades.set(tradeKey, now);
  
  // Send Telegram notification
  await telegramService.sendTradeNotification({
    symbol: trade.symbol,
    side: trade.action,
    amount: 0.01, // Simulated amount for demo
    price: trade.price,
    total: 0.01 * trade.price, // Simulated total
    timestamp: trade.timestamp,
  });
});

console.log('✅ Frontend Gateway listening on ws://localhost:8081');
console.log('✅ All systems connected and running\n');

// Binance WebSocket client (defined here for access in shutdown handler)
let binanceClient: BinanceWsClient | null = null;

// Fetch historical candles before connecting WebSocket
async function bootstrap(): Promise<void> {
  console.log('📚 Loading historical candles for indicator pre-calculation...');
  
  const restClient = new BinanceRestClient({
    symbol: 'BTCUSDT',
    interval: '1m',
    limit: 200,
  });

  try {
    const historicalCandles = await restClient.fetchWithProgress(
      (current, total) => {
        process.stdout.write(`\r   Loading ${total} historical candles... ${current}/${total}`);
      }
    );

    console.log('\n✅ Historical candles loaded\n');

    // Publish all historical candles to pre-populate IndicatorEngine
    console.log('📤 Publishing historical candles to indicator engine...');
    for (const candle of historicalCandles) {
      eventBus.publish('candle_closed', candle);
    }
    console.log(`✅ Published ${historicalCandles.length} historical candles\n`);
  } catch (error) {
    console.error('❌ Failed to load historical candles:', error);
    console.log('⚠️  Continuing without historical data (indicators will need warm-up)\n');
  }

  // Connect WebSocket for real-time updates (regardless of whether historical fetch succeeded)
  console.log('🔌 Connecting to Binance WebSocket for real-time data...');
  binanceClient = new BinanceWsClient(eventBus, 'btcusdt');
  binanceClient.connect();
  console.log('✅ Connected to Binance WebSocket API\n');
}

// Start the bootstrap process
bootstrap();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  indicatorEngine.unsubscribe();
  frontendGateway.close();
  if (binanceClient) {
    binanceClient.close();
    console.log('✅ Binance WebSocket connection closed');
  }
  console.log('✅ All components stopped');
  process.exit(0);
});