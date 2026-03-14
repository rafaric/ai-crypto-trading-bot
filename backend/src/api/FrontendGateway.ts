import { WebSocketServer, WebSocket } from 'ws';
import { EventBus } from '../core/EventBus';
import { MarketTick, SignalGenerated } from '../../../shared/src/events';

export class FrontendGateway {
  private wss: WebSocketServer;
  private unsubscribeMarketTick: () => void;
  private unsubscribeSignalGenerated: () => void;

  constructor(private eventBus: EventBus, port: number = 8081) {
    this.wss = new WebSocketServer({ port });

    // Subscribe to events and broadcast them to all connected clients
    this.unsubscribeMarketTick = this.eventBus.subscribe<MarketTick>('MarketTick', (payload) => {
      this.broadcast('MarketTick', payload);
    });

    this.unsubscribeSignalGenerated = this.eventBus.subscribe<SignalGenerated>('SignalGenerated', (payload) => {
      this.broadcast('SignalGenerated', payload);
    });
  }

  private broadcast(type: string, payload: any) {
    const message = JSON.stringify({ type, payload });
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  public close() {
    this.unsubscribeMarketTick();
    this.unsubscribeSignalGenerated();
    this.wss.close();
  }
}
