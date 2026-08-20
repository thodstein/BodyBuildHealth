/**
 * CardioDayCard.tsx — карточка «📅 Кардио и нагрузка дня»: план на сегодня из
 * активного цикла, факт из кардио-журнала и суммарная нагрузка дня
 * (кардио + силовые sRPE). Является кардио-слоем в дневнике/конструкторах.
 */
import React, { useMemo } from 'react';
import { cardioEquipmentLabel, loadActiveCardioCycle, cardioWeekForDate, cardioCoachHints, cardioLegDayForDate, type CardioCycle, type CardioType } from '../../../engines/lms/cardio.engine';
import { cardioDayLoad, loadCardioLog, cardioPaceMinPerKm } from '../../../engines/lms/cardio-diary.engine';
import { loadSRPESessions } from '../../../engines/pro/srpe-store';
import { CARD, ROW, BTN_PRIMARY } from './CardioUI';

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };
const HINT_COLOR: Record<string, string> = { test: '#4ade80', deload: '#fbbf24', taper: '#eab308', peak: '#f87171' };
const HINT_ICON: Record<string, string> = { test: '🔬', deload: '🧘', taper: '📉', peak: '🎭' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioDayCard: React.FC<{ cycle?: CardioCycle | null; onOpen?: () => void }> = ({ cycle: cycleProp, onOpen }) => {
  const cycle = cycleProp !== undefined ? cycleProp : loadActiveCardioCycle();
  const log = useMemo(() => loadCardioLog(), []);
  const srpe = useMemo(() => loadSRPESessions(), []);

  const today = todayIso();
  const load = useMemo(() => cardioDayLoad(cycle, log, srpe, today, cycle?.startDate), [cycle, log, srpe, today]);
  const legDay = useMemo(() => cardioLegDayForDate(cycle, today), [cycle, today]);
  // Тренерская подсказка текущей недели (замер/делод/taper/пик).
  const weekHint = useMemo(() => {
    if (!cycle) return null;
    const weekForDate = cardioWeekForDate(cycle, today, cycle.startDate);
    const currentWeek = Math.min(weekForDate ? weekForDate.week : 1, cycle.totalWeeks);
    return cardioCoachHints(cycle).find(h => h.week === currentWeek && h.kind !== 'work') ?? null;
  }, [cycle, today]);

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>📅 Кардио и нагрузка дня</span>
        <button
          style={{ ...BTN_PRIMARY, minHeight: 30, padding: '4px 10px', fontSize: 10 }}
          onClick={() => { if (onOpen) onOpen(); else { try { localStorage.setItem('he_training_planning_track', 'cardio'); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'cardio' })); } }}
          aria-label="Открыть кардио-дневник"
        >
          ▶ Дневник
        </button>
      </div>

      {cycle && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
          {load.planned.length === 0
            ? 'План: кардио на сегодня нет.'
            : 'План: ' + load.planned.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin} мин${s.equipment ? ' · ' + cardioEquipmentLabel(s.equipment) : ''}${s.targetHr?.max ? ' · ЧСС ' + s.targetHr.min + '-' + s.targetHr.max : ''}`).join(' · ')}
        </div>
      )}
      {legDay?.isLegDay && (
        <div style={{ fontSize: 10, background: load.planned.some(s => s.type !== 'recovery') ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${load.planned.some(s => s.type !== 'recovery') ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`, borderRadius: 8, padding: '4px 8px', color: load.planned.some(s => s.type !== 'recovery') ? '#f87171' : '#fbbf24' }} role="status">
          {load.planned.some(s => s.type !== 'recovery')
            ? `🦵 День тяжёлых ног: на сегодня запланировано интенсивное кардио (${load.planned.filter(s => s.type !== 'recovery').map(s => TYPE_LABEL[s.type]).join(', ')}) — лучше перенести его или заменить на recovery.`
            : load.planned.length > 0
              ? '🦵 День тяжёлых ног: сегодня recovery — можно.'
              : '🦵 День тяжёлых ног: интенсивное кардио сегодня не планируется.'}
        </div>
      )}
      {weekHint && (
        <div style={{ fontSize: 10, color: HINT_COLOR[weekHint.kind] ?? 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '4px 8px' }}>
          {HINT_ICON[weekHint.kind] ?? '💡'} Нед {weekHint.week}: {weekHint.text}
        </div>
      )}
      <div style={{ fontSize: 11, color: load.done.length > 0 ? '#4ade80' : 'rgba(255,255,255,0.45)' }}>
        Факт: {load.done.length === 0
          ? 'кардио не записано.'
          : `${load.done.length} сессий · ${load.cardioMinutes} мин${load.done.some(e => e.distanceKm) ? ' · ' + load.done.reduce((s, e) => s + (e.distanceKm ?? 0), 0) + ' км' : ''}${cardioPaceMinPerKm(load.done.reduce((s, e) => s + (e.distanceKm ?? 0), 0), load.cardioMinutes) ? ' · ' + cardioPaceMinPerKm(load.done.reduce((s, e) => s + (e.distanceKm ?? 0), 0), load.cardioMinutes) : ''}${load.done.some(e => e.rpe != null) ? ' · RPE ' + (load.done.filter(e => e.rpe != null).reduce((s, e) => s + (e.rpe ?? 0), 0) / load.done.filter(e => e.rpe != null).length).toFixed(1) : ''}`}
      </div>
      {(load.cardioMinutes > 0 || load.strengthSessions > 0) && (
        <div style={{ fontSize: 11, color: '#fbbf24' }}>
          🔥 Нагрузка дня: кардио {load.cardioMinutes} мин (нагр. {load.cardioLoad}) · сила {load.strengthSessions} сесс. (нагр. {load.strengthLoad}) · итого {load.totalLoad}
        </div>
      )}
    </div>
  );
};
