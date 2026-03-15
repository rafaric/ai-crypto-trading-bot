# Delta: Frontend Layer - Timeframe Display

## ADDED Requirements

### Requirement: ChartPanel - 5m Timeframe Display

The ChartPanel MUST display that the chart is showing 5-minute candles.

The component SHALL:
- Show "5m" timeframe label on the chart
- Display candles as they arrive from WebSocket
- Update in real-time as new 5m candles close
- Maintain existing chart styling and colors

#### Scenario: Chart shows 5m label

- GIVEN ChartPanel is rendered
- WHEN the component mounts
- THEN it displays "Timeframe: 5m" label
- AND the label is visible in the chart header

#### Scenario: Real-time 5m updates

- GIVEN chart is displaying historical data
- WHEN a new 5m candle closes
- THEN the chart updates with the new candle
- AND the timeframe label remains "5m"

### Requirement: MarketRegimePanel - 1H Trend Display

The MarketRegimePanel MUST indicate that the regime analysis is based on 1H timeframe.

The component SHALL:
- Show "1H Trend" or similar label for the regime section
- Display the current regime (TRENDING_UP, TRENDING_DOWN, RANGING)
- Show confidence percentage
- Update when `market_regime_changed` events are received

#### Scenario: Regime panel shows 1H label

- GIVEN MarketRegimePanel is rendered
- WHEN regime data is available
- THEN it displays "1H Trend" label
- AND shows current regime with appropriate icon
- AND displays confidence percentage

#### Scenario: Regime change updates UI

- GIVEN current regime is "RANGING"
- WHEN `market_regime_changed` event indicates "TRENDING_UP"
- THEN the panel updates to show upward trend
- AND the background color changes to bullish theme
- AND confidence value updates

## MODIFIED Requirements

### Requirement: useMarketData Hook - Timeframe Handling

The useMarketData hook MUST handle 5m candles correctly.

(Previously: Processed 1m candles)

The hook SHALL:
- Receive 5m candles from WebSocket
- Maintain candle history in state
- Pass 5m candles to chart component
- Not break existing signal display logic

#### Scenario: Hook processes 5m candles

- GIVEN useMarketData hook is active
- WHEN 5m candle events are received
- THEN the hook adds candles to state
- AND maintains max 500 candles in history
- AND provides 5m candles to ChartPanel

### Requirement: SignalsPanel - Timeframe Consistency

The SignalsPanel MUST continue displaying signals without timeframe confusion.

The component SHALL:
- Show signals as they are generated
- Not display conflicting timeframe information
- Continue existing signal display logic

(Note: Signals are generated based on 5m patterns + 1H trend filter, but panel displays signal info only)
