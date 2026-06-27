import React, { useMemo, useState } from 'react';
import { analyzeLabs } from '../../engines/score-labs';
import type { ModuleResult } from '../../engines/score-engine';

interface LabsScoreCardProps {
  markers: Array<{ id: string; value: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
}

const G: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 12,
  padding: 10,
};
const LEVEL_META: Record<string, { icon: string; color: string }> = {
  low: { icon: '🟢', color: '#22c55e' },
  moderate: { icon: '🟡', color: '#fbbf24' },
  high: { icon: '🔴', color: '#ef4444' },
};

export const LabsScoreCard: React.FC<LabsScoreCardProps> = ({ markers, weight, age, sex }) => {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo<ModuleResult>(() => analyzeLabs({ markers, weight, age, sex }), [markers, weight, age, sex]);
  if (!markers || markers.length === 0) return null;

  const active = result.systems.filter(s => s.weightedScore > 0);
  const display = expanded ? active : active.slice(0, 4);

  return (
    <div style={{ ...G, marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        🧪 Анализы Score Engine
        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
          background: result.overallRaw >= 60 ? 'rgba(239,68,68,0.15)' : result.overallRaw >= 30 ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
          color: result.overallRaw >= 60 ? '#ef4444' : result.overallRaw >= 30 ? '#fbbf24' : '#22c55e',
        }}>Risk {result.overallRaw}%</span>
        <span style={{ fontSize: 8, color: 'var(--text-dim)', marginLeft: 'auto' }}>{markers.length} маркеров</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {display.map(sys => {
          const meta = LEVEL_META[sys.level];
          return (
            <div key={sys.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 8 }}>{sys.icon}</span>
              <span style={{ fontSize: 7, color: 'var(--text)', flex: 1 }}>{sys.label}</span>
              <span style={{ fontSize: 8, fontWeight: 700, color: meta.color }}>{sys.weightedScore}%</span>
              <div style={{ width: 30, height: 3, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(sys.weightedScore, 100)}%`, background: meta.color, borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
      {active.length > 4 && (
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 8, cursor: 'pointer', padding: '4px 0', fontWeight: 600 }}>
          {expanded ? '▲ Свернуть' : `▼ Ещё ${active.length - 4} систем`}
        </button>
      )}
      {result.recommendations.length > 0 && (
        <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 3 }}>{result.recommendations[0]}</div>
      )}
    </div>
  );
};

export default LabsScoreCard;
