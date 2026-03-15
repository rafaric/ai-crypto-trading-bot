# Proposal: Hybrid Multi-Timeframe Architecture

## Intent

Implement a **proper Multi-Timeframe (MTF) architecture** that correctly separates macro trend analysis from micro entry signal detection. Currently, the system aggregates 1m candles into 15m for trend analysis, which is mathematically incorrect for EMA200 calculation. This change establishes:

1. **1H timeframe** for macro trend (EMA200 + ADX14) - proper long-term regime detection
2. **5m timeframe** for chart display and entry patterns - cleaner visualization
3. **True MTF separation** - trend filter uses 1H, entries use 5m

## Scope

### In Scope
- Create `BinanceRestClient1H.ts` - REST client for 1H candle fetching every 60 minutes
- Modify `BinanceWsClient.ts` - Change from @kline_1m to @kline_5m
- Update `backend/src/index.ts` - Initialize both clients with proper coordination
- Add 5m→15m aggregation logic for VWAP calculation (3 candles of 5m)
- Emit new event `market_regime_1h_updated` for 1H regime changes
- Frontend updates: Chart shows 5m, Regime panel shows 1H trend, proper timeframe labels
- Comprehensive TDD test coverage for all new components

### Out of Scope
- Modifying indicator calculation algorithms (EMA, ADX, VWAP logic stays the same)
- Signal generation strategy changes (only data source changes)
- Paper trading execution logic
- Telegram notification content changes
- Database schema changes (regime state remains in-memory)

## Approach

**Architecture Pattern**: Clean separation of concerns with timeframe-specific clients

1. **BinanceRestClient1H** (NEW)
   - Polls Binance REST API every 60 minutes
   - Fetches 200 candles of 1H data
   - Calculates EMA200 and ADX14 using existing indicator classes
   - Emits `market_regime_1h_updated` event
   - Runs in parallel with WebSocket client

2. **BinanceWsClient** (MODIFIED)
   - Changes interval from '1m' to '5m'
   - WebSocket stream: `btcusdt@kline_5m`
   - Continues emitting `candle_closed` events
   - 5m candles aggregated 3:1 for 15m VWAP calculation

3. **Integration Layer** (backend/src/index.ts)
   - Initializes RestClient1H with 60-minute polling
   - Initializes WsClient with 5m WebSocket
   - Both share the same EventBus for decoupled communication
   - MarketRegimeDetector updated to listen to 1H events

4. **IndicatorEngine** (ADAPTED)
   - Receives 5m candles from WebSocket
   - Aggregates to 15m for VWAP (3 candles × 5m = 15m)
   - Continues pattern detection on 5m timeframe

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/infrastructure/BinanceRestClient1H.ts` | New | REST client for 1H macro trend analysis with polling |
| `backend/src/infrastructure/BinanceWsClient.ts` | Modified | Change interval from 1m to 5m |
| `backend/src/infrastructure/BinanceRestClient.ts` | Unchanged | Keep existing for historical bootstrap |
| `backend/src/index.ts` | Modified | Initialize dual clients, setup 60min polling |
| `backend/src/engine/MarketRegimeDetector.ts` | Modified | Listen to 1H events instead of aggregating 1m→15m |
| `backend/src/engine/IndicatorEngine.ts` | Modified | Aggregate 5m→15m for VWAP (3:1 ratio) |
| `frontend/src/components/ChartPanel.tsx` | Modified | Display 5m timeframe label |
| `frontend/src/components/MarketRegimePanel.tsx` | Modified | Show 1H trend label |
| `shared/src/events.ts` | Possibly Modified | Add new event type for 1H regime updates |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| EMA200 calculation differs significantly from expectations | Medium | Add comprehensive unit tests with known values; validate against TradingView |
| 5m candles cause UI performance issues | Low | 5m is actually LESS data than 1m (1/5th the update frequency); test with browser DevTools |
| Dual connections increase resource usage | Low | REST poll is every 60min (minimal overhead); WebSocket is single connection |
| Race condition between REST and WebSocket | Low | Both use EventBus (async); REST only updates regime, WS drives real-time chart |
| Existing tests break due to interval changes | Medium | Update all test mocks from 1m to 5m; run full test suite |

## Rollback Plan

1. **Immediate rollback**: Revert to commit before this change
   ```bash
   git revert HEAD
   ```

2. **Selective rollback**: Keep changes but disable 1H polling
   - In `backend/src/index.ts`, comment out `BinanceRestClient1H` initialization
   - Revert `BinanceWsClient.ts` interval back to '1m'
   - Restore `MarketRegimeDetector` to aggregate 1m→15m logic

3. **Data safety**: No database migrations - all state is in-memory, rollback is safe

## Dependencies

- Existing `EMA` and `ADX` indicator classes (must support 1H candles)
- EventBus implementation (no changes needed)
- Binance API availability (public endpoints, no auth)

## Success Criteria

- [ ] `BinanceRestClient1H` fetches 200 1H candles successfully
- [ ] EMA200 and ADX14 calculated correctly on 1H data (validated against known values)
- [ ] `market_regime_1h_updated` event emitted every 60 minutes
- [ ] WebSocket client streams 5m candles (`@kline_5m`)
- [ ] 5m→15m aggregation produces correct VWAP values
- [ ] Frontend displays "5m" on chart and "1H Trend" on regime panel
- [ ] All tests pass (existing + new)
- [ ] No console errors during 10-minute runtime test
- [ ] Regime changes detected within 60 minutes of actual trend shift
