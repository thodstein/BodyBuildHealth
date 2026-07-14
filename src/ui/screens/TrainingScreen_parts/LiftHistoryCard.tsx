import React, { useMemo, useState } from 'react';

const ACCENT = '#00e68a';
const SMALL: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 1.4 };

type Session = { date: string; exercises: { exerciseId: string; exerciseName: string; sets: { weight: number; reps: number }[]; totalVolume: number; estimated1RM: number }[] };

export const LiftHistoryCard: React.FC<{ sessions: Session[] }> = ({ sessions }) => {
  const exOptions = useMemo(() => {
    const m = new Map<string, string>();
    sessions.forEach(w => w.exercises.forEach(e => { if (!m.has(e.exerciseId)) m.set(e.exerciseId, e.exerciseName || e.exerciseId); }));
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [sessions]);

  const [exId, setExId] = useState<string>('');
  const sel = exId || exOptions[0]?.id || '';

  const series = useMemo(() => {
    if (!sel) return [];
    const pts: { date: string; e1rm: number; tonnage: number }[] = [];
    sessions.forEach(w => {
      const e = w.exercises.find(x => x.exerciseId === sel);
      if (!e) return;
      const e1rm = e.sets && e.sets.length > 0 ? Math.max(...e.sets.map(s => Math.round(s.weight * (1 + s.reps / 30)))) : (e.estimated1RM || 0);
      pts.push({ date: w.date, e1rm, tonnage: e.totalVolume || e.sets.reduce((s: number, x: any) => s + x.weight * x.reps, 0) });
    });
    pts.sort((a, b) => a.date.localeCompare(b.date));
    return pts;
  }, [sessions, sel]);

  const maxE1 = Math.max(1, ...series.map(p => p.e1rm));
  const maxT = Math.max(1, ...series.map(p => p.tonnage));
  const W = 340, H = 150, P = 32;
  const x = (i: number) => series.length > 1 ? P + (i * (W - P * 2)) / (series.length - 1) : W / 2;
  const yE = (v: number) => H - P - (v / maxE1) * (H - P * 2);
  const yT = (v: number) => H - P - (v / maxT) * (H - P * 2);
  const e1Pts = series.map((p, i) => `${x(i)},${yE(p.e1rm)}`).join(' ');
  const tPts = series.map((p, i) => `${x(i)},${yT(p.tonnage)}`).join(' ');
  const prDates = new Set<string>(); let runMax = 0; series.forEach(p => { if (p.e1rm > runMax) { runMax = p.e1rm; prDates.add(p.date); } });
  const last = series[series.length - 1];

  if (exOptions.length === 0) return null;

  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>📈 История по упражнению</div>
        <select value={sel} onChange={e => setExId(e.target.value)} style={{ background: '#18181b', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '4px 8px', fontSize: 11, maxWidth: 200 }}>
          {exOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {series.length === 0 ? (
        <div style={{ ...SMALL, textAlign: 'center', padding: 16 }}>Нет данных по выбранному упражнению.</div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6 }}>e1RM (Epley, зелёный) и тоннаж (синий) по датам сессий. 🏆 — новый PR.</div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: W, margin: '0 auto', display: 'block' }}>
            <polyline points={tPts} fill="none" stroke="#60a5fa" strokeWidth={1.5} opacity={0.6} />
            <polyline points={e1Pts} fill="none" stroke={ACCENT} strokeWidth={2} />
            {series.map((p, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={yE(p.e1rm)} r={prDates.has(p.date) ? 3.5 : 2.5} fill={prDates.has(p.date) ? '#f59e0b' : ACCENT} />
                {prDates.has(p.date) && <text x={x(i)} y={yE(p.e1rm) - 6} fontSize={7} fill="#f59e0b" textAnchor="middle">🏆</text>}
              </g>
            ))}
            {series.map((p, i) => <text key={i} x={x(i)} y={H - 6} fontSize={6} fill="rgba(255,255,255,0.4)" textAnchor="middle">{p.date.slice(5)}</text>)}
          </svg>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4, flexWrap: 'wrap' }}>
            <span>🟢 e1RM</span><span>🔵 тоннаж</span><span>🏆 PR</span>
            {last && <span>· последний: e1RM <b style={{ color: ACCENT }}>{last.e1rm}</b> кг, тоннаж <b style={{ color: '#60a5fa' }}>{Math.round(last.tonnage)}</b></span>}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(LiftHistoryCard);