# Tasks: Hybrid Multi-Timeframe Architecture

## Phase 1: Foundation - Event Types and Shared Contracts

- [ ] 1.1 Add `MarketRegime1HUpdated` event interface to `shared/src/events.ts`
  - Define interface with regime, trendDirection, confidence, timestamp, ema200, adx14, price fields
  - Export the new type
  - **Test**: TypeScript compilation passes

- [ ] 1.2 Verify existing EMA and ADX indicator classes work with 1H data
  - Run existing EMA.test.ts and ensure all tests pass
  - Run existing ADX.test.ts and ensure all tests pass
  - **Test**: `npm test -- EMA.test.ts` and `npm test -- ADX.test.ts` pass

## Phase 2: Infrastructure - REST Client for 1H Data

- [ ] 2.1 Create `backend/src/infrastructure/BinanceRestClient1H.ts`
  - Implement constructor accepting EventBus and config (symbol, pollingIntervalMinutes, candleLimit)
  - Implement `start()` method to begin 60-minute polling using setInterval
  - Implement `stop()` method to clear interval and cleanup
  - Implement `fetchHistoricalCandles()` to call Binance API: `/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200`
  - Handle API errors with exponential backoff retry (1s, 2s, 4s, max 60s)
  - **TDD**: Write failing test first for fetch logic

- [ ] 2.2 Add regime calculation to `BinanceRestClient1H`
  - Import existing EMA (period 200) and ADX (period 14) classes
  - Implement `calculateRegime(candles: Candle[]): MarketRegime1HUpdated` method
  - Calculate EMA200 and ADX14 from 1H candles
  - Determine regime: TRENDING_UP if ADX>25 AND price>EMA, TRENDING_DOWN if ADX>25 AND price<EMA, else RANGING
  - Set confidence based on ADX value (min 1, current ADX / 50)
  - **TDD**: Test with known candle data, verify correct regime detection

- [ ] 2.3 Add event emission to `BinanceRestClient1H`
  - Call `calculateRegime()` after successful fetch
  - Emit `market_regime_1h_updated` event via EventBus with regime data
  - Add console.log for regime calculation: "📊 1H Regime: TRENDING_UP (EMA200: 43250.50, ADX14: 32.4)"
  - **TDD**: Mock EventBus and verify event emitted with correct payload

- [ ] 2.4 Create comprehensive tests for `BinanceRestClient1H`
  - Test successful fetch and regime calculation
  - Test API error handling and retry logic
  - Test polling interval (use Jest fake timers)
  - Test graceful shutdown
  - **Test**: `npm test -- BinanceRestClient1H.test.ts` passes

## Phase 3: Infrastructure - WebSocket Client 5m Migration

- [ ] 3.1 Modify `backend/src/infrastructure/BinanceWsClient.ts` interval
  - Change default interval from '1m' to '5m'
  - Update WebSocket URL construction to use `@kline_5m`
  - Verify candle.interval field is set to '5m'
  - **TDD**: Write test expecting 5m interval before making change

- [ ] 3.2 Update `BinanceWsClient.test.ts` for 5m timeframe
  - Update all test mocks to use '5m' instead of '1m'
  - Update test expectations for candle.interval
  - Verify reconnection maintains 5m stream
  - **Test**: `npm test -- BinanceWsClient.test.ts` passes

## Phase 4: Engine - MarketRegimeDetector Refactor

- [ ] 4.1 Refactor `backend/src/engine/MarketRegimeDetector.ts`
  - Remove 1m→15m aggregation logic (delete `minuteCandles`, `fifteenMinuteCandles`, `aggregateTo15m`)
  - Remove local EMA20 and ADX10 instances (no longer needed)
  - Keep `currentRegime` state and `getCurrentRegime()` method
  - **TDD**: Write test expecting regime from event before refactoring

- [ ] 4.2 Add 1H event subscription to `MarketRegimeDetector`
  - Subscribe to `market_regime_1h_updated` events via EventBus
  - Implement handler to update `currentRegime` from event payload
  - Emit `market_regime_changed` only if regime actually changed
  - Add console.log: "🎯 Market regime updated from 1H: TRENDING_UP"
  - **TDD**: Mock EventBus, emit 1H event, verify regime state updated

- [ ] 4.3 Update `MarketRegimeDetector.test.ts`
  - Remove tests for 1m→15m aggregation
  - Add tests for 1H event handling
  - Test regime change detection (only emit when regime changes)
  - Test cleanup/unsubscribe
  - **Test**: `npm test -- MarketRegimeDetector.test.ts` passes

## Phase 5: Engine - IndicatorEngine 5m→15m Aggregation

- [ ] 5.1 Add 5m candle buffer to `IndicatorEngine`
  - Add `fiveMinuteCandles: Candle[] = []` property
  - Add `MAX_5M_BUFFER = 100` constant
  - **TDD**: Write test for buffer management

- [ ] 5.2 Implement 5m→15m aggregation in `IndicatorEngine`
  - Add `aggregateTo15m()` method that takes 5m candles and returns 15m candle
  - Logic: every 3 consecutive 5m candles → 1 fifteen-minute candle
  - OHLCV calculation: open=first.open, high=max, low=min, close=last.close, volume=sum
  - Only emit 15m candle when 3 candles available
  - **TDD**: Test with 6 five-minute candles, verify 2 fifteen-minute candles produced

- [ ] 5.3 Update VWAP calculation to use 15m aggregation
  - Modify `handleCandleClosed()` to aggregate 5m→15m before VWAP calculation
  - Feed aggregated 15m candles to VWAP indicator
  - Keep pattern detection on raw 5m candles (don't change)
  - **TDD**: Verify VWAP calculated correctly on aggregated data

- [ ] 5.4 Update `IndicatorEngine` tests
  - Add tests for 5m→15m aggregation
  - Update existing tests to work with 5m candles
  - Verify indicators_updated event includes correct data
  - **Test**: `npm test -- IndicatorEngine.test.ts` passes

## Phase 6: Integration - Backend Entry Point

- [ ] 6.1 Update `backend/src/index.ts` to initialize dual clients
  - Import `BinanceRestClient1H`
  - Create instance: `const restClient1H = new BinanceRestClient1H(eventBus, { symbol: 'BTCUSDT' })`
  - Call `restClient1H.start()` after WebSocket connection
  - Update shutdown handler to call `restClient1H.stop()`
  - Add logging: "✅ Binance REST Client (1H) initialized - polling every 60 minutes"
  - **Test**: Manual run - verify both clients start without errors

- [ ] 6.2 Update bootstrap logic for 5m WebSocket
  - Change historical candle fetch from '1m' to '5m' limit 300
  - Update console logs to reference "5m candles"
  - **Test**: Verify historical 5m candles load successfully

- [ ] 6.3 Remove or update old REST client usage
  - Keep `BinanceRestClient` for historical bootstrap (may need both)
  - OR modify to support 5m interval
  - **Decision**: Use existing REST client for 5m historical, new REST client for 1H polling

## Phase 7: Frontend - Timeframe Labels

- [ ] 7.1 Update `frontend/src/components/ChartPanel.tsx`
  - Add "5m" timeframe label in header (next to "BTC/USDT Chart")
  - Use styled badge or text: `<span className="text-xs bg-gray-200 px-2 py-1 rounded">5m</span>`
  - **Test**: Visual verification - label visible

- [ ] 7.2 Update `frontend/src/components/MarketRegimePanel.tsx`
  - Change explanation text from "Based on 15m timeframe: EMA 20 + ADX" to "Based on 1H timeframe: EMA 200 + ADX"
  - Optionally add "1H Trend" label to regime card
  - **Test**: Visual verification - text updated correctly

- [ ] 7.3 Update frontend tests if needed
  - Run existing frontend tests: `npm test` in frontend directory
  - Fix any broken tests due to component changes
  - **Test**: All frontend tests pass

## Phase 8: End-to-End Testing

- [ ] 8.1 Integration test - dual clients coordination
  - Start backend with both clients
  - Verify WebSocket streams 5m candles
  - Verify REST client fetches 1H data after 60 minutes
  - Verify both emit to same EventBus
  - **Test**: Manual run for 5+ minutes, check logs

- [ ] 8.2 Verify regime detection accuracy
  - Compare calculated EMA200 with TradingView or other source
  - Compare calculated ADX14 with known values
  - Verify regime changes detected correctly
  - **Test**: Use known market conditions to validate

- [ ] 8.3 Frontend integration test
  - Open frontend in browser
  - Verify chart displays 5m candles
  - Verify regime panel shows 1H trend
  - Verify signals are generated (if market conditions allow)
  - **Test**: Visual verification and console logs

## Phase 9: Cleanup and Documentation

- [ ] 9.1 Remove dead code from `MarketRegimeDetector`
  - Delete any unused imports
  - Delete unused interfaces (FifteenMinuteCandle if not needed elsewhere)
  - Ensure no console.log spam in production

- [ ] 9.2 Update code comments
  - Add JSDoc to new `BinanceRestClient1H` methods
  - Update comments in `BinanceWsClient` to reference 5m
  - Add comment in `IndicatorEngine` explaining 5m→15m aggregation

- [ ] 9.3 Run full test suite
  - Run `npm test` from root directory
  - Verify all backend tests pass
  - Verify all frontend tests pass
  - Fix any regressions
  - **Test**: Complete test suite green

## Phase 10: Validation Checklist

- [ ] 10.1 Verify all success criteria from proposal
  - [ ] BinanceRestClient1H fetches 200 1H candles successfully
  - [ ] EMA200 and ADX14 calculated correctly on 1H data
  - [ ] market_regime_1h_updated event emitted every 60 minutes
  - [ ] WebSocket client streams 5m candles (@kline_5m)
  - [ ] 5m→15m aggregation produces correct VWAP values
  - [ ] Frontend displays "5m" on chart and "1H Trend" on regime panel
  - [ ] All tests pass (existing + new)
  - [ ] No console errors during 10-minute runtime test
  - [ ] Regime changes detected within 60 minutes of actual trend shift
