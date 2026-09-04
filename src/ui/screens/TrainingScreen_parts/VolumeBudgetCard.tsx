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
  // Используем effectiveSets (прямой + косвенный) — иначе передняя дельта
  // с косвенной от жимов показывала 0, хотя фактически получает 2-4 effective.
  const eff = m.effectiveSets;
  if (eff < m.mev) return `Недотрен: +${(m.mev - eff).toFixed(1)} effective до MEV ${m.mev} — иначе нет стимула`;
  if (eff >= m.mrv) return `Перегруз: −${(eff - m.mrv).toFixed(1)} effective — выше MRV ${m.mrv}, риск недовосстановления`;
  if (eff > m.mav) return `Выше оптимума: в зоне MAV–MRV (${m.mav}–${m.mrv}), можно держать или −${(eff - m.mav).toFixed(1)} до MAV`;
  if (eff < m.mav) return `Ниже оптимума: +${(m.mav - eff).toFixed(1)} effective до MAV ${m.mav}`;
  return 'Оптимум — объём в точке MAV';
}

function ru(muscle: string): string { return GROUP_RU[muscle] || muscle; }

export const VolumeBudgetCard: React.FC<{ metrics: BBPlanMetrics | null; mrvMultiplier?: number }> = ({ metrics, mrvMultiplier = 1 }) => {
  if (!metrics || metrics.perMuscle.length === 0) return null;
  // Сортировка: перегруз → около MRV → недотрен → оптимум (проблемные сверху).
  const order: Record<BBMuscleVolume['status'], number> = { exceeding_mrv: 0, approaching_mrv: 1, below_mev: 2, optimal: 3 };
  const rows = [...metrics.perMuscle].sort((a, b) => order[a.status] - order[b.status] || (b.totalSets - a.totalSets));

  return (
    <div className="train-volbudget" style={{ ...CARD, padding: 10, marginBottom: 8, background: 'rgba(0,230,138,0.04)', borderLeft: '3px solid #00e68a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap:'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#00e68a' }}>📊 Бюджет объёма по мышцам — пиковая неделя (адаптировано)</span>
        {mrvMultiplier > 1 && <span title="Максимальный восстанавливаемый объём увеличен с учётом фармакологии, стажа и уровня" style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 6px', borderRadius: 4, border:'1px solid rgba(245,158,11,0.2)' }}>MRV ×{mrvMultiplier.toFixed(2)} — адаптировано</span>}
        <span style={{ fontSize: 10, color: '#fff', background:'rgba(255,255,255,0.03)', padding:'2px 6px', borderRadius:4 }}>всего {metrics.totalSets} подходов в неделю · пиковая неделя</span>
      </div>
      <div style={{ fontSize:9, color:'#fff', marginBottom:8, lineHeight:1.35, padding:'5px 7px', background:'rgba(255,255,255,0.02)', borderRadius:6, border:'1px solid rgba(255,255,255,0.05)' }}>
        <b>Как читать:</b> Зелёная зона — минимум для роста (MEV) → оптимум (MAV) → максимум без перетрена (MRV). Столбик — ваш текущий объём. Цвет подписи — статус (недотрен/оптимум/около MRV/перегруз). Значения MEV/MAV/MRV уже адаптированы под ваш уровень, стаж, PED и восстановление.
      </div>

      {/* Легенда */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: '#fff' }}>
        <span><span style={{ color: '#22c55e' }}>●</span> MEV (минимум)</span>
        <span><span style={{ color: '#f59e0b' }}>●</span> MAV (оптимум)</span>
        <span><span style={{ color: '#ef4444' }}>●</span> MRV (максимум)</span>
      </div>

      {rows.map(m => {
        const st = STATUS_META[m.status];
        // Показываем effective (прямой + косвенный) — иначе передняя дельта
        // с жимов получала 0 effective, хотя status уже учитывает indirect.
        const displaySets = m.effectiveSets;
        const barMax = Math.max(m.mrv, displaySets, 1);
        const pct = (v: number) => (v / barMax * 100);
        const тяжPct = m.totalSets > 0 ? Math.round((m.тяжSets / m.totalSets) * 100) : 0;
        const directNote = m.directSets !== displaySets ? ` (прямых ${m.directSets})` : '';
        return (
          <div key={m.muscle} style={{ marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{ru(m.muscle)}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: st.color }}>{displaySets.toFixed(1)} eff{directNote} · {st.label}</span>
            </div>
            {/* Бар с тремя порогами — по effective */}
            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 3 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(displaySets) + '%', background: st.color, borderRadius: 5, opacity: 0.85 }} />
              {/* MEV marker */}
              <div title={`MEV ${m.mev}`} style={{ position: 'absolute', left: pct(m.mev) + '%', top: -2, bottom: -2, width: 2, background: '#22c55e' }} />
              {/* MAV marker */}
              <div title={`MAV ${m.mav}`} style={{ position: 'absolute', left: pct(m.mav) + '%', top: -2, bottom: -2, width: 2, background: '#f59e0b' }} />
              {/* MRV marker */}
              <div title={`MRV ${m.mrv}`} style={{ position: 'absolute', left: pct(m.mrv) + '%', top: -2, bottom: -2, width: 2, background: '#ef4444' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#fff', marginBottom: 3 }}>
              <span>Мин MEV {m.mev} · Опт MAV {m.mav} · Макс MRV {m.mrv}</span>
              <span>частота {m.frequencyPerRotation}×/нед · тяж {тяжPct}% · RIR {m.avgRir.toFixed(1)}</span>
            </div>
            <div style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{recommendation(m)}</div>
          </div>
        );
      })}
    </div>
  );
};