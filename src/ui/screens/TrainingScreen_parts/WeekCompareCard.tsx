import React, { useMemo, useState } from 'react';
import { getExerciseById } from '../../../core/exercise-catalog';
import type { WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';
const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы' };
const ru = (g: string) => GRP_RU[g] || g;
const ws = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
const iso = (d: Date) => d.toISOString().slice(0, 10);

const weekAgg = (sessions: WorkoutLog[], weeksAgo: number) => {
  const now = new Date();
  const s = ws(now); s.setDate(s.getDate() - weeksAgo * 7);
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const ss = iso(s), ee = iso(e);
  const byGroup: Record<string, number> = {}; const byGroupVol: Record<string, number> = {};
  let sets = 0, vol = 0, wcount = 0;
  sessions.forEach(w => { if (w.date < ss || w.date > ee) return; wcount++; (w.exercises || []).forEach(ex => { const cat = getExerciseById(ex.exerciseId); const g = cat?.group || '—'; const n = ex.sets?.length || 0; byGroup[g] = (byGroup[g] || 0) + n; byGroupVol[g] = (byGroupVol[g] || 0) + (ex.totalVolume || 0); sets += n; vol += ex.totalVolume || 0; }); });
  return { label: `Н${weeksAgo === 0 ? 'тек' : '-' + weeksAgo}`, range: `${ss}…${ee}`, wcount, sets, vol, byGroup, byGroupVol };
};

export const WeekCompareCard: React.FC<{ sessions: WorkoutLog[] }> = ({ sessions }) => {
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const A = useMemo(() => weekAgg(sessions, a), [sessions, a]);
  const B = useMemo(() => weekAgg(sessions, b), [sessions, b]);
  const groups = useMemo(() => Array.from(new Set([...Object.keys(A.byGroup), ...Object.keys(B.byGroup)])).sort(), [A, B]);
  if (A.wcount === 0 && B.wcount === 0) return null;

  const opt = (i: number) => <option key={i} value={i}>Неделя -{i} ({i === 0 ? 'текущая' : i + ' нед назад'})</option>;

  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.18)', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#a855f7', marginBottom: 6 }}>⚖️ Сравнение двух недель</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={a} onChange={e => setA(+e.target.value)} style={{ flex: 1, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }}>{[0,1,2,3,4,5,6,7].map(opt)}</select>
        <span style={{ alignSelf: 'center', color: 'var(--text-dim)' }}>vs</span>
        <select value={b} onChange={e => setB(+e.target.value)} style={{ flex: 1, background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 6, fontSize: 11 }}>{[0,1,2,3,4,5,6,7].map(opt)}</select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 4 }}>
        <span>Метрика</span><span style={{ color: ACCENT }}>{A.label}</span><span style={{ color: '#a855f7' }}>{B.label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.85)', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span>Тренировок</span><span style={{ color: ACCENT }}>{A.wcount}</span><span style={{ color: '#a855f7' }}>{B.wcount}</span>
        <span>Сетов</span><span style={{ color: ACCENT }}>{A.sets}</span><span style={{ color: '#a855f7' }}>{B.sets} {A.sets - B.sets !== 0 && <span style={{ fontSize: 8, color: A.sets - B.sets > 0 ? '#ef4444' : '#3b82f6' }}>({A.sets - B.sets > 0 ? '+' : ''}{A.sets - B.sets})</span>}</span>
        <span>Тоннаж</span><span style={{ color: ACCENT }}>{Math.round(A.vol)}</span><span style={{ color: '#a855f7' }}>{Math.round(B.vol)} {A.vol - B.vol !== 0 && <span style={{ fontSize: 8, color: A.vol - B.vol > 0 ? '#ef4444' : '#3b82f6' }}>({A.vol - B.vol > 0 ? '+' : ''}{Math.round(A.vol - B.vol)})</span>}</span>
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 6, marginBottom: 2 }}>По группам (сетов)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.6fr 0.6fr 0.6fr', gap: 4, fontSize: 9, color: 'rgba(255,255,255,0.8)' }}>
        {groups.map(g => { const va = A.byGroup[g] || 0, vb = B.byGroup[g] || 0; const d = va - vb; return (
          <React.Fragment key={g}>
            <span>{ru(g)}</span><span style={{ color: ACCENT, textAlign: 'center' }}>{va}</span><span style={{ color: '#a855f7', textAlign: 'center' }}>{vb}</span>
            <span style={{ textAlign: 'center', color: d > 0 ? '#ef4444' : d < 0 ? '#3b82f6' : 'var(--text-dim)' }}>{d === 0 ? '=' : (d > 0 ? '+' : '') + d}</span>
          </React.Fragment>
        ); })}
      </div>
    </div>
  );
};

export default React.memo(WeekCompareCard);