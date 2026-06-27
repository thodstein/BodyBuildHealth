import React, { useMemo, useState } from 'react';
import { runScoreAnalysis, getSuggestedPlan, type ScoreReport } from '../../engines/score-engine';

interface SupportScoreCardProps {
  course: Array<{ substanceId: string; dose: number; unit: string; weeks: number }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
  nutritionQuality?: number;
  trainingLoad?: number;
  pharmaHepatic?: number;
  pharmaCardio?: number;
  pharmaRenal?: number;
  pharmaNeuro?: number;
  labsHepatic?: number;
  labsCardio?: number;
  labsRenal?: number;
  labsNeuro?: number;
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

export const SupportScoreCard: React.FC<SupportScoreCardProps> = ({ course, weight, age, sex, nutritionQuality, trainingLoad, pharmaHepatic, pharmaCardio, pharmaRenal, pharmaNeuro, labsHepatic, labsCardio, labsRenal, labsNeuro }) => {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo<ScoreReport>(() => runScoreAnalysis({ course, weight, age, sex, nutritionQuality, trainingLoad, pharmaHepatic, pharmaCardio, pharmaRenal, pharmaNeuro, labsHepatic, labsCardio, labsRenal, labsNeuro }), [course, weight, age, sex, nutritionQuality, trainingLoad, pharmaHepatic, pharmaCardio, pharmaRenal, pharmaNeuro, labsHepatic, labsCardio, labsRenal, labsNeuro]);
  if (!course || course.length === 0) return null;

  const plan = useMemo(() => getSuggestedPlan(result), [result]);
  const display = expanded ? result.systems : result.systems.filter(s => s.weightedScore >= 10).slice(0, 4);

  return (
    <div style={{ ...G, marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        💊 Анализ поддержки
        <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8,
          background: result.overallRaw >= 60 ? 'rgba(239,68,68,0.15)' : result.overallRaw >= 30 ? 'rgba(251,191,36,0.15)' : 'rgba(34,197,94,0.15)',
          color: result.overallRaw >= 60 ? '#ef4444' : result.overallRaw >= 30 ? '#fbbf24' : '#22c55e',
        }}>Risk {result.overallRaw}% → {result.overallAfterSupport}%</span>
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
      {result.systems.filter(s => s.weightedScore >= 10).length > 4 && (
        <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 8, cursor: 'pointer', padding: '2px 0', fontWeight: 600 }}>
          {expanded ? '▲ Свернуть' : `▼ Ещё ${result.systems.filter(s => s.weightedScore >= 10).length - 4} систем`}
        </button>
      )}

      {/* Plan */}
      {plan.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>💊 План ({plan.length})</div>
          {plan.slice(0, expanded ? 99 : 3).map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
              <span style={{ fontSize: 8, color: 'var(--text)', flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: 7, color: 'var(--accent)' }}>{p.dose}</span>
              <span style={{ fontSize: 7, color: '#818cf8' }}>{p.timing}</span>
            </div>
          ))}
          {plan.length > 3 && !expanded && (
            <span style={{ fontSize: 7, color: 'var(--text-dim)' }}>+{plan.length - 3} ещё</span>
          )}
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div style={{ fontSize: 7, color: '#fbbf24', marginTop: 3 }}>{result.recommendations[0]}</div>
      )}
    </div>
  );
};

export default SupportScoreCard;
