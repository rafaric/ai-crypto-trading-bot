import { WebSocketServer, WebSocket } from 'ws';
import { EventBus } from '../core/EventBus';
import { Candle, SignalGenerated, Trade, AccountSummary } from '../../../shared/src/events';
import { IndicatorsUpdatedEvent } from '../engine/IndicatorEngine';
import { MarketRegimeEvent } from '../engine/MarketRegimeDetector';
import { PaperTradingEngine } from '../execution/PaperTradingEngine';

export class FrontendGateway {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private unsubscribeCandle: (() => void) | null = null;
  private unsubscribeIndicators: (() => void) | null = null;
  private unsubscribeSignal: (() => void) | null = null;
  private unsubscribeRegime: (() => void) | null = null;
  private unsubscribeTrade: (() => void) | null = null;
  private unsubscribeAccount: (() => void) | null = null;
  private candlesCache: Map<string, Candle[]> = new Map();
  private readonly MAX_CACHED_CANDLES = 300;
  private latestIndicators: Map<string, IndicatorsUpdatedEvent> = new Map();
  private latestRegimes: Map<string, MarketRegimeEvent> = new Map();

  constructor(private eventBus: EventBus, private paperTradingEngine: PaperTradingEngine, port: number = 8081) {
    this.wss = new WebSocketServer({ port });

    // Handle new WebSocket connections
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Frontend client connected');
      this.clients.add(ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        payload: { message: 'Connected to AI Trading Bot' }
      }));

      // Send cached candles to new client so they see full history
      let totalCandles = 0;
      for (const [symbol, candles] of this.candlesCache) {
        totalCandles += candles.length;
        for (const candle of candles) {
          ws.send(JSON.stringify({ type: 'candle_closed', payload: candle }));
        }
      }
      if (totalCandles > 0) {
        console.log(`📊 Sending ${totalCandles} historical candles (${this.candlesCache.size} pairs) to new client`);
      }

      // Send latest indicators state for all pairs
      for (const [symbol, indicators] of this.latestIndicators) {
        ws.send(JSON.stringify({ type: 'indicators_updated', payload: indicators }));
      }

      // Send latest market regimes for all pairs
      for (const [symbol, regime] of this.latestRegimes) {
        ws.send(JSON.stringify({ type: 'market_regime_changed', payload: regime }));
      }

      // Send current open positions to new client
      const allPositions = this.paperTradingEngine.getAllPositions();
      const openPositions: any[] = [];
      allPositions.forEach((positions, symbol) => {
        for (const pos of positions) {
          if (pos.status === 'OPEN') {
            openPositions.push({
              id: `${symbol}-${pos.timestamp}`,
              symbol,
              side: pos.action,
              entryPrice: pos.price,
              quantity: pos.quantity,
              stopLoss: pos.slPrice,
              takeProfit: pos.tpPrice,
              status: 'OPEN',
              openTime: pos.timestamp,
            });
          }
        }
      });
      if (openPositions.length > 0) {
        console.log(`📊 Sending ${openPositions.length} open positions to new client`);
        ws.send(JSON.stringify({ type: 'positions_update', payload: openPositions }));
      }

      // Heartbeat to detect dead connections
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000); // Ping every 30 seconds

      ws.on('pong', () => {
        // Client is alive
      });

      // Handle client disconnect
      ws.on('close', () => {
        console.log('🔌 Frontend client disconnected');
        clearInterval(heartbeat);
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        clearInterval(heartbeat);
        this.clients.delete(ws);
      });

      // Handle incoming messages from frontend
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'close_position') {
            const { positionId, symbol } = message.payload;
            console.log(`🔴 Close position request: ${symbol} (ID: ${positionId})`);
            
            const closedTrade = this.paperTradingEngine.closePosition(symbol, positionId);
            
            console.log('[DEBUG] FrontendGateway.closePosition result:', closedTrade);
            
            if (closedTrade) {
              // Send updated positions to all clients
              const allPositions = this.paperTradingEngine.getAllPositions();
              const openPositions: any[] = [];
              allPositions.forEach((positions, sym) => {
                for (const pos of positions) {
                  if (pos.status === 'OPEN') {
                    openPositions.push({
                      id: `${sym}-${pos.timestamp}`,
                      symbol: sym,
                      side: pos.action,
                      entryPrice: pos.price,
                      quantity: pos.quantity,
                      stopLoss: pos.slPrice,
                      takeProfit: pos.tpPrice,
                      status: 'OPEN',
                      openTime: pos.timestamp,
                    });
                  }
                }
              });
              console.log('[DEBUG] Broadcasting positions_update:', openPositions);
              this.broadcast('positions_update', openPositions);
            } else {
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: { message: `Failed to close position ${positionId}` }
              }));
            }
          }
        } catch (e) {
          console.error('Failed to parse client message:', e);
        }
      });
    });

    // Handle server errors
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log(`✅ Frontend Gateway listening on ws://localhost:${port}`);

    // Subscribe to events and broadcast them to all connected clients
    this.unsubscribeCandle = this.eventBus.subscribe<Candle>('candle_closed', (payload) => {
      // Add candle to cache per symbol for late-connecting clients
      const symbol = payload.symbol;
      if (!this.candlesCache.has(symbol)) {
        this.candlesCache.set(symbol, []);
      }
      const cache = this.candlesCache.get(symbol)!;
      cache.push(payload);
      if (cache.length > this.MAX_CACHED_CANDLES) {
        cache.shift();
      }
      this.broadcast('candle_closed', payload);
    });

    this.unsubscribeIndicators = this.eventBus.subscribe<IndicatorsUpdatedEvent>('indicators_updated', (payload) => {
      // Store latest indicators per symbol for late-connecting clients
      this.latestIndicators.set(payload.symbol, payload);
      this.broadcast('indicators_updated', payload);
    });

    this.unsubscribeSignal = this.eventBus.subscribe<SignalGenerated>('SignalGenerated', (payload) => {
      this.broadcast('SignalGenerated', payload);
    });

    this.unsubscribeRegime = this.eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', (payload) => {
      // Store latest regime per symbol for late-connecting clients
      this.latestRegimes.set(payload.symbol, payload);
      this.broadcast('market_regime_changed', payload);
    });

    this.unsubscribeTrade = this.eventBus.subscribe<Trade>('trade_executed', (payload) => {
      this.broadcast('trade_executed', payload);
    });

    this.unsubscribeAccount = this.eventBus.subscribe<AccountSummary>('account_update', (payload) => {
      this.broadcast('account_update', payload);
    });
  }

  private broadcast(type: string, payload: any) {
    const message = JSON.stringify({ type, payload });
    let sentCount = 0;

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    }

    // Log signal and regime broadcasts for debugging (candles are too frequent)
    if (type === 'SignalGenerated' || type === 'market_regime_changed') {
      console.log(`📡 Broadcast ${type} to ${sentCount} clients`);
    }
  }

  public close() {
    if (this.unsubscribeCandle) this.unsubscribeCandle();
    if (this.unsubscribeIndicators) this.unsubscribeIndicators();
    if (this.unsubscribeSignal) this.unsubscribeSignal();
    if (this.unsubscribeRegime) this.unsubscribeRegime();
    if (this.unsubscribeTrade) this.unsubscribeTrade();
    if (this.unsubscribeAccount) this.unsubscribeAccount();

    // Close all client connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    this.wss.close();
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}