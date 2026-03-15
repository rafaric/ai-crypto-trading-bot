# Delta: Engine Layer - Multi-Timeframe Processing

## ADDED Requirements

### Requirement: MarketRegimeDetector - 1H Event Listening

The MarketRegimeDetector MUST listen to `market_regime_1h_updated` events instead of aggregating 1m candles.

(Previously: Aggregated 1m candles into 15m candles and calculated regime locally)

The detector SHALL:
- Subscribe to `market_regime_1h_updated` events from EventBus
- Update internal regime state when events are received
- Maintain backward compatibility with `getCurrentRegime()` method
- Continue emitting `market_regime_changed` only when regime actually changes
- Remove 1m→15m aggregation logic

#### Scenario: Receive 1H regime update

- GIVEN MarketRegimeDetector is initialized
- AND it is subscribed to EventBus
- WHEN `market_regime_1h_updated` event is published
- THEN the detector updates its current regime state
- AND if regime changed from previous state, emits `market_regime_changed`

#### Scenario: Regime stability - no duplicate events

- GIVEN current regime is "TRENDING_UP"
- AND new 1H event also indicates "TRENDING_UP"
- WHEN the event is received
- THEN the detector updates confidence value
- AND does NOT emit `market_regime_changed`

#### Scenario: Cleanup on shutdown

- GIVEN MarketRegimeDetector has an active subscription
- WHEN `unsubscribe()` is called
- THEN it removes the EventBus subscription
- AND stops processing regime events

### Requirement: IndicatorEngine - 5m to 15m Aggregation

The IndicatorEngine MUST aggregate 5m candles into 15m candles for VWAP calculation.

The engine SHALL:
- Receive 5m candles from `candle_closed` events
- Aggregate every 3 consecutive 5m candles into one 15m candle
- Calculate VWAP on the aggregated 15m candles
- Continue pattern detection on raw 5m candles
- Maintain bounded buffer for 5m candles (max 100)

#### Scenario: 5m to 15m aggregation

- GIVEN IndicatorEngine receives 5m candles
- WHEN 3 consecutive 5m candles close (candle1, candle2, candle3)
- THEN the engine creates one 15m candle with:
  - open = candle1.open
  - high = max(candle1.high, candle2.high, candle3.high)
  - low = min(candle1.low, candle2.low, candle3.low)
  - close = candle3.close
  - volume = sum of all three volumes
  - timestamp = candle1.timestamp
- AND calculates VWAP using the 15m candle

#### Scenario: Partial aggregation buffer

- GIVEN only 2 five-minute candles received
- WHEN VWAP calculation is triggered
- THEN calculation waits for the 3rd candle
- AND does not emit incomplete 15m data

#### Scenario: Pattern detection on 5m

- GIVEN 5m candles are streaming
- WHEN a pattern detection algorithm runs
- THEN it uses raw 5m candles (not aggregated)
- AND patterns are detected on 5m timeframe

## MODIFIED Requirements

### Requirement: EMA and ADX Indicators - 1H Compatibility

The existing EMA and ADX indicators MUST work correctly with 1H candles.

(Behavior unchanged - already timeframe-agnostic)

The indicators SHALL:
- Accept candles of any timeframe (1m, 5m, 1H, etc.)
- Calculate values based on provided candle data
- Return null if insufficient data for calculation
- Not assume any specific timeframe

#### Scenario: EMA200 on 1H data

- GIVEN 200 candles of 1H data
- WHEN EMA200.calculate() is called
- THEN it returns an array of 200 EMA values
- AND the last value is the current EMA200

#### Scenario: ADX14 on 1H data

- GIVEN at least 27 candles of 1H data (ADX14 requirement)
- WHEN ADX14.calculate() is called
- THEN it returns an array of ADX values
- AND values are calculated correctly for 1H timeframe
