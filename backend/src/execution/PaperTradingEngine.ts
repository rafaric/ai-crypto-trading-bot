import { IExecutionEngine } from '../../../shared/src/interfaces';
import { SignalGenerated } from '../../../shared/src/events';
import { ITradeRepository, Trade } from '../infrastructure/db/ITradeRepository';
import { EventBus } from '../core/EventBus';

export interface TradeExecutedEvent extends Trade {
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  timestamp: number;
  simulated: boolean;
}

export class PaperTradingEngine implements IExecutionEngine {
  private tradeRepository: ITradeRepository;
  private eventBus: EventBus | null = null;
  
  // Multi-pair support: Track positions per pair
  // Key: pair symbol (e.g., "BTCUSDT")
  private positions: Map<string, Trade[]> = new Map();
  
  // Track trade cooldown per pair to prevent over-trading
  // Key: pair symbol, Value: timestamp of last trade
  private lastTradeTime: Map<string, number> = new Map();
  private readonly TRADE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown per pair
  
  // Risk management: Maximum 3 trades TOTAL across all pairs
  private readonly MAX_TOTAL_TRADES = 3;

  constructor(tradeRepository: ITradeRepository) {
    this.tradeRepository = tradeRepository;
  }

  /**
   * Get all open positions for a specific pair
   */
  public getPositions(symbol: string): Trade[] {
    return this.positions.get(symbol) || [];
  }

  /**
   * Get all positions across all pairs
   */
  public getAllPositions(): Map<string, Trade[]> {
    const result = new Map<string, Trade[]>();
    this.positions.forEach((trades, symbol) => {
      result.set(symbol, [...trades]);
    });
    return result;
  }

  /**
   * Get total count of open trades across all pairs
   */
  public getTotalOpenTrades(): number {
    let total = 0;
    this.positions.forEach((trades) => {
      total += trades.length;
    });
    return total;
  }

  /**
   * Check if we can open a new trade (risk management)
   */
  private canOpenTrade(symbol: string): { allowed: boolean; reason?: string } {
    // Check max trades limit across all pairs
    const totalTrades = this.getTotalOpenTrades();
    if (totalTrades >= this.MAX_TOTAL_TRADES) {
      return { 
        allowed: false, 
        reason: `Max ${this.MAX_TOTAL_TRADES} trades limit reached (${totalTrades} active)` 
      };
    }

    // Check cooldown for this specific pair
    const lastTrade = this.lastTradeTime.get(symbol);
    if (lastTrade) {
      const timeSinceLastTrade = Date.now() - lastTrade;
      if (timeSinceLastTrade < this.TRADE_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((this.TRADE_COOLDOWN_MS - timeSinceLastTrade) / 1000);
        return { 
          allowed: false, 
          reason: `Trade cooldown active for ${symbol} (${remainingSeconds}s remaining)` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Execute a trading signal
   * Supports concurrent trades on different pairs with max 3 total limit
   */
  public async executeSignal(signal: SignalGenerated): Promise<boolean> {
    if (signal.action === 'HOLD') {
      return false;
    }

    const symbol = signal.symbol;

    // Check risk management rules
    const canTrade = this.canOpenTrade(symbol);
    if (!canTrade.allowed) {
      console.log(`🚫 Trade rejected for ${symbol}: ${canTrade.reason}`);
      return false;
    }

    // Simulate getting a current price
    // TODO: In production, fetch actual price from exchange
    const basePrice = 50000;
    
    // Simulate some slippage (e.g., 0.1% worse price)
    const slippage = signal.action === 'BUY' ? 1.001 : 0.999;
    const simulatedFillPrice = basePrice * slippage;

    const trade: Trade = {
      symbol: symbol,
      action: signal.action,
      price: simulatedFillPrice,
      timestamp: Date.now(),
      simulated: true,
    };

    // Save to repository
    await this.tradeRepository.saveTrade(trade);

    // Track position for this pair
    let symbolPositions = this.positions.get(symbol);
    if (!symbolPositions) {
      symbolPositions = [];
      this.positions.set(symbol, symbolPositions);
    }
    symbolPositions.push(trade);

    // Update last trade time for cooldown tracking
    this.lastTradeTime.set(symbol, Date.now());

    // Emit trade_executed event with pair symbol
    if (this.eventBus) {
      this.eventBus.publish<TradeExecutedEvent>('trade_executed', trade);
    }

    console.log(`💰 Paper trade executed: ${signal.action} ${symbol} @ $${simulatedFillPrice.toFixed(2)}`);
    console.log(`📊 Total open trades: ${this.getTotalOpenTrades()}/${this.MAX_TOTAL_TRADES}`);

    return true;
  }

  /**
   * Close a position for a specific pair (call this when exiting a trade)
   */
  public closePosition(symbol: string, tradeIndex: number = 0): boolean {
    const symbolPositions = this.positions.get(symbol);
    if (!symbolPositions || symbolPositions.length === 0) {
      return false;
    }

    if (tradeIndex >= 0 && tradeIndex < symbolPositions.length) {
      symbolPositions.splice(tradeIndex, 1);
      
      // Clean up empty arrays
      if (symbolPositions.length === 0) {
        this.positions.delete(symbol);
      }
      
      console.log(`📉 Position closed for ${symbol}. Remaining: ${this.getTotalOpenTrades()}/${this.MAX_TOTAL_TRADES}`);
      return true;
    }

    return false;
  }

  /**
   * Close all positions for a specific pair
   */
  public closeAllPositions(symbol: string): number {
    const symbolPositions = this.positions.get(symbol);
    if (!symbolPositions) {
      return 0;
    }

    const count = symbolPositions.length;
    this.positions.delete(symbol);
    
    console.log(`📉 All positions closed for ${symbol} (${count} trades). Total open: ${this.getTotalOpenTrades()}/${this.MAX_TOTAL_TRADES}`);
    return count;
  }

  /**
   * Get last trade time for a pair
   */
  public getLastTradeTime(symbol: string): number | null {
    return this.lastTradeTime.get(symbol) || null;
  }

  /**
   * Check if a pair is in cooldown
   */
  public isInCooldown(symbol: string): boolean {
    const lastTrade = this.lastTradeTime.get(symbol);
    if (!lastTrade) return false;
    
    return (Date.now() - lastTrade) < this.TRADE_COOLDOWN_MS;
  }

  /**
   * Get remaining cooldown seconds for a pair
   */
  public getCooldownRemaining(symbol: string): number {
    const lastTrade = this.lastTradeTime.get(symbol);
    if (!lastTrade) return 0;
    
    const elapsed = Date.now() - lastTrade;
    if (elapsed >= this.TRADE_COOLDOWN_MS) return 0;
    
    return Math.ceil((this.TRADE_COOLDOWN_MS - elapsed) / 1000);
  }

  /**
   * Start listening to SignalGenerated events
   */
  public startListening(eventBus: EventBus): void {
    this.eventBus = eventBus;
    
    eventBus.subscribe<SignalGenerated>('SignalGenerated', (signal) => {
      this.executeSignal(signal).catch((err) => {
        console.error('PaperTradingEngine failed to execute signal:', err);
      });
    });
  }

  /**
   * Stop listening to events
   */
  public stopListening(): void {
    this.eventBus = null;
  }
}