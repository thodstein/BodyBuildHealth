import React, { useMemo } from 'react';
import { weeklySetsByGroup } from '../../../engines/training-recommendations.engine';
import type { WorkoutLog } from '../../../core/types';

const GROUP_COLORS: Record<string, string> = { chest: '#00e68a', back: '#60a5fa', legs: '#f59e0b', shoulders: '#a855f7', arms: '#ef4444', core: '#22c55e', hamstrings: '#3b82f6', glutes: '#ec4899', calves: '#eab308', triceps: '#fb923c', biceps: '#f472b6', quads: '#facc15' };
const GRP_RU: Record<string, string> = { chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи', arms: 'Руки', core: 'Кор', hamstrings: 'Бицепс бедра', glutes: 'Ягодицы', calves: 'Икры', triceps: 'Трицепс', biceps: 'Бицепс', quads: 'Квадрицепсы' };

export const VolumeTrendCard: React.FC<{ sessions: WorkoutLog[]; weeks?: number }> = ({ sessions, weeks = 8 }) => {
  const wsg = useMemo(() => weeklySetsByGroup(sessions, weeks), [sessions, weeks]);
  const groups = useMemo(() => Object.keys(wsg).sort((a, b) => (wsg[b].reduce((s: number, x: number) => s + x, 0)) - (wsg[a].reduce((s: number, x: number) => s + x, 0))), [wsg]);
  const totals = useMemo(() => Array.from({ length: weeks }, (_, i) => groups.reduce((s, g) => s + (wsg[g]?.[i] || 0), 0)), [wsg, groups, weeks]);
  const maxTotal = Math.max(1, ...totals);
  const hasData = totals.some(t => t > 0);

  if (!hasData) return null;
  const barW = 100 / weeks;

  return (
    <div style={{ padding: 12, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#00e68a', marginBottom: 2 }}>📊 Объём по неделям (сеты по группам)</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Стек-бары по неделям — видно рост/снижение объёма и распределение по группам тела.</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, marginBottom: 6 }}>
        {totals.map((t, wi) => (
          <div key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', height: '100%', borderRadius: 4, overflow: 'hidden', background: t > 0 ? 'transparent' : 'rgba(255,255,255,0.03)' }} title={`Нед ${wi + 1}: ${t} сетов`}>
            {groups.map(g => {
              const v = wsg[g]?.[wi] || 0;
              if (v === 0) return null;
              const h = (v / maxTotal) * 100;
              return <div key={g} style={{ height: h + '%', background: GROUP_COLORS[g] || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(0,0,0,0.6)', fontWeight: 700 }}>{v > 4 ? v : ''}</div>;
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>
        {totals.map((_, wi) => <span key={wi} style={{ flex: 1, textAlign: 'center' }}>Н{wi + 1}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color:'rgba(255,255,255,0.9)' }}>
        {groups.filter(g => (wsg[g]?.reduce((s: number, x: number) => s + x, 0) || 0) > 0).map(g => (
          <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLORS[g] || '#888', display: 'inline-block' }} />{GRP_RU[g] || g}</span>
        ))}
      </div>
    </div>
  );
};

export default React.memo(VolumeTrendCard);