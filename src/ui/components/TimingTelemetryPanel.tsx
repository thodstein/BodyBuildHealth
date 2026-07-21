import React from 'react';
import { useTimingTelemetry } from '../hooks/useTimingTelemetry';
import { TimingTelemetryBadge } from '../../engines/interactions-calculator';

/**
 * Dev-mode панель телеметрии: показывает miss rate, рекомендации.
 * Использовать в <UnifiedView/> или в любом месте для мониторинга.
 */
export const TimingTelemetryPanel: React.FC<{ autoRefreshMs?: number }> = ({ autoRefreshMs = 2000 }) => {
  const { state, reset } = useTimingTelemetry(autoRefreshMs);
  const badge = TimingTelemetryBadge();

  return (
    <div style={{
      marginTop: 8, padding: '8px 10px', borderRadius: 8,
      background: 'rgba(96,165,250,0.05)', border: '1px dashed rgba(96,165,250,0.25)',
      fontSize: 10, color: 'var(--text-dim)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: badge.color, fontWeight: 700 }}>{badge.text}</span>
        <button onClick={reset} style={{
          marginLeft: 'auto', padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 600,
          cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-dim)',
          border: '1px solid var(--border)',
        }}>Reset</button>
      </div>
      {state.total >= 10 && state.missRate > 0.3 && (
        <div style={{ color: '#f59e0b', fontSize: 9, marginTop: 4 }}>
          ⚠️ Miss rate &gt; 30%. Рекомендуется расширить regex в <code>extractTiming()</code>.
        </div>
      )}
    </div>
  );
};
