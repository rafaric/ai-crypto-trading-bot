#!/bin/bash

# Script para lanzar el sub-agente de implementación
opencode delegate "Implementar IndicatorEngine con TDD estricto" --prompt "Eres un sub-agente de implementación SDD con TDD estricto. Debes seguir el ciclo RED → GREEN → REFACTOR para cada test.

## Tarea: Implementar IndicatorEngine

### Contexto del Proyecto
- EventBus ubicado en: backend/src/core/EventBus.ts
- 6 indicadores listos en backend/src/indicators/: EMA, VWAP, RSI, MACD, ATR, CandlestickPatterns
- Tienes que importar MarketTick desde ../../../shared/src/events

### Archivos a Crear (en orden TDD):

1. **PRIMERO - Tests (RED):** backend/src/engine/IndicatorEngine.test.ts
   - Mockear EventBus
   - Test: Engine se subscribe a 'candle_closed'
   - Test: Cuando recibe candle, calcula indicadores y emite 'indicators_updated'
   - Test: Cuando detecta patrón, emite 'signal_detected'
   - Test: Cache de candles está acotada (max 300)
   - Test: Todos los indicadores se calculan (EMA, RSI, MACD, VWAP, ATR, CandlestickPatterns)

2. **DESPUÉS - Implementación (GREEN):** backend/src/engine/IndicatorEngine.ts
   - Acepta EventBus en constructor
   - Mantiene cache de candles (acotado a 300)
   - Cuando 'candle_closed', calcula TODOS los indicadores
   - Emite 'indicators_updated' con valores calculados
   - Emite 'signal_detected' cuando patrones/indicadores alinean

### Pasos a seguir:
1. PRIMERO lee los archivos existentes: EventBus.ts y los indicadores para entender las interfaces
2. ESCRIBE los tests - deben FALLAR inicialmente (RED)
3. Corre 'bun test' para confirmar que fallan
4. ESCRIBE la implementación mínima para que pasen (GREEN)
5. Corre 'bun test' para confirmar que pasan
6. REFACTOR si es necesario

### Estructura esperada del engine:
```typescript
export class IndicatorEngine {
  private eventBus: EventBus;
  private candlesCache: MarketTick[];
  private indicators: {
    ema: EMA;
    vwap: VWAP;
    rsi: RSI;
    macd: MACD;
    atr: ATR;
    candlestick: CandlestickPatterns;
  };
  
  constructor(eventBus: EventBus) { ... }
  private handleCandleClosed(candle: MarketTick): void { ... }
  private calculateAllIndicators(): IndicatorResult { ... }
  private checkForSignals(indicators: IndicatorResult): Signal | null { ... }
}
```

IMPORTANTE: Sigue TDD estricto - tests PRIMERO que fallen, luego implementación que haga pasar. No escribas implementación antes de tener tests fallando."
