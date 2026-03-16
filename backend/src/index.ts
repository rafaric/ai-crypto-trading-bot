// Load environment variables from .env file
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import { EventBus } from './core/EventBus';
import { FrontendGateway } from './api/FrontendGateway';
import { IndicatorEngine } from './engine/IndicatorEngine';
import { MarketRegimeDetector, MarketRegimeEvent } from './engine/MarketRegimeDetector';
import { PaperTradingEngine } from './execution/PaperTradingEngine';
import { ITradeRepository, Trade } from './infrastructure/db/ITradeRepository';
import { SignalGenerated, Candle } from '../../shared/src/events';
import { BinanceWsClient } from './infrastructure/BinanceWsClient';
import { BinanceRestClient } from './infrastructure/BinanceRestClient';
import { BinanceRestClient1H } from './infrastructure/BinanceRestClient1H';
import { TelegramService } from './services/TelegramService';

// Simple in-memory trade repository for demo
class InMemoryTradeRepository implements ITradeRepository {
  private trades: Trade[] = [];

  async saveTrade(trade: Trade): Promise<void> {
    this.trades.push(trade);
  }

  getTrades(): Trade[] {
    return [...this.trades];
  }
}

console.log('🚀 Starting AI Crypto Trading Bot with Multi-Pair Support...\n');

// Parse trading pairs from environment
const tradingPairsEnv = process.env.TRADING_PAIRS || 'BTCUSDT,ETHUSDT,SOLUSDT';
const tradingPairs = tradingPairsEnv.split(',').map(s => s.trim().toLowerCase());
console.log(`📊 Configured trading pairs: ${tradingPairs.join(', ')}`);

// Initialize core components
const eventBus = new EventBus();

// Initialize PaperTradingEngine first (needed by FrontendGateway)
const tradeRepository = new InMemoryTradeRepository();
const paperTradingEngine = new PaperTradingEngine(tradeRepository);

// Initialize FrontendGateway with PaperTradingEngine reference
const frontendGateway = new FrontendGateway(eventBus, paperTradingEngine, 8081);

// Initialize IndicatorEngine with multi-pair support
const indicatorEngine = new IndicatorEngine(eventBus);
console.log('✅ IndicatorEngine initialized - multi-pair support enabled');
console.log('   Calculating EMA, VWAP, RSI, MACD, ATR, Patterns independently for each pair');

// Initialize MarketRegimeDetector with multi-pair support
const regimeDetector = new MarketRegimeDetector(eventBus);
console.log('✅ MarketRegimeDetector initialized - tracking regime per pair');
console.log('   Listening to 1H regime updates with EMA200 + ADX for each pair');

// Start PaperTradingEngine event listening
paperTradingEngine.startListening(eventBus);
console.log('✅ PaperTradingEngine initialized - multi-pair execution enabled');
console.log('   Max 3 concurrent trades across all pairs\n');

// Initialize Telegram Service for notifications
const telegramService = new TelegramService();
const telegramConfigured = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID;

// Flag to ensure welcome message is sent only once (even on reconnections)
let telegramWelcomeSent = false;

if (telegramConfigured) {
  console.log('📱 Telegram notifications enabled');
  if (!telegramWelcomeSent) {
    telegramWelcomeSent = true;
    telegramService.sendMessage(`🤖 <b>AI Crypto Trading Bot</b> iniciado

✅ Multi-Pair Support activo
✅ Pares: ${tradingPairs.map(p => p.toUpperCase()).join(', ')}
✅ Paper Trading activo
✅ Max 3 trades concurrentes
✅ Listo para detectar señales`);
  }
} else {
  console.log('⚠️  Telegram not configured - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
}

// Subscribe to events to log activity per pair
const candleCounts: Map<string, number> = new Map();
const signalCounts: Map<string, number> = new Map();
let candleCounter = 0;

eventBus.subscribe<Candle>('candle_closed', (candle) => {
  const symbol = candle.symbol;
  const currentCount = candleCounts.get(symbol) || 0;
  candleCounts.set(symbol, currentCount + 1);
  candleCounter++;
  
  const totalCandles = Array.from(candleCounts.values()).reduce((a, b) => a + b, 0);
  const totalSignals = Array.from(signalCounts.values()).reduce((a, b) => a + b, 0);
  
  // Log summary every 50 candles instead of every candle
  if (candleCounter % 50 === 0) {
    process.stdout.write(`\r📊 Total candles: ${totalCandles} | Total signals: ${totalSignals} | Active pairs: ${candleCounts.size}`);
  }
  
  // Update market data for Telegram summary
  telegramService.updateMarketData(symbol, candle.close, null);
});

eventBus.subscribe('indicators_updated', (event) => {
  // Indicators calculated per pair - this happens automatically
  // Could log per-pair indicator updates here if needed
});

eventBus.subscribe<SignalGenerated>('SignalGenerated', async (signal) => {
  const symbol = signal.symbol;
  const currentCount = signalCounts.get(symbol) || 0;
  signalCounts.set(symbol, currentCount + 1);
  
  const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
  console.log(`\n${emoji} SIGNAL DETECTED for ${symbol}!`);
  console.log(`   Action: ${signal.action}`);
  console.log(`   Strategy: ${signal.strategy || 'Unknown'}`);
  console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
  console.log(`   Time: ${new Date(signal.timestamp).toLocaleTimeString()}`);

  // Send Telegram notification
  await telegramService.sendSignalAlert(signal);
});

// Subscribe to market regime changes for logging per pair
eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', (regime) => {
  const regimeEmoji = regime.regime === 'TRENDING_UP' ? '📈' :
                      regime.regime === 'TRENDING_DOWN' ? '📉' : '➡️';
  console.log(`\n${regimeEmoji} MARKET REGIME CHANGE for ${regime.symbol}`);
  console.log(`   Regime: ${regime.regime}`);
  console.log(`   Direction: ${regime.trendDirection}`);
  console.log(`   Confidence: ${(regime.confidence * 100).toFixed(1)}%`);
  console.log(`   EMA200: $${regime.ema200?.toFixed(2) || 'N/A'}`);
  console.log(`   ADX14: ${regime.adx14?.toFixed(2) || 'N/A'}`);
  
  // Update market regime for Telegram summary
  const currentData = telegramService['marketData'].get(regime.symbol);
  telegramService.updateMarketData(
    regime.symbol,
    currentData?.price || regime.price || 0,
    regime.regime
  );
});

// Track recent trades to prevent spam
type TradeKey = string;
const recentTrades: Map<TradeKey, number> = new Map();
const TRADE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

eventBus.subscribe<Trade>('trade_executed', async (trade) => {
  console.log(`\n💰 PAPER TRADE EXECUTED!`);
  console.log(`   Symbol: ${trade.symbol}`);
  console.log(`   Side: ${trade.action}`);
  console.log(`   Entry: $${trade.price.toFixed(2)}`);
  console.log(`   Simulated: ${trade.simulated}`);
  
  // Check cooldown to prevent Telegram spam
  const tradeKey: TradeKey = `${trade.symbol}-${trade.action}`;
  const lastTradeTime = recentTrades.get(tradeKey);
  const now = Date.now();
  
  if (lastTradeTime && now - lastTradeTime < TRADE_COOLDOWN_MS) {
    const remainingSeconds = Math.ceil((TRADE_COOLDOWN_MS - (now - lastTradeTime)) / 1000);
    console.log(`⏱️  Trade notification skipped (cooldown): ${remainingSeconds}s remaining`);
    return;
  }
  
  // Update last trade time
  recentTrades.set(tradeKey, now);
  
  // Record trade for daily summary
  telegramService.recordTrade(trade.symbol, trade.action, trade.price, 0);
  
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

// Binance clients (defined here for access in shutdown handler)
let binanceWsClient: BinanceWsClient | null = null;
let binanceRestClient1H: BinanceRestClient1H | null = null;

// Fetch historical candles before connecting WebSocket for ALL pairs
async function bootstrap(): Promise<void> {
  console.log('📚 Loading historical 5m candles for all pairs...\n');
  
  // Fetch historical data for each pair in parallel
  const historicalPromises = tradingPairs.map(async (pair, index) => {
    const symbol = pair.toUpperCase();
    console.log(`   [${index + 1}/${tradingPairs.length}] Loading ${symbol}...`);
    
    const restClient = new BinanceRestClient({
      symbol: symbol,
      interval: '5m',
      limit: 300,
    });

    try {
      const historicalCandles = await restClient.fetchWithProgress(
        (current, total) => {
          process.stdout.write(`\r   Loading ${symbol}: ${current}/${total}`);
        }
      );

      console.log(`\r   ✅ ${symbol}: ${historicalCandles.length} candles loaded`);

      // Publish all historical candles to pre-populate IndicatorEngine
      for (const candle of historicalCandles) {
        eventBus.publish('candle_closed', { ...candle, isHistorical: true });
      }
      
      return { symbol, count: historicalCandles.length, success: true };
    } catch (error) {
      console.error(`\r   ❌ ${symbol}: Failed to load historical candles`, error);
      return { symbol, count: 0, success: false };
    }
  });

  const results = await Promise.all(historicalPromises);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Historical data loaded: ${successful.length}/${tradingPairs.length} pairs`);
  if (failed.length > 0) {
    console.log(`⚠️  Failed pairs: ${failed.map(f => f.symbol).join(', ')}`);
    console.log('   Continuing without historical data for those pairs (indicators will need warm-up)\n');
  }

  // Initialize 1H REST client for macro trend analysis (all pairs)
  console.log('🔌 Initializing Binance REST Client for 1H macro trend analysis...');
  binanceRestClient1H = new BinanceRestClient1H(eventBus, {
    symbols: tradingPairs.map(p => p.toUpperCase()),
    pollingIntervalMinutes: 60,
    candleLimit: 200,
  });
  binanceRestClient1H.start();
  console.log('✅ Binance REST Client (1H) initialized - polling every 60 minutes for all pairs\n');

  // Connect WebSocket for real-time 5m updates for ALL pairs
  console.log('🔌 Connecting to Binance WebSocket for real-time 5m data...');
  console.log(`   Monitoring: ${tradingPairs.join(', ')}`);
  binanceWsClient = new BinanceWsClient(eventBus, tradingPairs, '5m');
  binanceWsClient.connect();
  console.log('✅ Connected to Binance WebSocket API (5m candles)\n');
}

// Start the bootstrap process
bootstrap();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  indicatorEngine.unsubscribe();
  regimeDetector.unsubscribe();
  paperTradingEngine.stopListening();
  frontendGateway.close();
  telegramService.stop();
  if (binanceWsClient) {
    binanceWsClient.close();
    console.log('✅ Binance WebSocket connection closed');
  }
  if (binanceRestClient1H) {
    binanceRestClient1H.stop();
    console.log('✅ Binance REST Client (1H) stopped');
  }
  console.log('✅ All components stopped');
  process.exit(0);
});