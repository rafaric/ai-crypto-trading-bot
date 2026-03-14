import WebSocket from 'ws';
import { EventBus } from '../core/EventBus';

export interface CandleData {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

/**
 * Binance WebSocket Client
 * Connects to Binance WebSocket API for real-time candle data
 * No authentication required for public streams
 */
export class BinanceWsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isClosed = false;
  private readonly maxReconnectDelay = 60000;
  private readonly baseReconnectDelay = 1000;

  constructor(
    private eventBus: EventBus,
    private symbol: string = 'btcusdt'
  ) {}

  public connect(): void {
    if (this.isClosed) {
      return;
    }

    // Binance WebSocket URL for kline/candle data (public, no auth needed)
    const wsUrl = `wss://stream.binance.com:9443/ws/${this.symbol}@kline_1m`;

    console.log(`🔌 Connecting to Binance WebSocket: ${this.symbol}@kline_1m`);

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

      // Binance kline format: { e: 'kline', E: timestamp, s: 'BTCUSDT', k: {...} }
      if (parsed.e === 'kline' && parsed.k) {
        const kline = parsed.k;
        
        // Only process completed candles (x: true)
        if (kline.x) {
          const candle: CandleData = {
            symbol: parsed.s || this.symbol.toUpperCase(),
            price: parseFloat(kline.c),
            timestamp: kline.T,
            volume: parseFloat(kline.v),
          };

          console.log(`🕯️ Binance candle: ${candle.symbol} @ $${candle.price.toFixed(2)}`);
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