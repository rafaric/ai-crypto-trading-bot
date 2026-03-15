import React from 'react';
import type { MarketRegime } from '../hooks/useMarketData';

interface MarketRegimePanelProps {
  regime: MarketRegime | null;
}

export const MarketRegimePanel: React.FC<MarketRegimePanelProps> = ({ regime }) => {
  if (!regime) {
    return (
      <div className="market-regime-panel" style={styles.container}>
        <h3 style={styles.title}>Market Regime</h3>
        <div style={styles.loading}>Analyzing market conditions...</div>
      </div>
    );
  }

  const getRegimeStyles = () => {
    switch (regime.regime) {
      case 'TRENDING_UP':
        return {
          backgroundColor: '#10b981',
          color: 'white',
          borderColor: '#059669',
        };
      case 'TRENDING_DOWN':
        return {
          backgroundColor: '#ef4444',
          color: 'white',
          borderColor: '#dc2626',
        };
      case 'RANGING':
        return {
          backgroundColor: '#6b7280',
          color: 'white',
          borderColor: '#4b5563',
        };
      default:
        return {
          backgroundColor: '#6b7280',
          color: 'white',
          borderColor: '#4b5563',
        };
    }
  };

  const getRegimeEmoji = () => {
    switch (regime.regime) {
      case 'TRENDING_UP':
        return '📈';
      case 'TRENDING_DOWN':
        return '📉';
      case 'RANGING':
        return '➡️';
      default:
        return '❓';
    }
  };

  const getTrendLabel = () => {
    switch (regime.trendDirection) {
      case 'BULLISH':
        return 'Bullish Trend';
      case 'BEARISH':
        return 'Bearish Trend';
      case 'NEUTRAL':
        return 'Neutral / Ranging';
      default:
        return 'Unknown';
    }
  };

  const getSignalInstruction = () => {
    switch (regime.regime) {
      case 'TRENDING_UP':
        return 'Only BUY signals allowed';
      case 'TRENDING_DOWN':
        return 'Only SELL signals allowed';
      case 'RANGING':
        return 'No signals - avoid trading';
      default:
        return '';
    }
  };

  const regimeStyles = getRegimeStyles();

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>1H Trend Analysis</h3>
      <div
        style={{
          ...styles.regimeCard,
          backgroundColor: regimeStyles.backgroundColor,
          borderColor: regimeStyles.borderColor,
        }}
      >
        <div style={styles.regimeHeader}>
          <span style={styles.emoji}>{getRegimeEmoji()}</span>
          <span style={styles.regimeName}>{regime.regime.replace('_', ' ')}</span>
        </div>
        <div style={styles.trendLabel}>{getTrendLabel()}</div>
        <div style={styles.confidence}>
          Confidence: {(regime.confidence * 100).toFixed(0)}%
        </div>
        <div style={styles.instruction}>{getSignalInstruction()}</div>
      </div>
      <div style={styles.explanation}>
        <small>
          Based on 1H timeframe: EMA 200 + ADX
          <br />
          Signals filtered to trade only with the trend
        </small>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '16px',
    backgroundColor: '#1f2937',
    borderRadius: '8px',
    border: '1px solid #374151',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#f3f4f6',
  },
  loading: {
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  regimeCard: {
    padding: '16px',
    borderRadius: '8px',
    border: '2px solid',
    textAlign: 'center',
  },
  regimeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  emoji: {
    fontSize: '24px',
  },
  regimeName: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'white',
  },
  trendLabel: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: '4px',
  },
  confidence: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: '8px',
  },
  instruction: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '4px',
    display: 'inline-block',
  },
  explanation: {
    marginTop: '12px',
    color: '#9ca3af',
    fontSize: '11px',
    lineHeight: '1.4',
  },
};
