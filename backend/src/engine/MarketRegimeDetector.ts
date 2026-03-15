import { EventBus } from '../core/EventBus';
import { MarketRegime1HUpdated } from '../../../shared/src/events';

export interface MarketRegimeEvent {
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
}

/**
 * Market Regime Detector
 * Listens to 1H regime updates from BinanceRestClient1H
 * Emits market_regime_changed events when regime changes
 * 
 * Previously: Aggregated 1m candles to 15m and calculated EMA20 + ADX10 locally
 * Now: Receives pre-calculated regime from 1H REST client (EMA200 + ADX14)
 */
export class MarketRegimeDetector {
  private eventBus: EventBus;
  private unsubscribeFn: (() => void) | null = null;
  
  // Current regime state
  private currentRegime: MarketRegimeEvent | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Subscribe to 1H regime updates from REST client
    this.unsubscribeFn = this.eventBus.subscribe<MarketRegime1HUpdated>(
      'market_regime_1h_updated',
      this.handleRegimeUpdate.bind(this)
    );
    
    console.log('✅ MarketRegimeDetector initialized - listening to 1H regime updates');
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
   * Get current market regime
   */
  public getCurrentRegime(): MarketRegimeEvent | null {
    return this.currentRegime;
  }

  /**
   * Handle 1H regime update from REST client
   */
  private handleRegimeUpdate(regimeUpdate: MarketRegime1HUpdated): void {
    console.log(`📊 Received 1H regime update: ${regimeUpdate.regime} (${regimeUpdate.trendDirection}) - Confidence: ${(regimeUpdate.confidence * 100).toFixed(1)}%`);

    // Create regime event (extract only the fields needed for downstream consumers)
    const newRegime: MarketRegimeEvent = {
      regime: regimeUpdate.regime,
      trendDirection: regimeUpdate.trendDirection,
      confidence: regimeUpdate.confidence,
      timestamp: regimeUpdate.timestamp,
    };

    // Only emit if regime changed
    if (this.currentRegime?.regime !== newRegime.regime) {
      this.currentRegime = newRegime;
      console.log(`🎯 Market regime changed: ${newRegime.regime} (${newRegime.trendDirection}) - Confidence: ${(newRegime.confidence * 100).toFixed(1)}%`);
      this.eventBus.publish<MarketRegimeEvent>('market_regime_changed', newRegime);
    } else {
      // Update confidence even if regime hasn't changed
      this.currentRegime = newRegime;
      console.log(`📊 Regime stable: ${newRegime.regime} (${newRegime.trendDirection})`);
    }
  }
}
