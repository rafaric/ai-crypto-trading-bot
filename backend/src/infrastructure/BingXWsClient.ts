import WebSocket from 'ws';
import crypto from 'crypto';
import { EventBus } from '../core/EventBus';

export interface CandleData {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

export class BingXWsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isClosed = false;
  private readonly maxReconnectDelay = 60000;
  private readonly baseReconnectDelay = 1000;

  constructor(
    private eventBus: EventBus,
    private symbol: string
  ) {}

  public connect(): void {
    if (this.isClosed) {
      return;
    }

    const apiKey = process.env.BINGX_API_KEY;
    const apiSecret = process.env.BINGX_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('BINGX_API_KEY and BINGX_API_SECRET must be set');
    }

    const timestamp = Date.now();
    const signature = this.generateSignature(apiSecret, timestamp);
    const wsUrl = `wss://open-api-swap.bingx.com/ws?apiKey=${apiKey}&timestamp=${timestamp}&signature=${signature}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('close', this.onClose.bind(this));
      this.ws.on('error', this.onError.bind(this));
    } catch (error) {
      this.handleReconnect();
    }
  }

  private generateSignature(apiSecret: string, timestamp: number): string {
    const message = `apiKey=${process.env.BINGX_API_KEY}&timestamp=${timestamp}`;
    return crypto
      .createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');
  }

  private onOpen(): void {
    this.reconnectAttempts = 0;

    const subscribeMsg = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      reqType: 'sub',
      dataType: `${this.symbol}@kline_1m`,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscribeMsg));
    }
  }

  private onMessage(data: WebSocket.Data): void {
    const payload = data.toString();

    // Handle ping
    if (payload === 'Ping') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('Pong');
      }
      return;
    }

    try {
      const parsed = JSON.parse(payload);
      
      // Debug: log all received messages
      console.log('📡 BingX message:', JSON.stringify(parsed).substring(0, 200));

      // Parse kline/candle data
      if (parsed.e === 'kline' && parsed.k) {
        const kline = parsed.k;
        const candle: CandleData = {
          symbol: parsed.s || this.symbol,
          price: parseFloat(kline.c),
          timestamp: kline.t,
          volume: parseFloat(kline.v),
        };

        console.log('🕯️ Candle received:', candle.symbol, '$' + candle.price, 'Vol:', candle.volume);
        this.eventBus.publish('candle_closed', candle);
      } else if (parsed.code !== undefined) {
        // Log response to subscription
        console.log('📋 BingX response:', parsed);
      }
    } catch (error) {
      console.error('❌ Failed to parse BingX message:', error);
    }
  }

  private onClose(): void {
    if (!this.isClosed) {
      this.handleReconnect();
    }
  }

  private onError(error: Error): void {
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
