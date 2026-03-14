import { IExecutionEngine } from '../../../shared/src/interfaces';
import { SignalGenerated } from '../../../shared/src/events';
import { ITradeRepository, Trade } from '../infrastructure/db/ITradeRepository';
import { EventBus } from '../core/EventBus';

export class PaperTradingEngine implements IExecutionEngine {
  constructor(private tradeRepository: ITradeRepository) {}

  public async executeSignal(signal: SignalGenerated): Promise<boolean> {
    if (signal.action === 'HOLD') {
      return false;
    }

    // Simulate getting a current price. 
    const basePrice = 50000;
    
    // Simulate some slippage (e.g., 0.1% worse price)
    const slippage = signal.action === 'BUY' ? 1.001 : 0.999;
    const simulatedFillPrice = basePrice * slippage;

    const dummyTrade: Trade = {
      symbol: signal.symbol,
      action: signal.action,
      price: simulatedFillPrice,
      timestamp: Date.now(),
      simulated: true,
    };

    await this.tradeRepository.saveTrade(dummyTrade);

    return true;
  }

  public startListening(eventBus: EventBus): void {
    eventBus.subscribe<SignalGenerated>('SignalGenerated', (signal) => {
      this.executeSignal(signal).catch((err) => {
        console.error('PaperTradingEngine failed to execute signal:', err);
      });
    });
  }
}
