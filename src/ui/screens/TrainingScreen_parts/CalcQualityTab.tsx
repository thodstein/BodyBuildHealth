import React, { useMemo } from 'react';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };
const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };
const ru = (g: string) => GRP_RU[g] || g;

type PlanEx = { name: string; sets: number; reps: string; rir: number; rest: number; group: string; weight: number };
type PlanDay = { day: number; groups: string[]; exercises: PlanEx[] };
type Plan = { splitName: string; corrections: string[]; days: PlanDay[] } | null;

export const CalcQualityTab: React.FC<{ plan: Plan; level: string; onBuildPlan: () => void }> = ({ plan, level, onBuildPlan }) => {
  const analysis = useMemo(() => {
    if (!plan) return null;
    const wk: Record<string, number> = {};
    plan.days.forEach(d => d.exercises.forEach(e => { wk[e.group] = (wk[e.group] || 0) + e.sets; }));
    const mrv = ((LEVEL_VOLUMES as Record<string, { mrv: number }>)[level]?.mrv ?? 20);
    const groups = Object.keys(wk);
    let score = 100;
    const rows = groups.map(g => {
      const v = getVolumeByMuscle(g);
      const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
      const ld = v ? v[lvlKey] : undefined;
      const sets = wk[g];
      const mev = ld?.mev ?? 0;
      const mav = ld?.mav ?? 0;
      const gmrv = ld?.mrv ?? Math.round(mrv);
      const color = sets === 0 ? '#ef4444' : sets < mev ? '#f59e0b' : sets <= mav ? '#22c55e' : sets <= gmrv ? '#eab308' : '#ef4444';
      const label = sets === 0 ? 'нет объёма' : sets < mev ? 'ниже MEV' : sets <= mav ? 'зона MAV' : sets <= gmrv ? 'выше MAV' : '>MRV!';
      if (sets > gmrv) score -= 12;
      if (sets > 0 && sets < Math.max(4, mrv * 0.4)) score -= 4;
      return { g, sets, mev, mav, gmrv, color, label };
    });
    score = Math.max(0, Math.min(100, score));
    const total = Object.values(wk).reduce((a, b) => a + b, 0);
    const over = rows.filter(r => r.sets > r.gmrv);
    const low = rows.filter(r => r.sets > 0 && r.sets < r.mev);
    return { rows, score, total, mrv: Math.round(mrv), over, low };
  }, [plan, level]);

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

  const sc = analysis.score >= 85 ? '#22c55e' : analysis.score >= 65 ? '#eab308' : '#ef4444';
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, margin: '4px 0 8px' }}>🎯 Калькулятор качества программы</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Оценка текущего плана «{plan.splitName}» по объёмным ориентирам (MEV/MAV/MRV) и балансу.</div>

      <div style={{ padding: 12, borderRadius: 12, background: 'rgba(0,230,138,0.05)', border: '1px solid ' + sc + '33', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: sc }}>Оценка качества</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: sc }}>{analysis.score}/100</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ height: '100%', width: analysis.score + '%', background: sc }} />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          Всего сетов/нед: <b>{analysis.total}</b>. MRV (по уровню «{level}»): <b>{analysis.mrv}</b> сетов/группу.
          {analysis.over.length > 0 && <div style={{ color: '#ef4444', marginTop: 4 }}>⚠ Превышение MRV: {analysis.over.map(r => ru(r.g) + ' (' + r.sets + ')').join(', ')}.</div>}
          {analysis.low.length > 0 && <div style={{ color: '#f59e0b', marginTop: 4 }}>⚠ Ниже MEV: {analysis.low.map(r => ru(r.g) + ' (' + r.sets + ')').join(', ')} — недотрен.</div>}
          {analysis.over.length === 0 && analysis.low.length === 0 && <div style={{ color: '#22c55e', marginTop: 4 }}>✅ Объём по всем группам в пределах нормы.</div>}
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>Объём по группам (MEV / MAV / MRV)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {analysis.rows.map(r => (
          <div key={r.g} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.4fr 0.8fr 0.7fr 0.9fr', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.85)', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', minWidth: 380 }}>
            <span style={{ fontWeight: 700 }}>{ru(r.g)}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{r.sets}</span>
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, whiteSpace: 'nowrap' }}>{r.mev}/{r.mav}/{r.gmrv}</span>
            <span style={{ color: r.color, fontWeight: 700, fontSize: 10 }}>{r.label}</span>
            <span style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: Math.min(100, Math.round((r.sets / Math.max(r.gmrv, 1)) * 100)) + '%', borderRadius: 3, background: r.color }} />
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>💡 Рекомендации</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
          {analysis.over.length > 0 && <div>• Снизьте объём групп с превышением MRV ({analysis.over.map(r => ru(r.g)).join(', ')}) — уберите 1–2 подхода или упражнение.</div>}
          {analysis.low.length > 0 && <div>• Повысьте объём групп ниже MEV ({analysis.low.map(r => ru(r.g)).join(', ')}) — добавьте подход или упражнение.</div>}
          {analysis.over.length === 0 && analysis.low.length === 0 && <div>• План сбалансирован. Примените «Улучшить программу» во вкладке «План» для тонкой проверки.</div>}
        </div>
      </div>
    </div>
  );
};

export default CalcQualityTab;