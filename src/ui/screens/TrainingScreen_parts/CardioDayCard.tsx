/**
 * CardioDayCard.tsx — карточка «📅 Кардио и нагрузка дня»: план на сегодня из
 * активного цикла, факт из кардио-журнала и суммарная нагрузка дня
 * (кардио + силовые sRPE). Является кардио-слоем в дневнике/конструкторах.
 */
import React, { useMemo } from 'react';
import { cardioEquipmentLabel, loadActiveCardioCycle, cardioWeekForDate, cardioCoachHints, cardioLegDayForDate, type CardioCycle, type CardioType } from '../../../engines/lms/cardio.engine';
import { cardioDayLoad, loadCardioLog, cardioPaceMinPerKm, type CardioLogEntry } from '../../../engines/lms/cardio-diary.engine';
import { loadSRPESessions, type SRPESession } from '../../../engines/pro/srpe-store';
import { CARD, ROW, LABEL, HINT_SM, BTN_PRIMARY, Badge, TYPE_COLOR, PHASE_COLOR } from './CardioUI';

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };
const HINT_COLOR: Record<string, string> = { test: '#4ade80', deload: '#fbbf24', taper: '#eab308', peak: '#f87171' };
const HINT_ICON: Record<string, string> = { test: '🔬', deload: '🧘', taper: '📉', peak: '🎭' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioDayCard: React.FC<{ cycle?: CardioCycle | null; onOpen?: () => void; log?: CardioLogEntry[]; srpe?: SRPESession[] }> = ({ cycle: cycleProp, onOpen, log: logProp, srpe: srpeProp }) => {
  const cycle = cycleProp !== undefined ? cycleProp : loadActiveCardioCycle();
  const log = useMemo(() => logProp ?? loadCardioLog(), [logProp]);
  const srpe = useMemo(() => srpeProp ?? loadSRPESessions(), [srpeProp]);

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

  const totalLoad = load.totalLoad;
  const cardioPct = totalLoad > 0 ? Math.round((load.cardioLoad / totalLoad) * 100) : 0;
  const strengthPct = totalLoad > 0 ? 100 - cardioPct : 0;

  return (
    <div className="train-cardioday" style={{ ...CARD, gap: 11 }}>
      <div style={ROW}>
        <span style={{ ...LABEL, fontSize: 12.5 }}>📅 Кардио и нагрузка дня</span>
        <Badge bg="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.10)" color="#fff">{today.slice(5)}</Badge>
        <span style={{ flex: 1 }} />
        <button
          style={{ ...BTN_PRIMARY, minHeight: 44, padding: '8px 14px', fontSize: 12 }}
          onClick={() => { if (onOpen) onOpen(); else { try { localStorage.setItem('he_training_planning_track', 'cardio'); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent('planning-track-open', { detail: 'cardio' })); } }}
          aria-label="Открыть кардио-дневник"
        >
          ▶ Дневник
        </button>
      </div>

      {cycle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#fff' }}>План на сегодня</div>
          {load.planned.length === 0 ? (
            <div style={{ fontSize: 12, color: '#fff', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 11, padding: '9px 11px' }}>Кардио не запланировано — отдых.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {load.planned.map((s, i) => (
                <span key={i} style={{ fontSize: 11.5, fontWeight: 800, color: TYPE_COLOR[s.type] ?? '#4ade80', background: `${TYPE_COLOR[s.type] ?? '#4ade80'}14`, border: `1px solid ${TYPE_COLOR[s.type] ?? '#4ade80'}30`, borderRadius: 20, padding: '5px 11px', fontVariantNumeric: 'tabular-nums', boxShadow: `0 0 8px ${TYPE_COLOR[s.type] ?? '#4ade80'}22` }}>
                  {TYPE_LABEL[s.type]} {s.durationMin}м{s.equipment ? ` · ${cardioEquipmentLabel(s.equipment)}` : ''}{s.targetHr?.max ? ` · ${s.targetHr.min}-${s.targetHr.max}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={HINT_SM}>Нет активного цикла — план не задан. Соберите цикл в конструкторе.</div>
      )}

      {legDay?.isLegDay && (
        <div style={{ fontSize: 11.5, background: load.planned.some(s => s.type !== 'recovery') ? 'rgba(239,68,68,0.10)' : 'rgba(245,158,11,0.10)', border: `1px solid ${load.planned.some(s => s.type !== 'recovery') ? 'rgba(239,68,68,0.38)' : 'rgba(245,158,11,0.38)'}`, borderLeft: `3px solid ${load.planned.some(s => s.type !== 'recovery') ? '#ef4444' : '#f59e0b'}`, borderRadius: 11, padding: '8px 11px', color: load.planned.some(s => s.type !== 'recovery') ? '#f87171' : '#fbbf24', lineHeight: 1.5 }} role="status">
          {load.planned.some(s => s.type !== 'recovery')
            ? `🦵 День тяжёлых ног: на сегодня запланировано интенсивное кардио (${load.planned.filter(s => s.type !== 'recovery').map(s => TYPE_LABEL[s.type]).join(', ')}) — лучше перенести его или заменить на recovery.`
            : load.planned.length > 0
              ? '🦵 День тяжёлых ног: сегодня recovery — можно.'
              : '🦵 День тяжёлых ног: интенсивное кардио сегодня не планируется.'}
        </div>
      )}

      {weekHint && (
        <div style={{ fontSize: 11, color: HINT_COLOR[weekHint.kind] ?? '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '7px 10px', lineHeight: 1.45 }}>
          {HINT_ICON[weekHint.kind] ?? '💡'} <b>Нед {weekHint.week}:</b> {weekHint.text}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Факт:</div>
        {load.done.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>кардио не записано.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Badge bg="rgba(0,230,138,0.12)" border="rgba(0,230,138,0.24)" color="#4ade80">{load.done.length} сесс · {load.cardioMinutes}м</Badge>
            {load.done.some(e => e.distanceKm) && <Badge>{load.done.reduce((s, e) => s + (e.distanceKm ?? 0), 0).toFixed(1)} км</Badge>}
            {cardioPaceMinPerKm(load.done.reduce((s, e) => s + (e.distanceKm ?? 0), 0), load.cardioMinutes) && <Badge>{cardioPaceMinPerKm(load.done.reduce((s, e) => s + (e.distanceKm ?? 0), 0), load.cardioMinutes)}</Badge>}
            {load.done.some(e => e.rpe != null) && <Badge>RPE {(load.done.filter(e => e.rpe != null).reduce((s, e) => s + (e.rpe ?? 0), 0) / load.done.filter(e => e.rpe != null).length).toFixed(1)}</Badge>}
          </div>
        )}
      </div>

      {(load.cardioMinutes > 0 || load.strengthSessions > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', borderLeft: '3px solid #f59e0b', borderRadius: 11, padding: '9px 11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#fbbf24', fontWeight: 800 }}>
            <span>🔥 Нагрузка дня</span>
            <span style={{ fontSize: 11.5, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>кардио {load.cardioLoad} · сила {load.strengthLoad} · итого {totalLoad}</span>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)' }}>
            <div style={{ width: cardioPct + '%', background: 'linear-gradient(90deg,#00e68a,#00c8a0)', transition: 'width 0.3s ease', boxShadow: '0 0 8px rgba(0,230,138,0.4)' }} title={`кардио ${cardioPct}%`} />
            <div style={{ width: strengthPct + '%', background: '#f59e0b', transition: 'width 0.3s ease' }} title={`сила ${strengthPct}%`} />
          </div>
          <div style={{ display: 'flex', gap: 9, fontSize: 10.5, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#00e68a', marginRight: 5 }} />кардио {load.cardioMinutes}м</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 5 }} />сила {load.strengthSessions} сесс</span>
          </div>
        </div>
      )}
    </div>
  );
};
