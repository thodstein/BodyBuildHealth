import React, { useMemo } from 'react';
import { estimateIndividualMRV, VolumeReadinessPoint } from '../../../engines/work-capacity-engine';

const CARD: React.CSSProperties = { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', padding: 12, margin: '6px 0' };
const ACCENT = '#00e68a';
const H: React.CSSProperties = { color: '#fff', fontSize: 14, fontWeight: 600, margin: '4px 0 6px' };
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.45 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12, color: 'rgba(255,255,255,0.8)' };

export const MRVEstimator: React.FC = () => {
  // In a real app, this would come from a hook that aggregates workout_log and he_readiness_history
  const mockData: VolumeReadinessPoint[] = [
    { date: '2026-06-01', weeklyVolume: 12, readinessScore: 85 },
    { date: '2026-06-08', weeklyVolume: 15, readinessScore: 82 },
    { date: '2026-06-15', weeklyVolume: 18, readinessScore: 78 },
    { date: '2026-06-22', weeklyVolume: 22, readinessScore: 60 }, // Drop!
    { date: '2026-06-29', weeklyVolume: 20, readinessScore: 72 },
  ];

  const result = useMemo(() => estimateIndividualMRV(mockData), []);

  return (
    <div>
      <div style={CARD}>
        <div style={H}>📉 Оценка индивидуального MRV</div>
        <div style={ROW}><span>Оценочный MRV:</span><span style={{ color: ACCENT, fontWeight: 700 }}>{result.estimatedMRV} сетов/нед</span></div>
        <div style={ROW}><span>Доверие:</span><span>{result.confidence === 'high' ? 'Высокое' : result.confidence === 'medium' ? 'Среднее' : 'Низкое'}</span></div>
        <div style={ROW}><span>Тренд:</span><span>{result.trend === 'improving' ? '📈 Улучшение' : result.trend === 'declining' ? '📉 Снижение' : '➡️ Стабильно'}</span></div>
        <div style={{ ...SMALL, marginTop: 6 }}>
          {result.analysis}
        </div>
      </div>

      <div style={CARD}>
        <div style={H}>⚠️ Критическая точка</div>
        {result.criticalVolume ? (
          <div style={ROW}>
            <span>Объём срыва:</span>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{result.criticalVolume.toFixed(1)} сетов</span>
          </div>
        ) : (
          <div style={SMALL}>Данные о срыве не найдены. Текущий объём переносится хорошо.</div>
        )}
        <div style={{ ...SMALL, marginTop: 6 }}>
          MRV — это максимальный восстановительный объём. Превышение этой точки ведет к накоплению усталости и падению готовности.
        </div>
      </div>
    </div>
  );
};

export default MRVEstimator;
