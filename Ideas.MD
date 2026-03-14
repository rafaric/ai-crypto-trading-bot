# PRD — AI Crypto Trading Agent

## 1. Objetivo

Desarrollar un sistema automatizado de análisis y trading de criptomonedas que:

- Analice hasta **10 pares de altcoins**
- Detecte **estructuras de mercado automáticamente**
- Genere **señales de trading**
- Permita **ejecución automática opcional**
- Utilice **multi-timeframe analysis**
- Detecte **zonas de soporte y resistencia automáticamente**
- Evalúe **confluencias técnicas mediante un sistema de scoring**

El sistema debe poder funcionar en dos modos:

| Modo | Descripción |
|-----|-------------|
SIGNAL MODE | solo genera señales |
AUTO TRADE MODE | ejecuta operaciones |

El usuario podrá cambiar entre modos mediante un interruptor manual.

---

# 2. Arquitectura del Sistema

Arquitectura modular:

Market Data Service
↓
Candles Cache
↓
Market Scanner
↓
Indicator Engine
↓
Support/Resistance Engine
↓
Strategy Engine
↓
Signal Generator
↓
Risk Manager
↓
Execution Engine

Cada módulo debe ser **independiente y desacoplado**.

---

# 3. Market Data Service

Responsable de obtener datos del exchange.

Funciones:

- descargar histórico inicial
- suscribirse a datos en tiempo real
- actualizar velas
- alimentar el cache de mercado

Datos utilizados:

OHLCV
timestamp
volumen

---

# 4. Candles Cache

Mantiene en memoria las últimas velas por par y timeframe.

Estructura sugerida:

candlesCache = {
SOLUSDT: {
"1h": [],
"15m": [],
"5m": []
}
}

Cantidad recomendada:

200 - 300 velas

---

# 5. Multi Timeframe Analysis

El sistema utilizará tres temporalidades.

## 1H — Tendencia principal

Define el contexto macro.

Regla básica:

precio > EMA200 → tendencia alcista
precio < EMA200 → tendencia bajista


Resultado:

trend = BULLISH | BEARISH | SIDEWAYS

---

## 15m — Detección de setups

Se buscan estructuras como:

pullbacks
consolidaciones
rupturas

---

## 5m — Confirmación de entrada

Se utiliza para timing de entrada.

Ejemplos:

vela engulfing
pin bar
ruptura microestructura
volumen creciente

---

# 6. Market Scanner

Actúa como radar del mercado.

Busca pares con condiciones favorables antes de analizar estrategias.

Condiciones principales:

consolidación
volatilidad decreciente
volumen creciente

Si se cumplen:
BREAKOUT_CANDIDATE

Esto permite que solo algunos pares pasen al análisis profundo.

---

# 7. Indicator Engine

Calcula indicadores técnicos cuando **cierra una vela**.

Indicadores iniciales:

EMA 200
RSI 14
VWAP
MACD
ATR

Los cálculos se ejecutan:

onCandleClose()

---

# 8. Support & Resistance Engine

Detecta niveles automáticamente en:
1H
15m

Los niveles deben representarse como **zonas de precio**, no precios exactos.

Ejemplo:

resistance zone
24.80 — 25.10


Estructura sugerida:

resistanceZone = {
low: 24.80,
high: 25.10,
touches: 4,
timeframe: "1h"
}

---

# 9. Confluencia de Niveles

El sistema debe detectar cuando niveles de distintas temporalidades se superponen.

Ejemplo:

1H resistencia → 24.80 — 25.10
15m resistencia → 24.95 — 25.02

Resultado:
HIGH CONFIDENCE ZONE

Esto incrementa la probabilidad del setup.

---

# 10. Estrategias de Trading

El sistema debe permitir activar o desactivar estrategias.

Configuración:

strategyConfig = {
pullbackStrategy: true,
breakoutRetestStrategy: true
}

---

# 10.1 Pullback Strategy

Condiciones LONG:
trend 1H = bullish
precio > EMA200
RSI 40-50
precio cerca VWAP
vela alcista
volumen creciente

Entrada:

ruptura máximo vela confirmación


Stop:

debajo mínimo reciente

---

# 10.2 Breakout + Retest Strategy

Condiciones:

consolidación previa
ruptura con volumen
retest del nivel
vela rechazo


Entrada:

confirmación retest

Stop:

debajo del nivel roto

---

# 11. Signal Generator

Convierte setups en señales estructuradas.

Ejemplo:

{
pair: "SOLUSDT",
timeframe: "15m",
signal: "LONG",
entry: 162.80,
stop: 160.90,
tp: 166.20,
score: 0.81,
strategy: "breakout_retest"
}

---

# 12. Sistema de Scoring

Cada señal recibe un score basado en confluencias.

Ejemplo:

trend alignment = 0.2
support/resistance confluence = 0.3
RSI zone = 0.2
volume spike = 0.2
candle confirmation = 0.1


Score total:
0 — 1

El bot solo ejecuta trades si:

score > 0.7

---

# 13. Risk Manager

Protege el capital contra sobreoperación.

Reglas iniciales:

max trades simultáneos = 3
riesgo por trade = 1%
max pérdida diaria = 3%
max trades por par cada 2h

Stop Loss obligatorio.

---

# 14. Execution Engine

Responsable de ejecutar órdenes.

Controlado por interruptor:


Stop Loss obligatorio.

---

# 14. Execution Engine

Responsable de ejecutar órdenes.

Controlado por interruptor:

AUTO_TRADING = true | false

Comportamiento:

| Estado | Acción |
|------|------|
false | solo generar señales |
true | ejecutar trade |

---

# 15. Pares Analizados

Máximo permitido:

10 pares

Ejemplo:

SOLUSDT
DOGEUSDT
XRPUSDT
ADAUSDT
TRXUSDT
AAVEUSDT
AVAXUSDT
LINKUSDT
MATICUSDT
ARBUSDT


---

# 16. Dashboard

Interfaz para monitorear el sistema.

Paneles:

### Control

AUTO TRADING ON/OFF
balance
PnL diario


### Señales

lista de señales
score
estrategia detectada

### Trades

trades abiertos
histórico trades

---

# 17. Flujo del Sistema

Flujo principal:

start bot
↓
descargar histórico
↓
calcular indicadores
↓
actualizar niveles S/R
↓
market scanner
↓
detectar setups
↓
generar señal
↓
risk manager
↓
si AUTO_TRADING → ejecutar trade


---
# 18 FRONTEND
React + Lightweight Charts + datos del bot con websocket 

-Visualizar 
EMA

RSI

VWAP

volumen

soportes

resistencias

zonas de liquidez

señales

### ARQUITECTURA DEL DASHBOARD
┌──────────────────────────────────────┐
│            CHART PANEL               │
├───────────────┬──────────────────────┤
│ MARKET SCAN   │ SIGNALS PANEL        │
├───────────────┴──────────────────────┤
│ TRADES / RISK PANEL                  │
└──────────────────────────────────────┘

-- 1- CHART PANEL
- Mostrará:

* velas
* EMA200
* VWAP
* RSI
* volumen
* soportes
* resistencias
* zonas detectadas
* señales del bot

- Poder activar:
modo aprendizaje

El gráfico puede tener capas activables.

Ejemplo:

☑ señales del bot
☑ soportes
☑ resistencias
☑ zonas detectadas
☑ VWAP
☑ EMA


Esto te permite analizar el mercado con distintas perspectivas.a

- El bot dibuja:

zona detectada
consolidación
breakout detectado
entrada sugerida

Esto te permite ver cómo piensa el algoritmo.

-- 2 - Market Scanner Panel

Este panel muestra qué está pasando en todo el mercado que analiza el bot.

Ejemplo:

PAIR      STATUS
SOL       CONSOLIDATION
DOGE      BREAKOUT WATCH
XRP       TRENDING
ADA       NO SETUP


- El scanner detecta cosas como:

* consolidaciones

* compresión de volatilidad

* aumento de volumen

Relacionado con el concepto de Volatility Contraction.

Así puedes saber dónde mirar primero.

-- 3 - Signals Panel

Aquí aparecen las señales detectadas.

Ejemplo:

PAIR   SETUP              SCORE
SOL    BREAKOUT RETEST    0.82
DOGE   PULLBACK TREND     0.76
ADA    BREAKOUT WATCH     0.71


Cada señal puede mostrar:

entrada
stop
take profit
estrategia


Si activas auto trading:

status → EXECUTED

-- 4 - Trades & Risk Panel

Este panel controla el riesgo.

Ejemplo:

BALANCE
PNL DEL DIA
TRADES ABIERTOS
RIESGO ACTUAL


Ejemplo visual:

balance: 120 USDT
PnL diario: +3.4%
trades abiertos: 2
riesgo usado: 1.8%


Aquí también puedes poner el interruptor del bot:

AUTO TRADING
ON / OFF

-- Agregar un panel de explicación del bot.

Ejemplo cuando detecta señal:

SETUP DETECTED

Pair: SOL
Strategy: Breakout Retest

Trend 1H: Bullish
RSI: 44
VWAP: near price
Volume: increasing
Score: 0.81


Esto te ayuda a entrenar tu lectura de mercado.

Si el gráfico también muestra:

operaciones pasadas
zonas detectadas
setup detectado


Puedes revisar errores del bot visualmente.

Eso mejora muchísimo el sistema.

-- Mostrar el par seleccionado manualmente, pero cuando aparece una señal importante:

popup
↓
click
↓
ir al gráfico

# 19. Arquitectura del proyecto (bot + dashboard)

Te propongo una arquitectura limpia y escalable.

project
│
├── backend
│
├── frontend
│
└── shared

** Backend (el bot)
backend
│
├── config
│   strategy.config.js
│   risk.config.js
│
├── market
│   marketScanner.js
│   marketData.js
│
├── indicators
│   rsi.js
│   macd.js
│   vwap.js
│   ema.js
│   atr.js
│
├── marketStructure
│   supportResistance.js
│   consolidationDetector.js
│
├── strategies
│   pullbackStrategy.js
│   breakoutRetestStrategy.js
│
├── engine
│   strategyEngine.js
│   signalGenerator.js
│   scoringEngine.js
│
├── risk
│   riskManager.js
│
├── execution
│   tradeExecutor.js
│
├── services
│   websocketService.js
│   exchangeService.js
│
└── app.js

** Frontend (dashboard)

Hecho con React.

frontend
│
├── components
│
├── charts
│   priceChart.jsx
│   volumeChart.jsx
│
├── panels
│   scannerPanel.jsx
│   signalsPanel.jsx
│   tradesPanel.jsx
│
├── hooks
│   useMarketData.js
│
├── services
│   websocketClient.js
│
└── pages
    dashboard.jsx

** Shared (muy útil)

Código compartido entre frontend y backend.

shared
│
├── types
│   signal.js
│
├── constants
│   pairs.js
│
└── utils
    math.js


Algo MUY útil para tu bot

Guardar todos los eventos del bot.

Ejemplo:

logs
│
├── signals.log
├── trades.log
└── errors.log


Esto te permite:

debuggear
mejorar estrategias
analizar errores

# 20. Flujo completo del sistema

Exchange Data
↓
Market Data Service
↓
Indicator Engine
↓
Market Scanner
↓
Strategy Engine
↓
Signal Generator
↓
Risk Manager
↓
Execution Engine
↓
Dashboard

# 21. Base de datos
Qué deberías guardar en la base de datos

Un bot serio normalmente guarda 4 tipos de información.

market data
signals
trades
metrics


Esto te permite analizar después:

qué setups funcionan
cuándo falla el bot
qué pares son más rentables


-- Tabla: Signals

Cada vez que el bot detecta una oportunidad se guarda.

signals


Ejemplo de estructura:

id
pair
timeframe
strategy
signal_type
score
entry_price
stop_price
tp_price
created_at
status


Ejemplo real:

SOLUSDT
15m
breakout_retest
LONG
0.82
162.80
160.90
166.20


Esto es oro para mejorar estrategias.

Tabla: Trades

Cuando el bot ejecuta una operación.

trades


Campos:

id
pair
side
entry_price
exit_price
stop_price
take_profit
position_size
pnl
opened_at
closed_at
strategy


Esto te permite calcular:

profit factor
win rate
drawdown

Tabla: Bot Events

Muy útil para debug.

bot_events


Ejemplo:

id
event_type
message
pair
timestamp


Ejemplo de evento:

signal_detected
breakout_retest detected
SOLUSDT

Para tu proyecto recomiendo:

opción 1 (la mejor)

PostgreSQL

Ventajas:

muy robusta

ideal para análisis

consultas complejas
-- Flujo de datos

Cuando el bot detecta una señal:
market scanner
↓
strategy engine
↓
signal generator
↓
guardar signal en DB
↓
risk manager
↓
trade executor
↓
guardar trade en DB




Los 3 patrones más útiles para tu bot

Para scalping / intraday en 15m:

1️⃣ Bullish / Bearish Engulfing

Muy fuerte cuando aparece en:

soporte

VWAP

EMA200

Patrón:

vela grande que "envuelve" la anterior


Ejemplo bullish:

roja pequeña
↓
verde grande que la cubre

2️⃣ Pin Bar (rechazo fuerte)

Señala rechazo de precio.

Características:

mecha larga
cuerpo pequeño


Muy útil en:

soportes
resistencias
breakout retest

3️⃣ Doji

Indica indecisión.

Sirve mucho para detectar:

posible reversión

3️⃣ Cómo se integraría en tu sistema

Recuerda el sistema de scoring que diseñamos.

Ejemplo de evaluación:

EMA200 tendencia
+
VWAP
+
RSI
+
volumen
+
patrón de vela


Ejemplo real:

precio sobre EMA200 → +2
RSI rebote → +1
volumen alto → +1
pin bar en soporte → +2


Score total:

6 / 10


Señal válida.

4️⃣ Ejemplo real de setup

Caso típico:

tendencia alcista
↓
retroceso a VWAP
↓
RSI cerca de 40
↓
pin bar alcista


Entrada:

LONG


Esto combina:

Relative Strength Index

Volume Weighted Average Price

5️⃣ Implementación simple en el bot

La detección es bastante simple.

Ejemplo bullish engulfing:

function isBullishEngulfing(prev, curr){

 return (
   prev.close < prev.open &&
   curr.close > curr.open &&
   curr.open < prev.close &&
   curr.close > prev.open
 )

}


Ejemplo pin bar:

function isPinBar(candle){

 const body = Math.abs(candle.close - candle.open)
 const wick = candle.high - candle.low

 return wick > body * 3

}

6️⃣ Algo importante para evitar señales falsas

Los patrones no deberían generar señales solos.

Siempre combinados con:

soporte/resistencia
volumen
tendencia

7️⃣ Dónde encaja en tu arquitectura

Nuevo módulo:

indicators
│
candlestickPatterns.js


El scanner lo usaría así:

marketScanner
↓
detectPatterns
↓
agregar al score

8️⃣ Algo muy interesante para tu dashboard

Cuando el bot detecta un patrón podrías mostrar:

pattern detected
PIN BAR
confidence: 0.78


Y marcarlo en el gráfico.

Con la librería:

Lightweight Charts

🚀 Te voy a mostrar algo MUY interesante para tu bot

Hay un módulo que multiplica la calidad de señales y casi nadie lo implementa bien:

market regime detection


El bot detecta automáticamente si el mercado está:

tendencial
lateral
alta volatilidad


Y activa o desactiva estrategias.

Esto mejora muchísimo las entradas.

# . Roadmap Futuro

Mejoras previstas:

detección automática de liquidez
volume profile
market regime detection
backtesting engine
machine learning scoring
multi-exchange trading




