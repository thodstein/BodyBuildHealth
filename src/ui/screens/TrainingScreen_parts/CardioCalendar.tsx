/**
 * CardioCalendar.tsx — календарный вид кардио-цикла (B1).
 * Месячная сетка от startDate, дни с сессиями, подсветка фаз, ног, сегодня.
 * Без внешних зависимостей, чистый React.
 */
import React, { useMemo, useState } from 'react';
import {
  spreadSessionsAcrossDays, DAY_LABELS_RU, CARDIO_PHASE_LABELS,
  type CardioCycle, type CardioType, type CardioPhase,
} from '../../../engines/lms/cardio.engine';
import { CARD, ROW, LABEL, BTN, BTN_SMALL, PHASE_COLOR, PHASE_BG, TYPE_COLOR } from './CardioUI';

const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Z2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return toLocalIso(t);
}
function todayIso(): string {
  const d = new Date();
  return toLocalIso(d);
}

export const CardioCalendar: React.FC<{ cycle: CardioCycle | null }> = ({ cycle }) => {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0); // месяцы от старта
  const today = todayIso();

  const data = useMemo(() => {
    if (!cycle || !cycle.startDate) return null;
    const start = new Date(cycle.startDate + 'T00:00:00');
    const monthStart = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    const firstDow = (monthStart.getDay() + 6) % 7; // Пн=0
    const daysInMonth = monthEnd.getDate();
    const totalCells = firstDow + daysInMonth;
    const rows = Math.ceil(totalCells / 7);
    // Карта даты → сессии + фаза + legDay
    const legDays = new Set((cycle.config?.legDays ?? []).filter(d => d >= 0 && d <= 6));
    const map = new Map<string, { phase: string; sessions: { type: CardioType; durationMin: number; dayOfНеделя: number }[]; isLegДень: boolean; weekNo: number | null }>();
    for (const w of cycle.weeks) {
      const laid = spreadSessionsAcrossDays(w);
      // week start date
      const weekStartIso = addDaysIso(cycle.startDate!, (w.week - 1) * 7);
      for (let d = 0; d < 7; d++) {
        const dateIso = addDaysIso(weekStartIso, d);
        const dayOfWeek = (new Date(dateIso).getDay() + 6) % 7;
        const sess = laid.filter(s => s.dayOfWeek === dayOfWeek);
        const isLeg = legDays.has(dayOfWeek);
        map.set(dateIso, { phase: w.phase, sessions: sess as never, isLegДень: isLeg, weekNo: w.week });
      }
    }
    return { monthStart, monthEnd, firstDow, daysInMonth, rows, map };
  }, [cycle, offset]);

  if (!cycle || !data) {
    return <div style={CARD}><div style={{ fontSize: 12, color: '#fff' }}>Календарь появится после сборки цикла.</div></div>;
  }

  const monthLabel = data.monthStart.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const canPrev = offset > -12;
  const canNext = offset < 12;

  return (
    <div style={CARD}>
      <style>{`@media (max-width:380px){.cardio-calendar-grid{grid-template-columns:repeat(7,1fr)!important;gap:2px!important}.cardio-calendar-grid div{font-size:9px!important;padding:3px 2px!important;min-height:52px!important}}`}</style>
      <div style={ROW}>
        <span style={LABEL}>🗓 Календарь цикла</span>
        <span style={{ fontSize: 11, color: '#fff', textTransform: 'capitalize' }}>{monthLabel}</span>
        <span style={{ flex: 1 }} />
        <button style={BTN_SMALL} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={open ? 'Скрыть календарь' : 'Показать календарь'}>{open ? '▾ Скрыть' : '▸ Календарь'}</button>
        <button style={BTN_SMALL} disabled={!canPrev} onClick={() => setOffset(o => o - 1)} aria-label="Предыдущий месяц">←</button>
        <button style={BTN_SMALL} onClick={() => setOffset(0)} title="К месяцу старта" aria-label="К месяцу старта">●</button>
        <button style={BTN_SMALL} disabled={!canNext} onClick={() => setOffset(o => o + 1)} aria-label="Следующий месяц">→</button>
      </div>
      {open && (
        <>
          <div role="grid" aria-label={`Календарь ${monthLabel}`} className="cardio-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {DAY_LABELS_RU.map(d => (
              <div key={d} role="columnheader" style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#fff', padding: '4px 0' }}>{d}</div>
            ))}
        {Array.from({ length: data.rows * 7 }).map((_, idx) => {
          const dayNum = idx - data.firstDow + 1;
          const inMonth = dayNum >= 1 && dayNum <= data.daysInMonth;
          if (!inMonth) return <div key={idx} style={{ minHeight: 62, borderRadius: 10, background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.06)' }} />;
          const dateIso = toLocalIso(new Date(data.monthStart.getFullYear(), data.monthStart.getMonth(), dayNum));
          const info = data.map.get(dateIso);
          const isToday = dateIso === today;
          const hasSessions = info && info.sessions.length > 0;
          const isLegConflict = info?.isLegDay && info.sessions.some(s => s.type !== 'recovery');
          return (
            <div
              key={idx}
              role="gridcell"
              aria-label={inMonth ? `${dateIso} ${info ? (info.sessions.length ? info.sessions.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin}м`).join(', ') : 'отдых') : ''}${isToday ? ' сегодня' : ''}${info?.isLegDay ? ' день ног' : ''}` : undefined}
              aria-selected={isToday || undefined}
              tabIndex={inMonth ? 0 : -1}
              style={{
                minHeight: 66, borderRadius: 10, padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: 3,
                background: isToday ? 'linear-gradient(180deg, rgba(0,230,138,0.14), rgba(0,230,138,0.04))' : hasSessions ? ((PHASE_BG as Record<string, string>)[info!.phase] ?? 'rgba(255,255,255,0.03)') : 'rgba(255,255,255,0.025)',
                border: isToday ? '1px solid rgba(0,230,138,0.45)' : isLegConflict ? '1px solid rgba(239,68,68,0.35)' : hasSessions ? `1px solid ${((PHASE_COLOR as Record<string, string>)[info!.phase] ?? 'rgba(255,255,255,0.07)')}44` : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isToday ? '0 0 10px rgba(0,230,138,0.18)' : 'none',
                opacity: inMonth ? 1 : 0.3,
              }}
              title={info ? `${dateIso} · ${(CARDIO_PHASE_LABELS as Record<string, string>)[info.phase] ?? info.phase}${info.sessions.length ? ' · ' + info.sessions.map(s => `${TYPE_LABEL[s.type]} ${s.durationMin}м`).join(', ') : ' · отдых'}` : dateIso}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: isToday ? 900 : 700, color: isToday ? '#00e68a' : '#fff' }}>{dayNum}</span>
                {info?.isLegDay && <span style={{ fontSize: 9 }} title="День ног">🦵</span>}
                {isToday && <span style={{ fontSize: 8, fontWeight: 800, color: '#00e68a', background: 'rgba(0,230,138,0.15)', borderRadius: 4, padding: '1px 4px' }}>сегодня</span>}
                <span style={{ flex: 1 }} />
                {info && <span style={{ width: 6, height: 6, borderRadius: 3, background: (PHASE_COLOR as Record<string, string>)[info.phase] ?? '#888' }} />}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {info?.sessions.map((s, j) => (
                  <span key={j} style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLOR[s.type] ?? '#4ade80', background: `${TYPE_COLOR[s.type] ?? '#4ade80'}18`, border: `1px solid ${TYPE_COLOR[s.type] ?? '#4ade80'}30`, borderRadius: 6, padding: '1px 5px', lineHeight: 1.3 }}>
                    {TYPE_LABEL[s.type]} {s.durationMin}
                  </span>
                ))}
                {hasSessions === false && info && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>отдых</span>}
              </div>
              {info?.weekNo && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.32)', marginTop: 'auto' }}>нед {info.weekNo} · {(CARDIO_PHASE_LABELS as Record<string, string>)[info.phase] ?? info.phase}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10, color: '#fff' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PHASE_COLOR.base, marginRight: 4, verticalAlign: 'middle' }} />база</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PHASE_COLOR.build, marginRight: 4 }} />build</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PHASE_COLOR.taper, marginRight: 4 }} />taper</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: PHASE_COLOR.peak, marginRight: 4 }} />пик</span>
        <span>🦵 — день ног</span>
      </div>
        </>
      )}
    </div>
  );
};
