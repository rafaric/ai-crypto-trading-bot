import { EventBus } from '../core/EventBus';
import { MarketRegime1HUpdated } from '../../../shared/src/events';

export interface MarketRegimeEvent {
  symbol: string;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
  ema200?: number;
  adx14?: number;
  price?: number;
}

/**
 * Market Regime Detector
 * Listens to 1H regime updates from BinanceRestClient1H
 * Emits market_regime_changed events when regime changes per pair
 * 
 * Previously: Single regime for all pairs
 * Now: Tracks regime independently for each trading pair (multi-pair support)
 */
export class MarketRegimeDetector {
  private eventBus: EventBus;
  private unsubscribeFn: (() => void) | null = null;
  
  // Multi-pair support: Track regime per pair
  // Key: pair symbol (e.g., "BTCUSDT")
  private currentRegimes: Map<string, MarketRegimeEvent> = new Map();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Subscribe to 1H regime updates from REST client
    this.unsubscribeFn = this.eventBus.subscribe<MarketRegime1HUpdated>(
      'market_regime_1h_updated',
      this.handleRegimeUpdate.bind(this)
    );
    
    console.log('✅ MarketRegimeDetector initialized - listening to 1H regime updates for all pairs');
  }

  /**
   * Unsubscribe from events and cleanup
   */
  public unsubscribe(): void {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
  }

  /**
   * Get current market regime for a specific pair
   */
  public getCurrentRegime(symbol: string): MarketRegimeEvent | null {
    return this.currentRegimes.get(symbol) || null;
  }

  /**
   * Get all current regimes (for monitoring/debugging)
   */
  public getAllRegimes(): Map<string, MarketRegimeEvent> {
    return new Map(this.currentRegimes);
  }

  /**
   * Handle 1H regime update from REST client
   * Calculates EMA200/ADX14 independently for each pair
   */
  private handleRegimeUpdate(regimeUpdate: MarketRegime1HUpdated): void {
    const symbol = regimeUpdate.symbol;
    
    console.log(`📊 Received 1H regime update for ${symbol}: ${regimeUpdate.regime} (${regimeUpdate.trendDirection}) - Confidence: ${(regimeUpdate.confidence * 100).toFixed(1)}%`);

    // Create regime event with symbol included
    const newRegime: MarketRegimeEvent = {
      symbol: symbol,
      regime: regimeUpdate.regime,
      trendDirection: regimeUpdate.trendDirection,
      confidence: regimeUpdate.confidence,
      timestamp: regimeUpdate.timestamp,
      ema200: regimeUpdate.ema200,
      adx14: regimeUpdate.adx14,
      price: regimeUpdate.price,
    };

    const currentRegime = this.currentRegimes.get(symbol);

    // Only emit if regime changed for this pair
    if (currentRegime?.regime !== newRegime.regime) {
      this.currentRegimes.set(symbol, newRegime);
      console.log(`🎯 Market regime changed for ${symbol}: ${newRegime.regime} (${newRegime.trendDirection}) - Confidence: ${(newRegime.confidence * 100).toFixed(1)}%`);
      this.eventBus.publish<MarketRegimeEvent>('market_regime_changed', newRegime);
    } else {
      // Update confidence and values even if regime hasn't changed
      this.currentRegimes.set(symbol, newRegime);
      console.log(`📊 Regime stable for ${symbol}: ${newRegime.regime} (${newRegime.trendDirection})`);
    }
  }
}