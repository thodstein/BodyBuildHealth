/**
 * CardioProgressCard.tsx — «📍 Прогресс цикла»: текущая неделя по дате,
 * % прохождения, недель до конца, adherence прошедших недель из дневника,
 * ближайший старт (taper/пик).
 */
import React, { useMemo } from 'react';
import {
  cardioWeekForDate, cardioNextSession, cardioEquipmentLabel, DAY_LABELS_RU, CARDIO_PHASE_LABELS, type CardioCycle, type CardioType,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog, cardioWeekAdherence } from '../../../engines/lms/cardio-diary.engine';
import { CARD, ROW, LABEL } from './CardioUI';

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioProgressCard: React.FC<{ cycle: CardioCycle | null }> = ({ cycle }) => {
  const data = useMemo(() => {
    if (!cycle) return null;
    const ref = cycle.startDate;
    const week = cardioWeekForDate(cycle, todayIso(), ref);
    const current = week?.week ?? 0;
    const pct = cycle.totalWeeks > 0 ? Math.round((Math.min(current, cycle.totalWeeks) / cycle.totalWeeks) * 100) : 0;
    const log = loadCardioLog();
    const done = cycle.weeks.filter(w => w.week < current).map(w => cardioWeekAdherence(cycle, w.week, log, ref));
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
      nextSession: cardioNextSession(cycle, todayIso(), cycle.startDate),
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
      {data.nextSession && (() => {
        const d = new Date(data.nextSession!.date);
        const dow = (d.getDay() + 6) % 7;
        const s = data.nextSession!.session;
        return (
          <div style={{ fontSize: 10, color: '#4ade80', background: 'rgba(0,230,138,0.07)', border: '1px solid rgba(0,230,138,0.25)', borderRadius: 8, padding: '5px 8px' }}>
            ⏭ Следующая сессия: {TYPE_LABEL[s.type]} {s.durationMin} мин{s.equipment ? ` · ${cardioEquipmentLabel(s.equipment)}` : ''}{s.targetHr?.max ? ` · ЧСС ${s.targetHr.min}-${s.targetHr.max}` : ''} — {DAY_LABELS_RU[dow]} {data.nextSession!.date.slice(5)} (нед {data.nextSession!.week})
          </div>
        );
      })()}
      {data.nextStart && (
        <div style={{ fontSize: 10, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '5px 8px' }}>
          🏁 Ближайший старт: нед {data.nextStart.week} ({CARDIO_PHASE_LABELS[data.nextStart.phase]}) — через {data.nextStart.week - data.current} нед
        </div>
      )}
    </div>
  );
};
