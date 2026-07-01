import React, { useMemo, useState } from 'react';
import { getExerciseById } from '../../../core/exercise-catalog';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';

const ACCENT = '#00e68a';
const GROUPS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
const GROUP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор' };
const COLORS: Record<string, string> = { chest: '#00e68a', back: '#60a5fa', legs: '#f59e0b', shoulders: '#a855f7', arms: '#ef4444', core: '#22c55e' };

type Session = { date: string; exercises: { exerciseId: string; totalVolume: number }[] };

const MuscleProgressCardBase: React.FC<{ sessions: Session[]; level: string }> = ({ sessions, level }) => {
  const [group, setGroup] = useState<string>('chest');

  const weekly = useMemo(() => {
    // last 6 ISO weeks (Mon-based) buckets
    const buckets: { label: string; vol: number }[] = [];
    const now = new Date();
    const weekStart = (d: Date) => { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x; };
    const starts: Date[] = [];
    for (let i = 5; i >= 0; i--) { const s = weekStart(now); s.setDate(s.getDate() - i * 7); starts.push(s); }
    starts.forEach((s, i) => { const e = new Date(s); e.setDate(e.getDate() + 6); buckets.push({ label: 'Н' + (i + 1), vol: 0 }); const ss = s.toISOString().slice(0, 10), ee = e.toISOString().slice(0, 10); sessions.forEach(w => { if (w.date >= ss && w.date <= ee) w.exercises.forEach(ex => { const cat = getExerciseById(ex.exerciseId); if (cat && cat.group === group) buckets[i].vol += ex.totalVolume || 0; }); }); });
    return buckets;
  }, [sessions, group]);

  const ref = useMemo(() => { const v = getVolumeByMuscle(group); const k = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced'; const ld = v ? v[k] : undefined; return { mev: ld?.mev ?? 0, mav: ld?.mav ?? 0, mrv: ld?.mrv ?? 0 }; }, [group, level]);

  const maxV = Math.max(ref.mrv * 1000, ...weekly.map(w => w.vol), 1);
  const W = 320, H = 140, P = 30;
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, weekly.length - 1);
  const y = (v: number) => H - P - (v / maxV) * (H - P * 2);
  const linePts = weekly.map((w, i) => `${x(i)},${y(w.vol)}`).join(' ');
  const yline = (val: number) => y(val * 1000);

  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>📈 Прогресс по мышцам</div>
        <select value={group} onChange={e => setGroup(e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
          {GROUPS.map(g => <option key={g} value={g}>{GROUP_RU[g]}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Недельный объём (кг·повт) для «{GROUP_RU[group]}» за 6 нед. Линии: MEV/MAV/MRV (×1000 кг).</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, margin: '0 auto', display: 'block' }}>
        {[ref.mev, ref.mav, ref.mrv].map((v, i) => v > 0 && <line key={i} x1={P} x2={W - P} y1={yline(v)} y2={yline(v)} stroke={['#f59e0b', '#22c55e', '#ef4444'][i]} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />)}
        <polyline points={linePts} fill="none" stroke={COLORS[group]} strokeWidth={2} />
        {weekly.map((w, i) => <circle key={i} cx={x(i)} cy={y(w.vol)} r={2.5} fill={COLORS[group]} />)}
        {weekly.map((w, i) => <text key={i} x={x(i)} y={H - 6} fontSize={7} fill="rgba(255,255,255,0.4)" textAnchor="middle">{w.label}</text>)}
      </svg>
      <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 4, flexWrap: 'wrap' }}>
        <span>🟡 MEV {ref.mev}</span><span>🟢 MAV {ref.mav}</span><span>🔴 MRV {ref.mrv}</span>
        <span>· текущий нед: <b style={{ color: COLORS[group] }}>{Math.round((weekly[weekly.length - 1]?.vol || 0) / 1000)}т</b></span>
      </div>
    </div>
  );
};

export const MuscleProgressCard = React.memo(MuscleProgressCardBase);
export default MuscleProgressCard;