import { WebSocketServer, WebSocket } from 'ws';
import { EventBus } from '../core/EventBus';
import { Candle, SignalGenerated } from '../../../shared/src/events';
import { IndicatorsUpdatedEvent } from '../engine/IndicatorEngine';
import { MarketRegimeEvent } from '../engine/MarketRegimeDetector';

export class FrontendGateway {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private unsubscribeCandle: (() => void) | null = null;
  private unsubscribeIndicators: (() => void) | null = null;
  private unsubscribeSignal: (() => void) | null = null;
  private unsubscribeRegime: (() => void) | null = null;
  private candlesCache: Candle[] = [];
  private readonly MAX_CACHED_CANDLES = 200;
  private latestIndicators: IndicatorsUpdatedEvent | null = null;
  private latestRegime: MarketRegimeEvent | null = null;

  constructor(private eventBus: EventBus, port: number = 8081) {
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
      if (this.candlesCache.length > 0) {
        console.log(`📊 Sending ${this.candlesCache.length} historical candles to new client`);
        for (const candle of this.candlesCache) {
          ws.send(JSON.stringify({ type: 'candle_closed', payload: candle }));
        }
      }

      // Send latest indicators state if available
      if (this.latestIndicators) {
        ws.send(JSON.stringify({ type: 'indicators_updated', payload: this.latestIndicators }));
      }

      // Send latest market regime if available
      if (this.latestRegime) {
        ws.send(JSON.stringify({ type: 'market_regime_changed', payload: this.latestRegime }));
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
    });

    // Handle server errors
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    console.log(`✅ Frontend Gateway listening on ws://localhost:${port}`);

    // Subscribe to events and broadcast them to all connected clients
    this.unsubscribeCandle = this.eventBus.subscribe<Candle>('candle_closed', (payload) => {
      // Add candle to cache for late-connecting clients
      this.candlesCache.push(payload);
      if (this.candlesCache.length > this.MAX_CACHED_CANDLES) {
        this.candlesCache.shift();
      }
      this.broadcast('candle_closed', payload);
    });

    this.unsubscribeIndicators = this.eventBus.subscribe<IndicatorsUpdatedEvent>('indicators_updated', (payload) => {
      // Store latest indicators for late-connecting clients
      this.latestIndicators = payload;
      this.broadcast('indicators_updated', payload);
    });

    this.unsubscribeSignal = this.eventBus.subscribe<SignalGenerated>('SignalGenerated', (payload) => {
      this.broadcast('SignalGenerated', payload);
    });

    this.unsubscribeRegime = this.eventBus.subscribe<MarketRegimeEvent>('market_regime_changed', (payload) => {
      this.latestRegime = payload;
      this.broadcast('market_regime_changed', payload);
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

    // Always log candle, signal, and regime broadcasts for debugging
    if (type === 'candle_closed' || type === 'SignalGenerated' || type === 'market_regime_changed') {
      console.log(`📡 Broadcast ${type} to ${sentCount} clients`);
    }
  }

  public close() {
    if (this.unsubscribeCandle) this.unsubscribeCandle();
    if (this.unsubscribeIndicators) this.unsubscribeIndicators();
    if (this.unsubscribeSignal) this.unsubscribeSignal();
    if (this.unsubscribeRegime) this.unsubscribeRegime();

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