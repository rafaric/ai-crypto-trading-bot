import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import type { Time } from 'lightweight-charts';
import type { Candle, IndicatorSeries } from '../../../shared/src/events';

interface ChartPanelProps {
  candles: Candle[];
  indicators?: {
    ema?: number | null;
    emaSeries?: IndicatorSeries[];
    vwap?: number | null;
    vwapSeries?: IndicatorSeries[];
  };
}

export function ChartPanel({ candles, indicators }: ChartPanelProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('🎨 ChartPanel received:', {
      candles: candles.length,
      emaSeries: indicators?.emaSeries?.length,
      vwapSeries: indicators?.vwapSeries?.length,
      emaValue: indicators?.ema,
      vwapValue: indicators?.vwap,
    });
    
    if (!chartContainerRef.current || candles.length === 0) return;

    // Deduplicate candles by timestamp and sort
    const uniqueCandles = candles.filter((candle, index, self) =>
      index === self.findIndex((c) => c.timestamp === candle.timestamp)
    );
    uniqueCandles.sort((a, b) => a.timestamp - b.timestamp);

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#ccc',
      },
      timeScale: {
        borderColor: '#ccc',
        timeVisible: true,
        secondsVisible: false,
      },
      height: 400,
    });

    // Create candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Transform candles to chart format
    const chartData = uniqueCandles.map((candle) => ({
      time: (candle.timestamp / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    candlestickSeries.setData(chartData);

    // Add EMA line if series available
    if (indicators?.emaSeries && indicators.emaSeries.length > 0) {
      const emaLineSeries = chart.addSeries(LineSeries, {
        color: '#2196f3',
        lineWidth: 2,
        title: 'EMA 200',
      });

      const emaData = indicators.emaSeries.map((point) => ({
        time: (point.timestamp / 1000) as Time,
        value: point.value,
      }));

      emaLineSeries.setData(emaData);
    }

    // Add VWAP line if series available
    if (indicators?.vwapSeries && indicators.vwapSeries.length > 0) {
      const vwapLineSeries = chart.addSeries(LineSeries, {
        color: '#9c27b0',
        lineWidth: 2,
        title: 'VWAP',
      });

      const vwapData = indicators.vwapSeries.map((point) => ({
        time: (point.timestamp / 1000) as Time,
        value: point.value,
      }));

      vwapLineSeries.setData(vwapData);
    }

    // Add volume
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });
    
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const volumeData = uniqueCandles.map((candle, index) => {
      const prevClose = index > 0 ? uniqueCandles[index - 1].close : candle.open;
      const isUp = candle.close >= prevClose;
      return {
        time: (candle.timestamp / 1000) as Time,
        value: candle.volume,
        color: isUp ? '#26a69a' : '#ef5350',
      };
    });
    
    volumeSeries.setData(volumeData);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, indicators]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">BTC/USDT Chart</h2>
        <div className="flex gap-4 text-sm">
          {indicators?.ema && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-blue-500"></span>
              EMA 200: {indicators.ema.toFixed(2)}
            </span>
          )}
          {indicators?.vwap && (
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-purple-500"></span>
              VWAP: {indicators.vwap.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" />
      {candles.length === 0 && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Waiting for candle data...
        </div>
      )}
    </div>
  );
}