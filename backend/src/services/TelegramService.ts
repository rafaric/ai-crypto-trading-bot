import { SignalGenerated } from 'shared/events';

export class TelegramService {
  private botToken: string | undefined;
  private chatId: string | undefined;
  private readonly baseUrl = 'https://api.telegram.org/bot';

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;
  }

  private isConfigured(): boolean {
    return !!this.botToken && !!this.chatId;
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.isConfigured()) {
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
}
