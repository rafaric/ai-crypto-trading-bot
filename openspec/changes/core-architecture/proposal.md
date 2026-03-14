# Proposal: Core Architecture & Data Flow

## Intent
Establish a robust, scalable, and modular foundation for the AI Crypto Trading Agent. The architecture must seamlessly handle real-time market data from BingX, maintain accurate in-memory states (candles cache), and process an event-driven flow from data ingestion to signal generation and execution. We need a structure that allows for easy addition of new strategies, indicators, and risk rules without tight coupling.

## Scope

### In Scope
- Define a Monorepo structure containing `backend` (Node.js/TypeScript), `frontend` (React), and `shared` (Types, Utils).
- Establish the Event-Driven Pipeline: Websocket Client → Market Data Service → Candles Cache → Scanner → Indicator Engine → Strategy Engine → Risk Manager → Execution Engine.
- Design the state management solution for the Candles Cache (in-memory ring buffers per pair and timeframe).
- Integrate PostgreSQL schema foundations for logging signals, trades, and system events.
- Implement the BingX integration as the primary exchange for both market data (websockets) and execution (REST/Websockets).

### Out of Scope
- Implementation of specific complex trading strategies (these will be separate changes once the core is stable).
- Backtesting Engine (planned for Post-V1).
- Machine Learning Scoring models.
- Multi-exchange support (only BingX for now).

## Approach
We will adopt a Modular Event-Driven Architecture within a Monorepo workspace (e.g., using npm workspaces or TurboRepo).

1. **Monorepo**:
   - `/backend`: Contains the core trading daemon.
   - `/frontend`: Contains the React-based Dashboard.
   - `/shared`: Contains shared TypeScript interfaces (e.g., `Signal`, `Trade`, `Candle`) and constants (supported pairs, timeframes).

2. **State Management (Candles Cache)**:
   - A centralized in-memory state manager (e.g., a singleton or dependency-injected service) holding a fixed-size queue (200-300 elements) for each Pair + Timeframe combination (e.g., `SOLUSDT: { "1h": [], "15m": [], "5m": [] }`).
   - The cache emits an `onCandleClose` event when a new candle is formed, triggering the downstream pipeline.

3. **Event-Driven Data Flow**:
   - `BingX Websocket` pushes trade/kline updates.
   - `Market Data Service` aggregates ticks and updates the `Candles Cache`.
   - On `onCandleClose`, the `Scanner` evaluates the Market Regime.
   - The `Indicator Engine` calculates EMA, RSI, VWAP and emits updated state.
   - The `Support/Resistance Engine` and `Candlestick Pattern Engine` evaluate the new candle.
   - The `Strategy Engine` checks for confluences and emits a `Signal`.
   - The `Risk Manager` intercepts the signal; if `AUTO_TRADING` is ON and risk checks pass, it forwards to the `Execution Engine` (BingX REST API).

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `/backend/src/market` | New | Ingestion services for BingX and the Candles Cache |
| `/backend/src/engine` | New | Event buses and orchestrator for the pipeline |
| `/shared/types` | New | Global domain models (Candle, Signal, Pair) |
| `/docker-compose.yml` | New | PostgreSQL database setup |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Memory leaks in Candles Cache | High | Implement strict ring-buffers (fixed arrays) and avoid unbounded object growth. |
| Websocket disconnections | High | Implement automatic reconnection logic and state recovery (fetch missing candles via REST upon reconnect). |
| Race conditions in event processing | Medium | Process candle updates sequentially per pair, using a message queue or strict async/await chains. |

## Rollback Plan
Since this is the foundational setup, if the architecture proves inefficient during initial load testing, we will revert the core event bus to a simpler polling mechanism, or restructure the state management from in-memory arrays to a lightweight in-memory store like Redis (though avoiding Redis reduces complexity for V1).

## Dependencies
- Node.js environment
- PostgreSQL instance (Docker)
- BingX API Keys (Testnet/Mainnet)
- `ws` or `socket.io-client` for websockets
- `pg` or an ORM like `Prisma`/`TypeORM` for database interactions

## Success Criteria
- [ ] Monorepo structure is initialized and successfully builds `backend`, `frontend`, and `shared`.
- [ ] BingX Websocket connects, receives kline data, and correctly updates the in-memory Candles Cache without leaks.
- [ ] An `onCandleClose` event successfully traverses the entire pipeline from the Cache to a mocked Risk Manager.
- [ ] PostgreSQL schema is created and can save a mock `Signal` and `BotEvent`.
