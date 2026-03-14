import { EventBus } from './core/EventBus';
import { FrontendGateway } from './api/FrontendGateway';

console.log('Starting backend server...');

const eventBus = new EventBus();
const frontendGateway = new FrontendGateway(eventBus, 8081);

console.log('Backend server running. Frontend Gateway listening on ws://localhost:8081');

// Mock data generation for demo purposes
setInterval(() => {
  eventBus.publish('MarketTick', {
    symbol: 'BTC/USDT',
    price: 65000 + (Math.random() * 100 - 50),
    timestamp: Date.now(),
    volume: Math.random() * 5
  });
}, 2000);

setInterval(() => {
  eventBus.publish('SignalGenerated', {
    symbol: 'BTC/USDT',
    action: Math.random() > 0.5 ? 'BUY' : 'SELL',
    confidence: Math.random(),
    timestamp: Date.now()
  });
}, 5000);
