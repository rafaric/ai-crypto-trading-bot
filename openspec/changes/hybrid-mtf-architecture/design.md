# Design: Hybrid Multi-Timeframe Architecture

## Technical Approach

Implement a **dual-client architecture** that separates macro trend analysis (1H timeframe via REST polling) from micro signal detection (5m timeframe via WebSocket streaming). This follows Clean Architecture principles with:

1. **Timeframe-specific clients** - Each client handles one timeframe, no mixing concerns
2. **Event-driven coordination** - Both clients publish to shared EventBus, components subscribe to relevant events
3. **Immutable data flow** - Candles flow downstream, regime events flow laterally
4. **Backward compatibility** - Existing interfaces preserved, only data sources change

## Architecture Decisions

### Decision: Dual Client Pattern Over Single Aggregator

**Choice**: Create separate `BinanceRestClient1H` and modify `BinanceWsClient` (5m) instead of building a unified aggregation service.

**Alternatives considered**:
- Single aggregator that manages both REST and WebSocket with internal routing (rejected - too complex)
- WebSocket multiplexing for multiple timeframes (rejected - Binance doesn't support @kline_1h on WebSocket efficiently)

**Rationale**: 
- REST for 1H is actually MORE efficient (1 request/hour vs continuous WebSocket overhead)
- Separation of concerns: REST client does regime calculation, WS client streams chart data
- Easier to test and reason about
- Follows existing pattern in codebase (BinanceRestClient already exists)

### Decision: EventBus for Inter-Client Communication

**Choice**: Use existing EventBus to publish `market_regime_1h_updated` from REST client to MarketRegimeDetector.

**Alternatives considered**:
- Direct method calls between clients (rejected - creates coupling)
- Shared state/store (rejected - overkill for this use case)

**Rationale**:
- EventBus already established in codebase
- Decouples REST client from regime detector
- Allows multiple consumers of regime data (detector, logging, future features)
- Matches existing pattern (candle_closed events)

### Decision: 3:1 Aggregation for 15m VWAP

**Choice**: Aggregate 3 consecutive 5m candles into 1 fifteen-minute candle for VWAP calculation.

**Alternatives considered**:
- Keep separate 15m WebSocket stream (rejected - adds unnecessary connection)
- Calculate VWAP directly on 5m (rejected - changes VWAP semantics significantly)

**Rationale**:
- Mathematically correct: 3 × 5m = 15m
- VWAP is typically calculated on 15m or higher for swing trading
- Aggregation logic is simple and testable
- Maintains "true MTF separation" principle

### Decision: Keep Existing EMA/ADX Classes

**Choice**: Reuse existing `EMA` and `ADX` indicator classes without modification.

**Rationale**:
- Both classes are already timeframe-agnostic (they just process Candle arrays)
- EMA200 calculation is the same whether fed 1m, 5m, or 1H candles
- No need to duplicate indicator logic
- Proven and tested implementations

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                           BINANCE API                               │
└────────────────────────┬──────────────────────┬─────────────────────┘
                         │                      │
         REST (1h)       │         WebSocket (5m)
                         │                      │
    ┌────────────────────▼──────┐    ┌─────────▼────────────┐
    │  BinanceRestClient1H      │    │  BinanceWsClient     │
    │  - Polls every 60min      │    │  - Streams real-time │
    │  - Calculates EMA200      │    │  - Emits 5m candles  │
    │  - Calculates ADX14       │    └──────────┬───────────┘
    │  - Emits regime event     │               │
    └──────────┬────────────────┘               │
               │                                │
               │ market_regime_1h_updated       │ candle_closed (5m)
               │                                │
    ┌──────────▼──────────────┐    ┌────────────▼───────────┐
    │  MarketRegimeDetector   │    │  IndicatorEngine       │
    │  - Receives 1H regime   │    │  - Receives 5m candles │
    │  - Emits if changed     │    │  - Aggregates 5m→15m   │
    │                         │    │  - Calculates VWAP     │
    └──────────┬──────────────┘    │  - Detects patterns    │
               │                   └────────────┬───────────┘
               │ market_regime_changed          │
               │                                │ indicators_updated
               │                                │
    ┌──────────▼────────────────────────────────▼───────────┐
    │                    EventBus                            │
    └──────────┬───────────────────────────────┬─────────────┘
               │                               │
    ┌──────────▼───────────┐      ┌────────────▼────────────┐
    │  Frontend Gateway    │      │  PaperTradingEngine     │
    │  (WebSocket to UI)   │      │  (Signal execution)     │
    └──────────┬───────────┘      └─────────────────────────┘
               │
    ┌──────────▼───────────┐
    │  React Frontend      │
    │  - ChartPanel (5m)   │
    │  - MarketRegimePanel │
    │  - SignalsPanel      │
    └──────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/infrastructure/BinanceRestClient1H.ts` | Create | New REST client for 1H data with 60min polling, EMA200+ADX14 calculation, regime event emission |
| `backend/src/infrastructure/BinanceRestClient1H.test.ts` | Create | Unit tests for REST client with mocked fetch and timer logic |
| `backend/src/infrastructure/BinanceWsClient.ts` | Modify | Change default interval from '1m' to '5m', update WebSocket URL construction |
| `backend/src/infrastructure/BinanceWsClient.test.ts` | Modify | Update test mocks and expectations for 5m timeframe |
| `backend/src/index.ts` | Modify | Initialize BinanceRestClient1H with 60min polling, pass symbol config to both clients |
| `backend/src/engine/MarketRegimeDetector.ts` | Modify | Remove 1m→15m aggregation, subscribe to `market_regime_1h_updated`, update regime from event |
| `backend/src/engine/MarketRegimeDetector.test.ts` | Modify | Update tests to mock 1H regime events instead of 1m candles |
| `backend/src/engine/IndicatorEngine.ts` | Modify | Add 5m→15m aggregation logic (3:1), update VWAP calculation to use aggregated candles |
| `shared/src/events.ts` | Modify | Add `MarketRegime1HUpdated` event type definition |
| `frontend/src/components/ChartPanel.tsx` | Modify | Add "5m" timeframe label in header |
| `frontend/src/components/MarketRegimePanel.tsx` | Modify | Change explanation text to reference "1H timeframe: EMA 200 + ADX" |

## Interfaces / Contracts

### New Event Type

```typescript
// shared/src/events.ts
export interface MarketRegime1HUpdated {
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';
  trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  timestamp: number;
  ema200: number;      // Current EMA200 value
  adx14: number;       // Current ADX14 value
  price: number;       // Current price (last close)
}
```

### BinanceRestClient1H Interface

```typescript
interface BinanceRestClient1HConfig {
  symbol: string;           // e.g., 'BTCUSDT'
  pollingIntervalMinutes?: number;  // default: 60
  candleLimit?: number;     // default: 200
}

class BinanceRestClient1H {
  constructor(eventBus: EventBus, config: BinanceRestClient1HConfig);
  start(): void;           // Begin polling
  stop(): void;            // Stop polling and cleanup
  private fetchAndCalculate(): Promise<void>;
  private calculateRegime(candles: Candle[]): MarketRegime1HUpdated;
}
```

### 5m to 15m Aggregation Logic

```typescript
// In IndicatorEngine
private fiveMinuteCandles: Candle[] = [];
private fifteenMinuteCandles: Candle[] = [];

private aggregateTo15m(candles5m: Candle[]): Candle | null {
  this.fiveMinuteCandles.push(...candles5m);
  
  if (this.fiveMinuteCandles.length < 3) {
    return null; // Wait for 3 candles
  }
  
  const toAggregate = this.fiveMinuteCandles.splice(0, 3);
  
  return {
    symbol: toAggregate[0].symbol,
    open: toAggregate[0].open,
    high: Math.max(...toAggregate.map(c => c.high)),
    low: Math.min(...toAggregate.map(c => c.low)),
    close: toAggregate[2].close,
    volume: toAggregate.reduce((sum, c) => sum + c.volume, 0),
    timestamp: toAggregate[0].timestamp,
    isClosed: true,
    interval: '15m',
  };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | BinanceRestClient1H | Mock `fetch` for Binance API, use Jest fake timers for 60min polling, verify EMA200/ADX14 calculations against known values |
| **Unit** | BinanceWsClient interval change | Update existing tests to expect '5m' instead of '1m' in candle.interval |
| **Unit** | MarketRegimeDetector | Mock EventBus to emit `market_regime_1h_updated`, verify regime state updates correctly |
| **Unit** | IndicatorEngine aggregation | Feed 6 consecutive 5m candles, verify exactly 2 fifteen-minute candles produced with correct OHLCV |
| **Integration** | Dual client coordination | Start both clients with mock EventBus, verify both publish to same bus, no interference |
| **E2E** | Frontend timeframe labels | Render ChartPanel and MarketRegimePanel, verify "5m" and "1H" labels visible |

## Migration / Rollback

**No database migration required** - all state is in-memory.

### Rollback Steps
1. Stop backend process
2. Revert file changes using git
3. Restart backend

### Feature Flag (Optional)
If deploying to production, could add temporary flag:
```typescript
const USE_1H_REST_API = process.env.USE_1H_REST_API === 'true';
```
Default to false initially, enable after validation.

## Open Questions

- [ ] **EMA200 validation**: Should we validate calculated EMA200 against TradingView or another source for accuracy?
- [ ] **Polling timing**: Is 60 minutes optimal, or should we poll at market-open boundaries (e.g., every hour at :00)?
- [ ] **VWAP period**: Current VWAP uses period 14 on 15m candles. Should this be adjusted for 5m→15m aggregation?
