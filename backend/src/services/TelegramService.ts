import { SignalGenerated } from 'shared/events';

interface MarketData {
  symbol: string;
  price: number;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | null;
  lastUpdate: number;
}

interface DailyTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  pnl: number;
  timestamp: number;
}

export class TelegramService {
  private botToken: string | undefined;
  private chatId: string | undefined;
  private readonly baseUrl = 'https://api.telegram.org/bot';
  
  // Deduplication to prevent duplicate messages
  private recentMessages: Map<string, number> = new Map();
  private readonly dedupWindowMs = 5000; // 5 seconds
  
  // Market data storage for summary generation
  private marketData: Map<string, MarketData> = new Map();
  private dailyTrades: DailyTrade[] = [];
  private lastSummaryDate: string = '';
  
  // Command polling
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastUpdateId: number = 0;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (this.isConfigured()) {
      this.startCommandPolling();
      this.scheduleDailySummary();
    }
  }
  
  private isDuplicate(text: string): boolean {
    const now = Date.now();
    const lastSent = this.recentMessages.get(text);
    
    if (lastSent && (now - lastSent) < this.dedupWindowMs) {
      return true;
    }
    
    this.recentMessages.set(text, now);
    
    // Cleanup old entries
    for (const [msg, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > this.dedupWindowMs) {
        this.recentMessages.delete(msg);
      }
    }
    
    return false;
  }

  private isConfigured(): boolean {
    return !!this.botToken && !!this.chatId;
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    // Deduplication check - prevent duplicate messages within 5 seconds
    if (this.isDuplicate(text)) {
      console.log('⚠️  Duplicate Telegram message prevented:', text.substring(0, 50) + '...');
      return;
    }

    try {
      const url = `${this.baseUrl}${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        console.error(`Telegram API error: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      if (!data.ok) {
        console.error(`Telegram API error: ${data.description || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
    }
  }

  async sendSignalAlert(signal: SignalGenerated): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const actionEmoji = signal.action === 'BUY' ? '🟢' : signal.action === 'SELL' ? '🔴' : '⚪';
    const confidencePercent = signal.confidence.toFixed(1);
    const date = new Date(signal.timestamp).toLocaleString();

    const message = `
${actionEmoji} <b>Señal de Trading</b> ${actionEmoji}

📊 <b>Par:</b> ${signal.symbol}
🎯 <b>Acción:</b> ${signal.action}
📈 <b>Confianza:</b> ${confidencePercent}%
🕐 <b>Hora:</b> ${date}
    `.trim();

    await this.sendMessage(message);
  }

  async sendTradeNotification(trade: {
    symbol: string;
    side: string;
    amount: number;
    price: number;
    total: number;
    timestamp: number;
  }): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const sideEmoji = trade.side.toLowerCase() === 'buy' ? '🟢' : '🔴';
    const sideText = trade.side.toUpperCase();
    const date = new Date(trade.timestamp).toLocaleString();

    const message = `
${sideEmoji} <b>Trade Ejecutado</b> ${sideEmoji}

📊 <b>Par:</b> ${trade.symbol}
💱 <b>Tipo:</b> ${sideText}
📦 <b>Cantidad:</b> ${trade.amount}
💰 <b>Precio:</b> $${trade.price.toLocaleString()}
💵 <b>Total:</b> $${trade.total.toLocaleString()}
🕐 <b>Hora:</b> ${date}
    `.trim();

    await this.sendMessage(message);
  }

  // Store market data for summary generation
  public updateMarketData(symbol: string, price: number, regime: MarketData['regime']): void {
    this.marketData.set(symbol, {
      symbol,
      price,
      regime,
      lastUpdate: Date.now(),
    });
  }

  // Store trade for P&L calculation
  public recordTrade(symbol: string, side: 'BUY' | 'SELL', price: number, pnl: number = 0): void {
    this.dailyTrades.push({
      symbol,
      side,
      price,
      pnl,
      timestamp: Date.now(),
    });
    
    // Keep only today's trades
    const today = new Date().toDateString();
    this.dailyTrades = this.dailyTrades.filter(
      t => new Date(t.timestamp).toDateString() === today
    );
  }

  // Generate and send summary
  public async sendDailySummary(): Promise<void> {
    if (!this.isConfigured()) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Calculate daily P&L
    const todayTrades = this.dailyTrades.filter(
      t => new Date(t.timestamp).toDateString() === now.toDateString()
    );
    const totalPnl = todayTrades.reduce((sum, t) => sum + t.pnl, 0);
    const winningTrades = todayTrades.filter(t => t.pnl > 0).length;
    const losingTrades = todayTrades.filter(t => t.pnl < 0).length;

    // Build market data section
    let marketSection = '';
    if (this.marketData.size > 0) {
      marketSection = '\n📊 <b>Estado del Mercado:</b>\n';
      for (const [symbol, data] of this.marketData) {
        const regimeEmoji = data.regime === 'TRENDING_UP' ? '📈' :
                           data.regime === 'TRENDING_DOWN' ? '📉' : '➡️';
        marketSection += `  ${symbol}: $${data.price.toLocaleString()} ${regimeEmoji}\n`;
      }
    }

    // Build trades section
    let tradesSection = '';
    if (todayTrades.length > 0) {
      tradesSection = '\n💰 <b>Trades de Hoy:</b>\n';
      tradesSection += `  Total: ${todayTrades.length} trades\n`;
      tradesSection += `  ✅ Ganadores: ${winningTrades}\n`;
      tradesSection += `  ❌ Perdedores: ${losingTrades}\n`;
      tradesSection += `  💵 P&L: $${totalPnl.toFixed(2)}\n`;
    } else {
      tradesSection = '\n💰 <b>Trades de Hoy:</b> Sin trades\n';
    }

    const message = `
📋 <b>Resumen Diario - ${dateStr}</b>

${marketSection}
${tradesSection}

🤖 <i>AI Crypto Trading Bot</i>
    `.trim();

    await this.sendMessage(message);
    this.lastSummaryDate = now.toDateString();
    console.log('📋 Daily summary sent via Telegram');
  }

  // Schedule daily summary at 23:59 (11:59 PM)
  private scheduleDailySummary(): void {
    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentDate = now.toDateString();
      
      // Send at 23:59 if not already sent today
      if (hours === 23 && minutes === 59 && this.lastSummaryDate !== currentDate) {
        this.sendDailySummary();
      }
    };
    
    // Check every minute
    setInterval(checkTime, 60000);
    console.log('📅 Daily summary scheduled for 23:59');
  }

  // Poll for Telegram commands
  private startCommandPolling(): void {
    const poll = async () => {
      if (!this.isConfigured()) return;
      
      try {
        const url = `${this.baseUrl}${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&limit=10`;
        const response = await fetch(url);
        
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data.ok || !data.result) return;
        
        for (const update of data.result) {
          this.lastUpdateId = update.update_id;
          
          const message = update.message;
          if (!message || !message.text) continue;
          
          const text = message.text.toLowerCase().trim();
          
          // Handle /resumen command
          if (text === '/resumen' || text === '/summary') {
            console.log('📱 Received /resumen command from Telegram');
            await this.sendDailySummary();
          }
          
          // Handle /help command
          if (text === '/help' || text === '/ayuda') {
            await this.sendMessage(`
🤖 <b>Comandos disponibles:</b>

/resumen - Mostrar resumen actual
/help - Mostrar esta ayuda

<i>AI Crypto Trading Bot</i>
            `.trim());
          }
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    };
    
    // Poll every 5 seconds
    this.pollingInterval = setInterval(poll, 5000);
    console.log('📱 Telegram command polling started (/resumen available)');
  }

  // Cleanup method
  public stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}
