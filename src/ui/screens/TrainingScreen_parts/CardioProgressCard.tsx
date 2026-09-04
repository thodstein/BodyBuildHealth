/**
 * CardioProgressCard.tsx — «📍 Прогресс цикла»: текущая неделя по дате,
 * % прохождения, недель до конца, adherence прошедших недель из дневника,
 * ближайший старт (taper/пик).
 */
import React, { useMemo } from 'react';
import {
  cardioWeekForDate, cardioNextSession, cardioEquipmentLabel, DAY_LABELS_RU, CARDIO_PHASE_LABELS,
  cardioCoachHints, type CardioCycle, type CardioType,
} from '../../../engines/lms/cardio.engine';
import { loadCardioLog, cardioWeekFact, type CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';
import { CARD, ROW, LABEL, HINT_SM, Badge, ProgressBar, PHASE_COLOR, TYPE_COLOR } from './CardioUI';

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const HINT_COLOR: Record<string, string> = { test: '#4ade80', deload: '#fbbf24', taper: '#eab308', peak: '#f87171' };
const HINT_ICON: Record<string, string> = { test: '🔬', deload: '🧘', taper: '📉', peak: '🎭' };

export const CardioProgressCard: React.FC<{ cycle: CardioCycle | null; log?: CardioLogEntry[] }> = ({ cycle, log: logProp }) => {
  const data = useMemo(() => {
    if (!cycle) return null;
    const ref = cycle.startDate;
    const week = cardioWeekForDate(cycle, todayIso(), ref);
    const current = week?.week ?? 0;
    const pct = cycle.totalWeeks > 0 ? Math.round((Math.min(current, cycle.totalWeeks) / cycle.totalWeeks) * 100) : 0;
    const log = logProp ?? loadCardioLog();
    const done = cycle.weeks.filter(w => w.week < current).map(w => cardioWeekFact(cycle, w.week, log, ref));
    const planned = done.reduce((s, a) => s + a.plannedSessions, 0);
    const actual = done.reduce((s, a) => s + a.doneSessions, 0);
    const adherence = planned > 0 ? Math.round((actual / planned) * 100) : null;
    const factKcal = done.reduce((s, a) => s + a.factKcal, 0);
    const factKm = Math.round(done.reduce((s, a) => s + a.factKm, 0) * 10) / 10;
    const nextStart = cycle.weeks.find(w => w.week >= current && (w.phase === 'taper' || w.phase === 'peak'));
    // Подсказка текущей недели (тренерские заметки).
    const hint = current >= 1 ? cardioCoachHints(cycle).find(h => h.week === current) ?? null : null;
    return {
      current,
      pct,
      adherence,
      factKcal,
      factKm,
      left: Math.max(0, cycle.totalWeeks - current),
      currentPhase: week?.phase ?? null,
      nextStart,
      nextSession: cardioNextSession(cycle, todayIso(), cycle.startDate),
      totalWeeks: cycle.totalWeeks,
      hint,
    };
  }, [cycle, logProp]);

  if (!cycle || !data) return null;

  return (
    <div className="train-cardioprog" style={{ ...CARD, gap: 10 }}>
      <div style={ROW}>
        <span style={LABEL}>📍 Прогресс цикла</span>
        <Badge bg={PHASE_COLOR[data.currentPhase ?? ''] ? (PHASE_COLOR[data.currentPhase ?? ''] + '22') : 'rgba(255,255,255,0.06)'} border={PHASE_COLOR[data.currentPhase ?? ''] ? (PHASE_COLOR[data.currentPhase ?? ''] + '44') : 'rgba(255,255,255,0.08)'} color={PHASE_COLOR[data.currentPhase ?? ''] ?? '#fff'}>{data.currentPhase ? CARDIO_PHASE_LABELS[data.currentPhase] : '—'}</Badge>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#fff' }}>осталось {data.left} нед</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Неделя {data.current || '—'} из {data.totalWeeks}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#00e68a', marginLeft: 'auto' }}>{data.pct}%</span>
      </div>
      <ProgressBar value={data.pct} color="#00e68a" height={8} />
      <div style={ROW}>
        <span style={{ fontSize: 11, color: '#fff' }}>{data.pct}% пройдено</span>
        {data.adherence != null && (
          <span style={{ fontSize: 11, color: data.adherence >= 80 ? '#4ade80' : data.adherence >= 50 ? '#fbbf24' : '#f87171' }}>
            · выполнение прошлых недель: {data.adherence}%{data.factKcal > 0 ? ` · факт ${data.factKcal} ккал` : ''}{data.factKm > 0 ? ` · ${data.factKm} км` : ''}
          </span>
        )}
      </div>
      {data.hint && data.hint.kind !== 'work' && (
        <div style={{ fontSize: 10, color: HINT_COLOR[data.hint.kind] ?? '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '5px 8px' }}>
          {HINT_ICON[data.hint.kind] ?? '💡'} Нед {data.hint.week}: {data.hint.text}
        </div>
      )}
      {data.nextSession && (() => {
        const d = new Date(data.nextSession!.date);
        const dow = (d.getDay() + 6) % 7;
        const s = data.nextSession!.session;
        return (
          <div style={{ fontSize: 11, color: '#4ade80', background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.22)', borderRadius: 10, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800 }}>⏭ Следующая:</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[s.type] ?? '#4ade80', background: `${TYPE_COLOR[s.type] ?? '#4ade80'}14`, border: `1px solid ${TYPE_COLOR[s.type] ?? '#4ade80'}28`, borderRadius: 20, padding: '2px 8px' }}>{TYPE_LABEL[s.type]} {s.durationMin}м</span>
            {s.equipment && <span style={{ fontSize: 10, color: '#fff' }}>{cardioEquipmentLabel(s.equipment)}</span>}
            {s.targetHr?.max && <span style={{ fontSize: 10, color: '#60a5fa' }}>ЧСС {s.targetHr.min}-{s.targetHr.max}</span>}
            <span style={{ fontSize: 10, color: '#fff', marginLeft: 'auto' }}>{DAY_LABELS_RU[dow]} {data.nextSession!.date.slice(5)} · нед {data.nextSession!.week}</span>
          </div>
        );
      })()}
      {data.nextStart && (
        <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 10, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 800 }}>🏁 Старт:</span>
          <span>нед {data.nextStart.week} ({CARDIO_PHASE_LABELS[data.nextStart.phase]})</span>
          <Badge bg="rgba(245,158,11,0.12)" border="rgba(245,158,11,0.28)" color="#fbbf24">через {data.nextStart.week - data.current} нед</Badge>
        </div>
      )}
    </div>
  );
};
