# Delta: Infrastructure Layer - Multi-Timeframe Data Sources

## ADDED Requirements

### Requirement: BinanceRestClient1H - 1H Data Fetching

The system MUST provide a REST client that fetches 1-hour candle data from Binance API every 60 minutes.

The client SHALL:
- Poll Binance REST endpoint `GET /api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200` every 60 minutes
- Fetch exactly 200 candles of 1H data (approximately 8.3 days of history)
- Calculate EMA200 and ADX14 on the fetched data
- Emit `market_regime_1h_updated` event with regime analysis results
- Handle API errors gracefully with exponential backoff retry
- Start polling immediately upon initialization

#### Scenario: Successful 1H data fetch and regime calculation

- GIVEN the BinanceRestClient1H is initialized
- AND the Binance API returns 200 valid 1H candles
- WHEN the 60-minute polling interval triggers
- THEN the client fetches the data
- AND calculates EMA200 and ADX14
- AND emits `market_regime_1h_updated` event with regime, trendDirection, confidence, and timestamp

#### Scenario: API error handling with retry

- GIVEN the BinanceRestClient1H is polling
- AND the Binance API returns a 500 error
- WHEN the fetch attempt fails
- THEN the client waits with exponential backoff (1s, 2s, 4s, max 60s)
- AND retries the fetch
- AND logs the error for observability

#### Scenario: Regime change detection

- GIVEN previous regime was "RANGING"
- AND new calculation shows ADX > 25 with price above EMA200
- WHEN regime calculation completes
- THEN the client emits `market_regime_1h_updated` with regime "TRENDING_UP"
- AND includes confidence based on ADX value

### Requirement: BinanceRestClient1H - Configuration

The client MUST accept configuration for symbol, polling interval, and candle limit.

The client SHALL support:
- Configurable symbol (default: 'BTCUSDT')
- Configurable polling interval in minutes (default: 60)
- Configurable candle limit (default: 200, max: 1000 per Binance limits)
- Graceful shutdown to stop polling

#### Scenario: Custom configuration

- GIVEN configuration with symbol='ETHUSDT', intervalMinutes=30, limit=100
- WHEN the client initializes
- THEN it fetches ETHUSDT 1H candles
- AND polls every 30 minutes
- AND fetches 100 candles per request

## MODIFIED Requirements

### Requirement: BinanceWsClient - Timeframe Change

The WebSocket client MUST stream 5-minute candles instead of 1-minute candles.

(Previously: Connected to `@kline_1m` stream)

The client SHALL:
- Connect to `wss://stream.binance.com:9443/ws/btcusdt@kline_5m`
- Emit `candle_closed` events with 5m interval
- Maintain existing reconnection logic
- Keep all other functionality unchanged

#### Scenario: 5m candle streaming

- GIVEN the WebSocket client connects to Binance
- WHEN a 5m candle closes
- THEN the client emits `candle_closed` event
- AND the candle has interval='5m'
- AND all OHLCV data is present

#### Scenario: Reconnection maintains 5m stream

- GIVEN the WebSocket connection drops
- WHEN the client reconnects
- THEN it reconnects to `@kline_5m` stream
- AND continues emitting 5m candles

### Requirement: Dual Client Coordination

The system SHALL support both REST and WebSocket clients running simultaneously.

The backend MUST:
- Initialize both BinanceRestClient1H and BinanceWsClient
- Share the same EventBus instance between clients
- Allow REST client to operate independently (60min polling)
- Allow WebSocket client to operate independently (real-time 5m)
- Handle graceful shutdown of both clients

#### Scenario: Both clients active

- GIVEN backend initializes with both clients
- WHEN the system starts
- THEN WebSocket client connects immediately
- AND REST client starts its 60-minute polling timer
- AND both clients emit events to the same EventBus
- AND no interference occurs between the two data streams
