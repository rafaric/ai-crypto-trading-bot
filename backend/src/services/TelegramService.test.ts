import { TelegramService } from './TelegramService';
import { SignalGenerated } from 'shared/events';

// Mock fetch globally
global.fetch = jest.fn();

describe('TelegramService', () => {
  let service: TelegramService;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();

    // Reset environment variables
    process.env = { ...originalEnv };
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-123';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id-456';

    // Create service instance
    service = new TelegramService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(service).toBeDefined();
    });

    it('should work without environment variables (graceful degradation)', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      expect(() => new TelegramService()).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('should call Telegram API with correct payload', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await service.sendMessage('Test message');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token-123/sendMessage',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: 'test-chat-id-456',
            text: 'Test message',
            parse_mode: 'HTML',
          }),
        }
      );
    });

    it('should skip sending if TELEGRAM_BOT_TOKEN is not set', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      service = new TelegramService();

      await service.sendMessage('Test message');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should skip sending if TELEGRAM_CHAT_ID is not set', async () => {
      delete process.env.TELEGRAM_CHAT_ID;
      service = new TelegramService();

      await service.sendMessage('Test message');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully without throwing', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.sendMessage('Test message');
      expect(result).toBeUndefined();
    });

    it('should handle non-ok responses gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      const result = await service.sendMessage('Test message');
      expect(result).toBeUndefined();
    });

    it('should handle Telegram API error responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: false, description: 'Chat not found' }),
      });

      const result = await service.sendMessage('Test message');
      expect(result).toBeUndefined();
    });
  });

  describe('sendSignalAlert', () => {
    it('should format signal message properly with all fields', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const signal: SignalGenerated = {
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 85.5,
        timestamp: 1234567890,
      };

      await service.sendSignalAlert(signal);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.text).toContain('BTCUSDT');
      expect(body.text).toContain('BUY');
      expect(body.text).toContain('85.5');
      expect(body.parse_mode).toBe('HTML');
    });

    it('should format SELL signal differently than BUY', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const buySignal: SignalGenerated = {
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 90,
        timestamp: Date.now(),
      };

      const sellSignal: SignalGenerated = {
        symbol: 'ETHUSDT',
        action: 'SELL',
        confidence: 75,
        timestamp: Date.now(),
      };

      await service.sendSignalAlert(buySignal);
      await service.sendSignalAlert(sellSignal);

      const buyCall = (global.fetch as jest.Mock).mock.calls[0];
      const sellCall = (global.fetch as jest.Mock).mock.calls[1];

      const buyText = JSON.parse(buyCall[1].body).text;
      const sellText = JSON.parse(sellCall[1].body).text;

      expect(buyText).toContain('BUY');
      expect(sellText).toContain('SELL');
    });

    it('should not send if TELEGRAM_BOT_TOKEN is missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      service = new TelegramService();

      const signal: SignalGenerated = {
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 85,
        timestamp: Date.now(),
      };

      await service.sendSignalAlert(signal);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const signal: SignalGenerated = {
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 85,
        timestamp: Date.now(),
      };

      const result = await service.sendSignalAlert(signal);
      expect(result).toBeUndefined();
    });
  });

  describe('sendTradeNotification', () => {
    it('should send trade execution notification', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const trade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        amount: 0.5,
        price: 50000,
        total: 25000,
        timestamp: Date.now(),
      };

      await service.sendTradeNotification(trade);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.text).toContain('BTCUSDT');
      expect(body.text).toContain('BUY');
      expect(body.text).toContain('0.5');
      expect(body.text).toContain('$50,000');
    });

    it('should handle sell trades', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const trade = {
        symbol: 'ETHUSDT',
        side: 'sell',
        amount: 2,
        price: 3000,
        total: 6000,
        timestamp: Date.now(),
      };

      await service.sendTradeNotification(trade);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.text).toContain('SELL');
      expect(body.text).toContain('ETHUSDT');
    });

    it('should not send if TELEGRAM_BOT_TOKEN is missing', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      service = new TelegramService();

      const trade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        amount: 0.5,
        price: 50000,
        total: 25000,
        timestamp: Date.now(),
      };

      await service.sendTradeNotification(trade);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const trade = {
        symbol: 'BTCUSDT',
        side: 'buy',
        amount: 0.5,
        price: 50000,
        total: 25000,
        timestamp: Date.now(),
      };

      const result = await service.sendTradeNotification(trade);
      expect(result).toBeUndefined();
    });
  });
});
