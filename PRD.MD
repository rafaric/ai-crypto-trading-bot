# Product Requirements Document (PRD)
**Project Name:** AI Crypto Trading Agent  
**Document Status:** Draft / V1  
**Target:** Automated analysis, signal generation, and optional execution for crypto altcoins.

---

## 1. Executive Summary & Objective
El objetivo es desarrollar un sistema automatizado de análisis y trading de criptomonedas (hasta 10 pares de altcoins concurrentes) basado en reglas cuantitativas y análisis de múltiples temporalidades (Multi-Timeframe Analysis). 

El sistema debe detectar estructuras de mercado, evaluar el régimen del mercado (Tendencia vs Rango), identificar patrones de velas clave confluenciados en zonas de interés, generar señales de trading mediante un sistema de scoring y permitir tanto el consumo pasivo de señales como la ejecución automatizada con estrictas reglas de gestión de riesgo.

## 2. Scope & Operation Modes
El agente operará estrictamente bajo dos modos, controlables manualmente desde un Dashboard:

*   **SIGNAL MODE:** El sistema escanea, analiza y puntúa oportunidades. Solo genera alertas/señales de trading sin afectar el balance real.
*   **AUTO TRADE MODE:** El sistema genera las señales y, si cumplen los criterios de riesgo y capital, envía las órdenes al exchange de forma autónoma.

---

## 3. Functional Requirements

### 3.1. Market Data & State Management
*   **Market Data Service:** Debe manejar la descarga inicial de histórico, suscripción por websockets para datos en tiempo real (OHLCV, timestamp, volumen) y alimentar el estado del mercado.
*   **Candles Cache:** Gestión de estado en memoria. Debe mantener una ventana móvil de las últimas 200-300 velas por cada par y por cada timeframe.

### 3.2. Multi-Timeframe Analysis (MTF)
El motor de análisis debe procesar tres temporalidades de manera concurrente para generar contexto:
*   **1H (Macro Contexto):** Define la tendencia principal. (Ej: Precio > EMA200 = Bullish).
*   **15m (Setups):** Detección de patrones estructurales (pullbacks, consolidaciones, rupturas).
*   **5m (Timing/Trigger):** Confirmación exacta de entrada (velas engulfing, pin bar, rupturas de microestructura, picos de volumen).

### 3.3. Market Regime Detection & Indicators
*   **Market Regime Detection:** Motor clave que define el estado general de un par: `TRENDING` (Tendencial), `RANGING` (Lateral/Consolidación) o `HIGH_VOLATILITY` (Alta Volatilidad). Dependiendo del régimen, el bot activará o desactivará estrategias (ej: apagar *Breakout* en mercados de rango sin liquidez).
*   **Indicator Engine:** Cálculo reactivo en el evento `onCandleClose()`. Debe proveer: EMA200, RSI14, VWAP, MACD, ATR.
*   **Candlestick Pattern Engine:** Módulo dedicado para identificar patrones específicos en 15m y 5m:
    *   **Engulfing (Bullish/Bearish):** Vela que envuelve a la anterior, válido solo cerca de soportes/EMA/VWAP.
    *   **Pin Bar:** Mecha muy larga (3x del cuerpo) indicando rechazo en S/R o retest de breakouts.
    *   **Doji:** Indecisión, usado para marcar posibles puntos de reversión inminente.
    *   *Regla Estricta:* Los patrones de velas **nunca** generan señales aisladas. Solo suman puntos de confluencia al sistema de scoring si ocurren en zonas clave.

### 3.4. Support & Resistance (S/R) Engine
*   Debe detectar automáticamente niveles en 1H y 15m.
*   **Zonas vs Líneas:** Los niveles deben guardarse y procesarse como *zonas de precio* (ej: 24.80 - 25.10), incluyendo metadatos como cantidad de toques y timeframe.
*   **Confluencia:** Debe emitir un estado `HIGH CONFIDENCE ZONE` cuando las zonas de distintas temporalidades se superponen.

### 3.5. Market Scanner
*   Sistema de pre-filtro que evalúa el mercado constantemente buscando anomalías estructurales (consolidación, contracción de volatilidad, expansión de volumen). 
*   Clasifica los pares usando los regímenes detectados (ej: `BREAKOUT_WATCH`, `CONSOLIDATION`) para optimizar el procesamiento.

### 3.6. Strategies & Scoring System
El motor debe ser modular permitiendo activar/desactivar estrategias independientemente.
*   **Estrategia 1: Pullback Trend:** Tendencia alcista en 1H, retroceso a VWAP/EMA, RSI 40-50, pin bar/engulfing alcista en soporte y volumen creciente.
*   **Estrategia 2: Breakout + Retest:** Consolidación (Market Regime Ranging a punto de romper), ruptura con volumen alto, retest a la zona rota, aparición de Pin Bar de rechazo.
*   **Scoring System (0.0 a 10.0 o Normalizado 0.0 a 1.0):**
    Cada señal se valida por sumatoria de confluencias. *Ejemplo:* 
    *   EMA200 Tendencia Favor (+2)
    *   RSI en Zona Clave (+1)
    *   Volumen Alto (+1)
    *   Patrón de Vela (Pin Bar) en Soporte (+2)
    *   *Total = 6/10.* Si `score > 7` o `0.7`, la señal pasa a ejecución.

### 3.7. Risk Manager & Execution Engine
*   **Protección estricta de capital:** Ninguna orden se envía sin Stop Loss.
*   **Reglas de Risk Management:**
    *   Máximo 3 trades simultáneos en toda la cuenta.
    *   Riesgo máximo por trade: 1% del balance.
    *   Max Drawdown diario (límite de pérdida): 3%.
    *   Cooldown: Máximo 1 trade por par cada 2 horas.

### 3.8. Dashboard (Frontend UI)
*   **Chart Panel:** Integración de `lightweight-charts`. Visualización multicapa (velas, EMA, VWAP, S/R detectados). 
    *   **Feature Especial:** Mostrar explícitamente los patrones de vela detectados en el chart (Ej: popup/marca visual `PATTERN DETECTED: PIN BAR - confidence: 0.78`) para entender cómo lee el bot el mercado.
*   **Market Scan Panel:** Vista global del estado de los 10 pares cruzado con el Market Regime (`SOL - CONSOLIDATION`, `DOGE - BREAKOUT WATCH`).
*   **Signals Panel:** Lista en tiempo real de setups detectados, score detallado y estado.
*   **Trades & Risk Panel:** PnL diario, trades abiertos, riesgo expuesto y toggle de AUTO TRADING.
*   **Explainability:** Panel didáctico que detalla *por qué* el bot tomó una decisión (Score breakdown, valores de RSI, volumen, patrón de vela exacto detectado).

---

## 4. Technical Architecture

### 4.1. System Pipeline
`Exchange Websocket -> Market Data Service -> Candles Cache -> Indicators & Candlestick Engine -> Market Regime & S/R Engine -> Market Scanner -> Strategy Engine -> Signal Generator -> Scoring -> Risk Manager -> Execution Engine (if Auto)`

### 4.2. Recommended Tech Stack
*   **Backend / Trading Engine:** Node.js (TypeScript) - Arquitectura Event-Driven. Ideal para manejar concurrencia de websockets y streams de datos.
*   **Frontend:** React.js, TailwindCSS, `lightweight-charts` (TradingView). Websockets para UI updates en tiempo real.
*   **Base de Datos:** PostgreSQL. Necesario para queries analíticas complejas y persistencia relacional estricta.

### 4.3. Database Schema (Core Tables)
1.  **`market_data`**: (Opcional si se delega a proveedor, pero útil para backtesting).
2.  **`signals`**: id, pair, timeframe, strategy, signal_type, score, entry, stop, tp, status, created_at.
3.  **`trades`**: id, pair, side, entry_price, exit_price, pnl, position_size, opened_at, closed_at.
4.  **`bot_events`**: id, event_type, message, context (JSON), timestamp. (Crucial para debugging).

### 4.4. Project Structure (Monorepo/Separated)
Implementar arquitectura limpia separando dominios: Config, Market, Indicators (ahora incluye `candlestickPatterns.js`), MarketStructure (ahora incluye `marketRegime.js`), Strategies, Engine, Risk, Execution, Services. Compartir tipos y utilidades entre Backend y Frontend (Shared folder).

---

## 5. Roadmap & Future Enhancements (Post-V1)
*   Detección automática de liquidez y Volume Profile.
*   Backtesting Engine integrado en el mismo core.
*   Machine Learning Scoring (reemplazar pesos fijos por modelo entrenado).
*   Multi-Exchange (Binance, Bybit, OKX).