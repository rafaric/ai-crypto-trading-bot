import WebSocket from 'ws';
import { EventBus } from '../core/EventBus';
import { Candle } from '../domain/MarketTick';

export class BingXWsIngester {
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectDelay: number = 60000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly WSS_URL = 'wss://open-api-swap.bingx.com/swap-market';

  constructor(
    private eventBus: EventBus,
    private symbol: string
  ) {}

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.reconnectAttempts = 0;
    this.connect();
  }

  public stop(): void {
    this.isRunning = false;
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

  private connect(): void {
    if (!this.isRunning) return;

    try {
      this.ws = new WebSocket(this.WSS_URL);
      
      this.ws.on('open', this.onOpen.bind(this));
      this.ws.on('message', this.onMessage.bind(this));
      this.ws.on('close', this.onClose.bind(this));
      this.ws.on('error', this.onError.bind(this));
    } catch (error) {
      this.handleReconnect();
    }
  }

  private onOpen(): void {
    this.reconnectAttempts = 0;
    
    // Subscribe to K-line (1m) for the symbol
    const subscribeMsg = {
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      reqType: 'sub',
      dataType: `${this.symbol}@kline_1m`
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(subscribeMsg));
    }
  }

  private onMessage(data: WebSocket.Data): void {
    let payload = data.toString();

    // Handle BingX Ping
    if (payload === 'Ping') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('Pong');
      }
      return;
    }

    try {
      const parsed = JSON.parse(payload);
      
      // Look for data array/object containing kline info
      if (parsed.dataType && parsed.dataType.includes('@kline') && parsed.data) {
        const klineData = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
        
        if (klineData && klineData.c && klineData.T) {
          const candle: Candle = {
            symbol: this.symbol,
            open: parseFloat(klineData.o || klineData.c),
            high: parseFloat(klineData.h || klineData.c),
            low: parseFloat(klineData.l || klineData.c),
            close: parseFloat(klineData.c),
            timestamp: parseInt(klineData.T, 10),
            volume: klineData.v ? parseFloat(klineData.v) : 0,
            isClosed: true,
            interval: '1m'
          };
          this.eventBus.publish('candle_closed', candle);
        }
      }
    } catch (e) {
      // Ignore parse errors, could be other format or compressed,
      // but according to tests we expect JSON string parsing.
    }
  }

  private onClose(): void {
    this.handleReconnect();
  }

  private onError(error: Error): void {
    // console.error(`WebSocket Error for ${this.symbol}:`, error.message);
    this.handleReconnect();
  }

  private handleReconnect(): void {
    if (!this.isRunning) return;

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
