import React, { useMemo } from 'react';
import { calcQualityScore } from './TrainingConstructor/PlanDisplay';
import { GROUP_RU } from './TrainingConstructor/types';

const ACCENT = '#00e68a';
const ru = (g: string) => GROUP_RU[g] || g;

type PlanEx = { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number };
type PlanDay = { day: number; groups: string[]; exercises: PlanEx[] };
type Plan = { splitName: string; corrections: string[]; days: PlanDay[] } | null;

export const CalcQualityTab: React.FC<{ plan: Plan; level: string; goal?: string; onBuildPlan: () => void }> = ({ plan, level, goal = 'hypertrophy', onBuildPlan }) => {
  const analysis = useMemo(() => {
    if (!plan) return null;
    const ws: Record<string, number> = {};
    plan.days.forEach(d => d.exercises.forEach(e => { ws[e.group] = (ws[e.group] || 0) + e.sets; }));
    return calcQualityScore(plan.days, ws, level, goal);
  }, [plan, level, goal]);

  if (!plan || !analysis) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программы</div>
        <div style={{ padding: 20, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>Нет активного плана для оценки. Постройте план во вкладке «План» — и здесь появится полный разбор: объём по группам (MEV/MAV/MRV), оценка качества, предупреждения о перетренированности.</div>
          <button onClick={onBuildPlan} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,230,138,0.3)', background: 'rgba(0,230,138,0.08)', color: ACCENT, cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>📋 Перейти к построению плана</button>
        </div>
      </div>
    );
  }

  const sc = analysis.score >= 80 ? '#22c55e' : analysis.score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программы</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Оценка текущего плана «{plan.splitName}» по объёмным ориентирам (MEV/MAV/MRV), балансу и плотности.</div>

      <div style={{ padding: 12, borderRadius: 12, background: analysis.color + '08', border: '1px solid ' + analysis.color + '40', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: analysis.color }}>Оценка качества</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: analysis.color }}>{analysis.score}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>/100</span></span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: analysis.score + '%', background: analysis.color }} />
        </div>
        {analysis.breakdown.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10, color: b.ok ? 'rgba(255,255,255,0.7)' : analysis.color }}>
            <span style={{ fontSize: 11 }}>{b.ok ? '✅' : '❌'}</span>
            <span style={{ fontWeight: 700, minWidth: 80 }}>{b.label}</span>
            <span style={{ opacity: 0.8 }}>{b.detail}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Объём по группам (Мышца · Сеты · MEV · MAV · MRV · %)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {analysis.perMuscle.map(pm => {
          const st = pm.status === 'недотрен' ? '#ef4444' : pm.status === 'перегруз' ? '#f59e0b' : '#22c55e';
          return (
            <div key={pm.muscle} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, background: st + '10', border: '1px solid ' + st + '30', fontSize: 11 }}>
              <span style={{ fontWeight: 700, color: '#fff' }}>{ru(pm.muscle)}</span>
              <span style={{ color: st, fontWeight: 700 }}>{pm.sets}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>· MEV {pm.mev} · MAV {pm.mav} · MRV {pm.mrv} · {pm.pct}%</span>
            </div>
          );
        })}
      </div>

      {analysis.recommendations.length > 0 && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>💡 Рекомендации</div>
          {analysis.recommendations.map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 3, paddingLeft: 4, borderLeft: '2px solid #f59e0b' }}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalcQualityTab;