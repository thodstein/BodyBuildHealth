/**
 * VolumeBudgetCard.tsx — видимый бюджет объёма по мышцам (MEV/MAV/MRV).
 *
 * Профессиональный тренер всегда держит в голове: по каждой мышце —
 * минимальный эффективный объём (MEV), оптимальный адаптивный (MAV),
 * максимальный восстанавливаемый (MRV). И текущий план. Эта карта делает
 * «чёрный ящик» объёма прозрачным: видно, сколько сетов на мышцу, в какой
 * зоне (недотрен / оптимум / около MRV / перегруз), частота и тяж/памп-сплит,
 * и конкретная рекомендация (±N сетов до MAV/MRV).
 *
 * Источник: BBPlanMetrics.perMuscle (calcBBPlanMetrics, единственный канон).
 */
import React from 'react';
import type { BBPlanMetrics, BBMuscleVolume } from '../../../engines/bb/bb-metrics.engine';
import { GROUP_RU } from './program-types';
import { CARD } from './training-ui';

const STATUS_META: Record<BBMuscleVolume['status'], { label: string; color: string }> = {
  below_mev: { label: 'недотрен', color: '#60a5fa' },
  optimal: { label: 'оптимум', color: '#22c55e' },
  approaching_mrv: { label: 'около MRV', color: '#f59e0b' },
  exceeding_mrv: { label: 'перегруз', color: '#ef4444' },
};

function recommendation(m: BBMuscleVolume): string {
  if (m.totalSets < m.mev) return `+${m.mev - m.totalSets} сетов до MEV (минимум)`;
  if (m.totalSets >= m.mrv) return `−${m.totalSets - m.mrv} сетов (выше MRV — риск невосстановления)`;
  if (m.totalSets > m.mav) return `в зоне MAV–MRV, держать или −${m.totalSets - m.mav} до MAV`;
  if (m.totalSets < m.mav) return `+${m.mav - m.totalSets} сетов до MAV (оптимум)`;
  return 'оптимум';
}

function ru(muscle: string): string { return GROUP_RU[muscle] || muscle; }

export const VolumeBudgetCard: React.FC<{ metrics: BBPlanMetrics | null; mrvMultiplier?: number }> = ({ metrics, mrvMultiplier = 1 }) => {
  if (!metrics || metrics.perMuscle.length === 0) return null;
  // Сортировка: перегруз → около MRV → недотрен → оптимум (проблемные сверху).
  const order: Record<BBMuscleVolume['status'], number> = { exceeding_mrv: 0, approaching_mrv: 1, below_mev: 2, optimal: 3 };
  const rows = [...metrics.perMuscle].sort((a, b) => order[a.status] - order[b.status] || (b.totalSets - a.totalSets));

  return (
    <div style={{ ...CARD, padding: 10, marginBottom: 8, background: 'rgba(0,230,138,0.04)', borderLeft: '3px solid #00e68a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a' }}>📊 Бюджет объёма по мышцам · пик</span>
        {mrvMultiplier > 1 && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4 }}>MRV ×{mrvMultiplier.toFixed(2)}</span>}
        <span style={{ fontSize: 10, color: '#fff' }}>всего {metrics.totalSets} сетов/нед · пик-неделя</span>
      </div>

      {/* Легенда */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: '#fff' }}>
        <span><span style={{ color: '#22c55e' }}>●</span> MEV (минимум)</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> MAV (оптимум)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> MRV (максимум)</span>
      </div>

      {rows.map(m => {
        const st = STATUS_META[m.status];
        const barMax = Math.max(m.mrv, m.totalSets, 1);
        const pct = (v: number) => (v / barMax * 100);
        const тяжPct = m.totalSets > 0 ? Math.round((m.тяжSets / m.totalSets) * 100) : 0;
        return (
          <div key={m.muscle} style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{ru(m.muscle)}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: st.color }}>{m.totalSets} сетов · {st.label}</span>
            </div>
            {/* Бар с тремя порогами */}
            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 3 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(m.totalSets) + '%', background: st.color, borderRadius: 5, opacity: 0.85 }} />
              {/* MEV marker */}
              <div title={`MEV ${m.mev}`} style={{ position: 'absolute', left: pct(m.mev) + '%', top: -2, bottom: -2, width: 2, background: '#22c55e' }} />
              {/* MAV marker */}
              <div title={`MAV ${m.mav}`} style={{ position: 'absolute', left: pct(m.mav) + '%', top: -2, bottom: -2, width: 2, background: '#f59e0b' }} />
              {/* MRV marker */}
              <div title={`MRV ${m.mrv}`} style={{ position: 'absolute', left: pct(m.mrv) + '%', top: -2, bottom: -2, width: 2, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#fff', marginBottom: 3 }}>
              <span>MEV {m.mev} · MAV {m.mav} · MRV {m.mrv}</span>
              <span>частота {m.frequencyPerRotation}×/рот · тяж {тяжPct}% · RIR {m.avgRir.toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{recommendation(m)}</div>
          </div>
        );
      })}
    </div>
  );
};