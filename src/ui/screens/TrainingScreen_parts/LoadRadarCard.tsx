import React, { useMemo } from 'react';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import { getVolumeByMuscle } from '../../../engines/training-methodology.engine';
import type { WorkoutLog } from '../../../core/types';

const ACCENT = '#00e68a';
const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы' };

export const LoadRadarCard: React.FC<{ sessions: WorkoutLog[]; level: string }> = ({ sessions, level }) => {
  const data = useMemo(() => {
    const wsg = weeklySetsByGroup(sessions, 1);
    const lvlKey = (level === 'enhanced' ? 'advanced' : level) as 'beginner' | 'intermediate' | 'advanced';
    const groups = Object.keys(wsg).filter(g => (wsg[g][0] || 0) > 0).sort((a, b) => (wsg[b][0] || 0) - (wsg[a][0] || 0));
    if (groups.length < 3) return null;
    const rows = groups.map(g => {
      const v = getVolumeByMuscle(g);
      const ld = v ? v[lvlKey] : undefined;
      const sets = wsg[g][0] || 0;
      const mrv = ld?.mrv ?? 20;
      return { g, sets, mev: ld?.mev ?? 0, mav: ld?.mav ?? 0, mrv, ratio: sets / mrv };
    });
    return rows;
  }, [sessions, level]);

  if (!data) return null;
  const N = data.length;
  const cx = 130, cy = 120, R = 80;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i: number, r: number) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  const poly = data.map((d, i) => pt(i, Math.min(1.25, d.ratio) * R).join(',')).join(' ');
  const maxRatio = Math.max(1, ...data.map(d => d.ratio));

  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 2 }}>🕸️ Радар распределения нагрузки (неделя)</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>Каждая ось — мышечная группа, радиус = объём относительно MRV (1.0 = MRV). Кольца: MEV/MAV/MRV. Идеал — равносторонний многоугольник в зоне MAV.</div>
      <svg width="100%" viewBox="0 0 260 240" style={{ maxWidth: 260, margin: '0 auto', display: 'block' }}>
        {[0.5, 1].map(ring => (
          <polygon key={ring} points={data.map((_, i) => pt(i, ring * R).join(',')).join(' ')} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ))}
        {data.map((d, i) => {
          const [x1, y1] = pt(i, 0); const [x2, y2] = pt(i, R);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
        })}
        <polygon points={poly} fill="rgba(0,230,138,0.18)" stroke={ACCENT} strokeWidth={2} />
        {data.map((d, i) => {
          const [px, py] = pt(i, Math.min(1.25, d.ratio) * R);
          return <circle key={i} cx={px} cy={py} r={2.5} fill={d.ratio > 1 ? '#ef4444' : d.ratio >= 0.6 ? ACCENT : '#f59e0b'} />;
        })}
        {data.map((d, i) => {
          const [lx, ly] = pt(i, R + 14);
          return <text key={i} x={lx} y={ly} fontSize={8} fill="rgba(255,255,255,0.6)" textAnchor="middle" dominantBaseline="middle">{GRP_RU[d.g] || d.g}</text>;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 10, fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span>🟢 в зоне MAV</span><span>🟡 &lt; MEV (недотрен)</span><span>🔴 &gt; MRV (перетрен)</span>
        <span>· макс. отношение: <b style={{ color: maxRatio > 1 ? '#ef4444' : ACCENT }}>{maxRatio.toFixed(2)}× MRV</b></span>
      </div>
    </div>
  );
};

export default React.memo(LoadRadarCard);