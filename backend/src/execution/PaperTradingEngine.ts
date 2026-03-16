import { IExecutionEngine } from '../../../shared/src/interfaces';
import { SignalGenerated, Candle, AccountSummary } from '../../../shared/src/events';
import { ITradeRepository, Trade } from '../infrastructure/db/ITradeRepository';
import { EventBus } from '../core/EventBus';

export interface TradeExecutedEvent extends Trade {
  id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  side: 'BUY' | 'SELL';
  price: number;
  entryPrice: number;
  timestamp: number;
  openTime: number;
  simulated: boolean;
  status: 'OPEN' | 'CLOSED' | 'CLOSED_SL' | 'CLOSED_TP' | 'CLOSED_MANUAL';
  slPrice?: number;
  tpPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  result?: 'WIN' | 'LOSS';
  closeTime?: number;
  exitPrice?: number;
}

// Extended trade with SL/TP and P&L tracking
export interface TradeWithRisk extends Trade {
  slPrice: number;      // Stop Loss price
  tpPrice: number;       // Take Profit price
  quantity: number;       // Trade quantity in USD
  pnl: number;           // Profit/Loss (negative = loss)
  status: 'OPEN' | 'CLOSED_SL' | 'CLOSED_TP' | 'CLOSED_MANUAL';
  closedAt?: number;     // Timestamp when position was closed
  closedPrice?: number;  // Price when position was closed
}

// Account balance tracking
export interface AccountBalance {
  initialBalance: number;
  currentBalance: number;
  totalPnl: number;
  winningTrades: number;
  losingTrades: number;
  totalTrades: number;
}

export class PaperTradingEngine implements IExecutionEngine {
  private tradeRepository: ITradeRepository;
  private eventBus: EventBus | null = null;
  
  // Multi-pair support: Track positions per pair
  // Key: pair symbol (e.g., "BTCUSDT")
  private positions: Map<string, TradeWithRisk[]> = new Map();
  
  // Track trade cooldown per pair to prevent over-trading
  // Key: pair symbol, Value: timestamp of last trade
  private lastTradeTime: Map<string, number> = new Map();
  private readonly TRADE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown per pair
  
  // Risk management: Maximum 3 trades TOTAL across all pairs
  private readonly MAX_TOTAL_TRADES = 3;
  
  // Account settings
  private readonly INITIAL_BALANCE = 500;        // $500 initial balance
  private readonly RISK_PERCENTAGE = 0.01;       // 1% risk per trade ($5)
  private readonly STOP_LOSS_PERCENT = 0.02;     // 2% SL
  private readonly TAKE_PROFIT_PERCENT = 0.03;   // 3% TP
  
  // Account balance
  private balance: AccountBalance = {
    initialBalance: 500,
    currentBalance: 500,
    totalPnl: 0,
    winningTrades: 0,
    losingTrades: 0,
    totalTrades: 0,
  };
  
  // Track closed trades for history
  private tradeHistory: TradeWithRisk[] = [];
  
  // Current market prices for SL/TP monitoring
  private currentPrices: Map<string, number> = new Map();

  constructor(tradeRepository: ITradeRepository) {
    this.tradeRepository = tradeRepository;
    
    console.log(`💰 Paper Trading Account initialized:`);
    console.log(`   Initial Balance: $${this.balance.initialBalance}`);
    console.log(`   Risk per Trade: ${this.RISK_PERCENTAGE * 100}% ($${(this.balance.initialBalance * this.RISK_PERCENTAGE).toFixed(2)})`);
    console.log(`   Stop Loss: ${this.STOP_LOSS_PERCENT * 100}%`);
    console.log(`   Take Profit: ${this.TAKE_PROFIT_PERCENT * 100}%`);
  }

  /**
   * Get all open positions for a specific pair
   */
  public getPositions(symbol: string): TradeWithRisk[] {
    return this.positions.get(symbol) || [];
  }

  /**
   * Get all positions across all pairs
   */
  public getAllPositions(): Map<string, TradeWithRisk[]> {
    const result = new Map<string, TradeWithRisk[]>();
    this.positions.forEach((trades, symbol) => {
      result.set(symbol, [...trades]);
    });
    return result;
  }
  
  /**
   * Get current account balance
   */
  public getBalance(): AccountBalance {
    return { ...this.balance };
  }
  
  /**
   * Get trade history (closed trades)
   */
  public getTradeHistory(): TradeWithRisk[] {
    return [...this.tradeHistory];
  }
  /**
   * Publish account update event to notify frontend of balance changes
   */
  private publishAccountUpdate(): void {
    if (!this.eventBus) return;

    const winRate = this.balance.totalTrades > 0 
      ? (this.balance.winningTrades / this.balance.totalTrades) * 100 
      : 0;

    const accountSummary: AccountSummary = {
      initialBalance: this.balance.initialBalance,
      currentBalance: this.balance.currentBalance,
      totalPnl: this.balance.totalPnl,
      totalPnlPercent: this.balance.initialBalance > 0 
        ? (this.balance.totalPnl / this.balance.initialBalance) * 100 
        : 0,
      winRate,
      totalTrades: this.balance.totalTrades,
      winningTrades: this.balance.winningTrades,
      losingTrades: this.balance.losingTrades,
    };

    this.eventBus.publish<AccountSummary>('account_update', accountSummary);
  }


  
  /**
   * Check if there's an open position for a symbol
   */
  public hasOpenPosition(symbol: string): boolean {
    const positions = this.positions.get(symbol);
    return positions !== undefined && positions.length > 0;
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

    // Check if there's already an open position for this symbol
    if (this.hasOpenPosition(symbol)) {
      console.log(`🚫 Trade rejected for ${symbol}: position already open`);
      return false;
    }

    // Check risk management rules
    const canTrade = this.canOpenTrade(symbol);
    if (!canTrade.allowed) {
      console.log(`🚫 Trade rejected for ${symbol}: ${canTrade.reason}`);
      return false;
    }

    // Get current price or use stored price
    let basePrice = this.currentPrices.get(symbol);
    if (!basePrice) {
      // Default price if not available - in production would fetch from exchange
      basePrice = 50000;
    }

    // Apply slippage
    const slippage = signal.action === 'BUY' ? 1.001 : 0.999;
    const fillPrice = basePrice * slippage;

    // Calculate quantity based on risk ($5 per trade)
    const riskAmount = this.balance.currentBalance * this.RISK_PERCENTAGE;
    const quantity = riskAmount; // $5 for $500 balance

    // Calculate SL and TP prices
    const slPrice = signal.action === 'BUY'
      ? fillPrice * (1 - this.STOP_LOSS_PERCENT)  // BUY: SL below entry
      : fillPrice * (1 + this.STOP_LOSS_PERCENT); // SELL: SL above entry

    const tpPrice = signal.action === 'BUY'
      ? fillPrice * (1 + this.TAKE_PROFIT_PERCENT) // BUY: TP above entry
      : fillPrice * (1 - this.TAKE_PROFIT_PERCENT); // SELL: TP below entry

    const tradeWithRisk: TradeWithRisk = {
      symbol: symbol,
      action: signal.action,
      price: fillPrice,
      timestamp: Date.now(),
      simulated: true,
      slPrice,
      tpPrice,
      quantity,
      pnl: 0,
      status: 'OPEN',
    };

    // Save base trade to repository
    const trade: Trade = {
      symbol: symbol,
      action: signal.action,
      price: fillPrice,
      timestamp: Date.now(),
      simulated: true,
    };
    await this.tradeRepository.saveTrade(trade);

    // Track position with SL/TP info
    let symbolPositions = this.positions.get(symbol);
    if (!symbolPositions) {
      symbolPositions = [];
      this.positions.set(symbol, symbolPositions);
    }
    symbolPositions.push(tradeWithRisk);

    // Update last trade time for cooldown tracking
    this.lastTradeTime.set(symbol, Date.now());

    // Emit trade_executed event with pair symbol
    if (this.eventBus) {
      const tradeEvent: TradeExecutedEvent = {
        ...tradeWithRisk,
        side: tradeWithRisk.action,
        entryPrice: tradeWithRisk.price,
        openTime: tradeWithRisk.timestamp,
        stopLoss: tradeWithRisk.slPrice,
        takeProfit: tradeWithRisk.tpPrice,
      };
      this.eventBus.publish<TradeExecutedEvent>('trade_executed', tradeEvent);
    }

    console.log(`💰 Paper trade executed: ${signal.action} ${symbol} @ $${fillPrice.toFixed(2)}`);
    console.log(`   SL: $${slPrice.toFixed(2)} (${this.STOP_LOSS_PERCENT * 100}%) | TP: $${tpPrice.toFixed(2)} (${this.TAKE_PROFIT_PERCENT * 100}%)`);
    console.log(`📊 Total open trades: ${this.getTotalOpenTrades()}/${this.MAX_TOTAL_TRADES}`);

    return true;
  }

  /**
   * Close a position for a specific pair (manual close via frontend)
   * Returns the closed trade info or null if not found
   */
  public closePosition(symbol: string, positionId?: string): TradeWithRisk | null {
    const symbolPositions = this.positions.get(symbol);
    if (!symbolPositions || symbolPositions.length === 0) {
      return null;
    }

    // Find position by ID (format: "symbol-timestamp") or by index
    let tradeIndex = -1;
    if (positionId) {
      const timestamp = parseInt(positionId.split('-')[1], 10);
      tradeIndex = symbolPositions.findIndex(t => t.timestamp === timestamp);
    } else {
      tradeIndex = 0; // Default to first position
    }

    if (tradeIndex === -1 || tradeIndex >= symbolPositions.length) {
      return null;
    }

    const trade = symbolPositions[tradeIndex];
    
    // Get current price for P&L calculation
    const currentPrice = this.currentPrices.get(symbol) || trade.price;
    
    // Calculate P&L based on trade side
    let pnl = 0;
    if (trade.action === 'BUY') {
      pnl = (currentPrice - trade.price) / trade.price * trade.quantity;
    } else {
      pnl = (trade.price - currentPrice) / trade.price * trade.quantity;
    }

    // Update trade with close info
    trade.status = 'CLOSED_MANUAL';
    trade.closedAt = Date.now();
    trade.closedPrice = currentPrice;
    trade.pnl = pnl;

    // Add to trade history
    this.tradeHistory.push(trade);

    // Update balance
    this.balance.currentBalance += pnl;
    this.balance.totalPnl += pnl;
    this.balance.totalTrades++;

    if (pnl > 0) {
      this.balance.winningTrades++;
    } else {
      this.balance.losingTrades++;
    }

    // Remove from open positions
    symbolPositions.splice(tradeIndex, 1);
    if (symbolPositions.length === 0) {
      this.positions.delete(symbol);
    }

    // Publish account update
    this.publishAccountUpdate();

    // Publish trade_executed event for frontend update
    if (this.eventBus) {
      const tradeEvent: TradeExecutedEvent = {
        ...trade,
        id: `${symbol}-${trade.timestamp}`,
        side: trade.action,
        entryPrice: trade.price,
        openTime: trade.timestamp,
        stopLoss: trade.slPrice,
        takeProfit: trade.tpPrice,
        closeTime: trade.closedAt,
        exitPrice: trade.closedPrice,
        result: pnl >= 0 ? 'WIN' : 'LOSS',
        status: 'CLOSED',
      };
      this.eventBus.publish<TradeExecutedEvent>('trade_executed', tradeEvent);
    }

    console.log(`📉 Position manually closed for ${symbol} @ $${currentPrice.toFixed(2)}`);
    console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} | Balance: $${this.balance.currentBalance.toFixed(2)}`);

    return trade;
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
   * Update current price for a symbol (called from candle_closed events)
   */
  public updatePrice(symbol: string, price: number): void {
    this.currentPrices.set(symbol, price);
    
    // Check SL/TP whenever price updates
    this.checkStopLossTakeProfit(symbol, price);
  }

  /**
   * Check if any open position hit SL or TP and close if so
   */
  private checkStopLossTakeProfit(symbol: string, currentPrice: number): void {
    const symbolPositions = this.positions.get(symbol);
    if (!symbolPositions || symbolPositions.length === 0) {
      return;
    }

    const positionsToClose: number[] = [];

    for (let i = 0; i < symbolPositions.length; i++) {
      const trade = symbolPositions[i];
      
      if (trade.status !== 'OPEN') {
        continue;
      }

      let shouldClose = false;
      let closedReason: 'CLOSED_SL' | 'CLOSED_TP' | 'CLOSED_MANUAL' = 'CLOSED_MANUAL';
      let pnl = 0;

      if (trade.action === 'BUY') {
        // For BUY: SL below entry, TP above entry
        if (currentPrice <= trade.slPrice) {
          shouldClose = true;
          closedReason = 'CLOSED_SL';
          // Loss: (SL - entry) / entry * quantity
          pnl = (trade.slPrice - trade.price) / trade.price * trade.quantity;
        } else if (currentPrice >= trade.tpPrice) {
          shouldClose = true;
          closedReason = 'CLOSED_TP';
          // Profit: (TP - entry) / entry * quantity
          pnl = (trade.tpPrice - trade.price) / trade.price * trade.quantity;
        }
      } else if (trade.action === 'SELL') {
        // For SELL: SL above entry, TP below entry
        if (currentPrice >= trade.slPrice) {
          shouldClose = true;
          closedReason = 'CLOSED_SL';
          // Loss: (entry - SL) / entry * quantity
          pnl = (trade.price - trade.slPrice) / trade.price * trade.quantity;
        } else if (currentPrice <= trade.tpPrice) {
          shouldClose = true;
          closedReason = 'CLOSED_TP';
          // Profit: (entry - TP) / entry * quantity
          pnl = (trade.price - trade.tpPrice) / trade.price * trade.quantity;
        }
      }

      if (shouldClose) {
        positionsToClose.push(i);
        
        // Update trade with close info
        trade.status = closedReason;
        trade.closedAt = Date.now();
        trade.closedPrice = currentPrice;
        trade.pnl = pnl;

        // Add to trade history
        this.tradeHistory.push(trade);

        // Update balance
        this.balance.currentBalance += pnl;
        this.balance.totalPnl += pnl;
        this.balance.totalTrades++;

        if (pnl > 0) {
          this.balance.winningTrades++;
        } else {
          this.balance.losingTrades++;
        }

        // Notify frontend of balance change after trade closes
        this.publishAccountUpdate();

        // Publish trade_executed event for frontend update
        if (this.eventBus) {
          const tradeEvent: TradeExecutedEvent = {
            ...trade,
            id: `${symbol}-${trade.timestamp}`,
            side: trade.action,
            entryPrice: trade.price,
            openTime: trade.timestamp,
            stopLoss: trade.slPrice,
            takeProfit: trade.tpPrice,
            closeTime: trade.closedAt,
            exitPrice: trade.closedPrice,
            result: pnl >= 0 ? 'WIN' : 'LOSS',
            status: 'CLOSED',
          };
          this.eventBus.publish<TradeExecutedEvent>('trade_executed', tradeEvent);
        }

        console.log(`🎯 Position ${closedReason} for ${symbol} @ $${currentPrice.toFixed(2)}`);
        console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} | Balance: $${this.balance.currentBalance.toFixed(2)}`);
      }
    }

    // Remove closed positions (iterate backwards to maintain indices)
    for (let i = positionsToClose.length - 1; i >= 0; i--) {
      symbolPositions.splice(positionsToClose[i], 1);
    }

    // Clean up empty arrays
    if (symbolPositions.length === 0) {
      this.positions.delete(symbol);
    }
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
   * Start listening to SignalGenerated and candle_closed events
   */
  public startListening(eventBus: EventBus): void {
    this.eventBus = eventBus;
    
    eventBus.subscribe<SignalGenerated>('SignalGenerated', (signal) => {
      this.executeSignal(signal).catch((err) => {
        console.error('PaperTradingEngine failed to execute signal:', err);
      });
    });

    // Subscribe to candle_closed events for price updates and SL/TP checking
    eventBus.subscribe<Candle>('candle_closed', (candle) => {
      if (candle && candle.symbol && candle.close) {
        this.updatePrice(candle.symbol, candle.close);
      }
    });
  }

  /**
   * Stop listening to events
   */
  public stopListening(): void {
    this.eventBus = null;
  }
}