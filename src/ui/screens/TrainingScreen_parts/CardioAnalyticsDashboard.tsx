/**
 * CardioAnalyticsDashboard.tsx — мини-дашборд аналитики (H3).
 * 7д vs 28д, TRIMP тренд, HR compliance, стрик.
 */
import React, { useMemo } from 'react';
import { CARD, ROW, LABEL, HINT_SM, Badge, StatTile } from './CardioUI';
import { cardioLogStats, cardioHrCompliance } from '../../../engines/lms/cardio-diary.engine';
import type { CardioCycle } from '../../../engines/lms/cardio.engine';
import type { CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';

export const CardioAnalyticsDashboard: React.FC<{ cycle: CardioCycle | null; log: CardioLogEntry[] }> = ({ cycle, log }) => {
  const s7 = useMemo(() => cardioLogStats(log, 7), [log]);
  const s28 = useMemo(() => cardioLogStats(log, 28), [log]);
  const hr = useMemo(() => {
    if (!cycle) return null;
    try { return cardioHrCompliance(cycle, log, { days: 28 }); } catch { return null; }
  }, [cycle, log]);

  const trimp7 = useMemo(() => {
    const factor: Record<string, number> = { zone2: 2, miss: 3, hiit: 5, recovery: 1 };
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 6);
    const iso = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
    const week = log.filter(e => e.completed && e.date >= iso);
    return week.reduce((sum, e) => sum + e.durationMin * (factor[e.type] ?? 2), 0);
  }, [log]);

  const delta = s28.minutes > 0 ? Math.round(((s7.minutes * 4 - s28.minutes) / s28.minutes) * 100) : 0;

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>Аналитика 7д / 28д</span>
        <Badge bg={delta >= 10 ? 'rgba(239,68,68,0.12)' : delta <= -10 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)'} border={delta >= 10 ? 'rgba(239,68,68,0.24)' : delta <= -10 ? 'rgba(34,197,94,0.24)' : 'rgba(255,255,255,0.08)'} color={delta >= 10 ? '#f87171' : delta <= -10 ? '#4ade80' : 'rgba(255,255,255,0.6)'}>{delta > 0 ? '+' + delta + '%' : delta + '%'} к 28д</Badge>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <StatTile label="7Д МИН" value={String(s7.minutes)} color="#22c55e" sub={s7.sessions + ' сесс' + (s7.avgPace ? ' · ' + s7.avgPace : '')} />
        <StatTile label="28Д МИН" value={String(s28.minutes)} color="#3b82f6" sub={s28.sessions + ' сесс'} />
        <StatTile label="TRIMP 7Д" value={String(trimp7)} color="#a78bfa" sub="нагрузка" />
        <StatTile label="HR в зоне" value={hr?.inZonePct != null ? hr.inZonePct + '%' : '—'} color={hr?.inZonePct != null && hr.inZonePct >= 70 ? '#4ade80' : '#fbbf24'} sub={hr?.avgDelta != null ? (hr.avgDelta > 0 ? '+' : '') + hr.avgDelta + ' уд' : ''} />
      </div>
      {hr?.advice && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 8px' }}>{hr.advice}</div>}
      <div style={HINT_SM}>TRIMP — сумма мин×интенсивность. Рост &gt;15% за неделю — риск перегруза.</div>
    </div>
  );
};
