import WebSocket from 'ws';
import { EventBus } from '../core/EventBus';
import { Candle } from '../domain/MarketTick';

/**
 * Binance WebSocket Client
 * Connects to Binance WebSocket API for real-time candle data
 * Supports multiple trading pairs via combined stream
 * No authentication required for public streams
 */
export class BinanceWsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isClosed = false;
  private readonly maxReconnectDelay = 60000;
  private readonly baseReconnectDelay = 1000;
  private currentCandles: Map<string, Candle> = new Map();

  constructor(
    private eventBus: EventBus,
    private symbols: string[] = ['btcusdt'],
    private interval: string = '5m'
  ) {}

  public connect(): void {
    if (this.isClosed) {
      return;
    }

    // Binance combined stream URL for multiple pairs
    const streamNames = this.symbols.map(s => `${s.toLowerCase()}@kline_${this.interval}`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamNames}`;

    console.log(`🔌 Connecting to Binance WebSocket: ${this.symbols.length} pairs @ ${this.interval}`);

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('close', this.onClose.bind(this));
      this.ws.on('error', this.onError.bind(this));
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.handleReconnect();
    }
  }

  private onOpen(): void {
    console.log('✅ Connected to Binance WebSocket');
    this.reconnectAttempts = 0;
  }

  private onMessage(data: WebSocket.Data): void {
    try {
      const parsed = JSON.parse(data.toString());

      // Binance combined stream format: { stream: 'btcusdt@kline_5m', data: { e: 'kline', ... } }
      // Or single stream format: { e: 'kline', E: timestamp, s: 'BTCUSDT', k: {...} }
      const eventData = parsed.data || parsed;
      
      if (eventData.e === 'kline' && eventData.k) {
        const kline = eventData.k;
        const symbol = eventData.s || parsed.stream?.split('@')[0]?.toUpperCase() || 'UNKNOWN';
        
        const candle: Candle = {
          symbol: symbol,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          timestamp: kline.t,
          volume: parseFloat(kline.v),
          isClosed: kline.x,
          interval: kline.i,
        };

        // Track current candle for real-time updates per symbol
        this.currentCandles.set(candle.symbol, candle);

        // Emit only when candle closes (isClosed: true)
        if (candle.isClosed) {
          this.eventBus.publish('candle_closed', candle);
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse Binance message:', error);
    }
  }

  private onClose(): void {
    console.log('❌ Binance WebSocket closed');
    if (!this.isClosed) {
      this.handleReconnect();
    }
  }

  private onError(error: Error): void {
    console.error('❌ Binance WebSocket error:', error);
    // Trigger reconnection on error
    this.handleReconnect();
  }

  private handleReconnect(): void {
    if (this.isClosed) {
      return;
    }

    // Clean up existing connection
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;
    console.log(`🔄 Reconnecting to Binance in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public getCurrentCandle(symbol?: string): Candle | null {
    if (symbol) {
      return this.currentCandles.get(symbol.toUpperCase()) || null;
    }
    // Return first available candle if no symbol specified
    return this.currentCandles.values().next().value || null;
  }

  public getCurrentCandles(): Map<string, Candle> {
    return new Map(this.currentCandles);
  }

  public close(): void {
    this.isClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }
}
