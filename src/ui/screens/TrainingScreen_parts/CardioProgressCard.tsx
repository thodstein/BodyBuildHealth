/**
 * CardioProgressCard.tsx — «📍 Прогресс цикла»: текущая неделя по дате,
 * % прохождения, недель до конца, adherence прошедших недель из дневника,
 * ближайший старт (taper/пик).
 */
import React, { useMemo } from 'react';
import {
  cardioWeekForDate, CARDIO_PHASE_LABELS, type CardioCycle,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog, cardioWeekAdherence } from '../../../engines/lms/cardio-diary.engine';

const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioProgressCard: React.FC<{ cycle: CardioCycle | null }> = ({ cycle }) => {
  const data = useMemo(() => {
    if (!cycle) return null;
    const week = cardioWeekForDate(cycle, todayIso());
    const current = week?.week ?? 0;
    const pct = cycle.totalWeeks > 0 ? Math.round((Math.min(current, cycle.totalWeeks) / cycle.totalWeeks) * 100) : 0;
    const log = loadCardioLog();
    const done = cycle.weeks.filter(w => w.week < current).map(w => cardioWeekAdherence(cycle, w.week, log));
    const planned = done.reduce((s, a) => s + a.plannedSessions, 0);
    const actual = done.reduce((s, a) => s + a.doneSessions, 0);
    const adherence = planned > 0 ? Math.round((actual / planned) * 100) : null;
    const nextStart = cycle.weeks.find(w => w.week >= current && (w.phase === 'taper' || w.phase === 'peak'));
    return {
      current,
      pct,
      adherence,
      left: Math.max(0, cycle.totalWeeks - current),
      currentPhase: week?.phase ?? null,
      nextStart,
      totalWeeks: cycle.totalWeeks,
    };
  }, [cycle]);

  if (!cycle || !data) return null;

  return (
    <div style={CARD}>
      <div style={LABEL}>📍 Прогресс цикла</div>
      <div style={ROW}>
        <span style={{ fontSize: 12 }}>Неделя {data.current || '—'} из {data.totalWeeks}</span>
        {data.currentPhase && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>· {CARDIO_PHASE_LABELS[data.currentPhase]}</span>}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>· осталось {data.left} нед</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: data.pct + '%', height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #22c55e, #00e68a)' }} />
      </div>
      <div style={ROW}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{data.pct}% пройдено</span>
        {data.adherence != null && (
          <span style={{ fontSize: 10, color: data.adherence >= 80 ? '#4ade80' : data.adherence >= 50 ? '#fbbf24' : '#f87171' }}>
            · выполнение прошлых недель: {data.adherence}%
          </span>
        )}
      </div>
      {data.nextStart && (
        <div style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '5px 8px' }}>
          🏁 Ближайший старт: нед {data.nextStart.week} ({CARDIO_PHASE_LABELS[data.nextStart.phase]}) — через {data.nextStart.week - data.current} нед
        </div>
      )}
    </div>
  );
};
