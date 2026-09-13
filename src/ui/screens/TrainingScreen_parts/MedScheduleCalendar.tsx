/**
 * MedScheduleCalendar.tsx — 3 варианта календаря «уколы + БАД + тренировки».
 * Источники (все локальные, try/catch):
 *  уколы — he_injection_diary + he_injection_schedule
 *  БАД   — he_supplement_diary (+ he_pharma_diary как fallback)
 *  силовые — he_workout_log_v2 · кардио — he_cardio_sessions
 */
import React, { useMemo, useState } from 'react';

const WHITE = '#fff';
const ACCENT = '#00e68a';
const CARD: React.CSSProperties = {
  background: 'var(--glass-bg)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 18, padding: 12, margin: '8px 0',
};
const TABULAR: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export interface DayStatus { date: string; shots: number; supps: number; workouts: number; cardio: number }
export interface WeekMatrix { dates: string[]; rows: { key: 'shots' | 'supps' | 'train'; label: string; cells: boolean[] }[] }

function pad(n: number): string { return String(n).padStart(2, '0'); }
export function localKey(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function shiftKey(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localKey(d);
}
function readArr(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function dateOf(e: any): string {
  const d = String(e?.date ?? e?.dateIso ?? e?.day ?? '');
  return d.slice(0, 10);
}

/** Статус одного дня по 4 трекам (чистая, тестируемая). */
export function buildDayStatus(dateIso: string, db?: { shots?: any[]; supps?: any[]; workouts?: any[]; cardio?: any[] }): DayStatus {
  const shots = (db?.shots ?? readArr('he_injection_diary')).filter(e => dateOf(e) === dateIso).length;
  const supps = (db?.supps ?? [...readArr('he_supplement_diary'), ...readArr('he_pharma_diary')]).filter(e => dateOf(e) === dateIso).length;
  const workouts = (db?.workouts ?? readArr('he_workout_log_v2')).filter(e => dateOf(e) === dateIso).length;
  const cardio = (db?.cardio ?? readArr('he_cardio_sessions')).filter(e => dateOf(e) === dateIso).length;
  return { date: dateIso, shots, supps, workouts, cardio };
}

/** Недельная матрица 7×3: уколы / БАД / тренировки(сила+кардио). */
export function buildWeekMatrix(startIso: string, db?: { shots?: any[]; supps?: any[]; workouts?: any[]; cardio?: any[] }): WeekMatrix {
  const dates = Array.from({ length: 7 }, (_, i) => shiftKey(startIso, i));
  const shots = (db?.shots ?? readArr('he_injection_diary')).map(dateOf);
  const supps = (db?.supps ?? [...readArr('he_supplement_diary'), ...readArr('he_pharma_diary')]).map(dateOf);
  const trains = [...(db?.workouts ?? readArr('he_workout_log_v2')).map(dateOf), ...(db?.cardio ?? readArr('he_cardio_sessions')).map(dateOf)];
  return {
    dates,
    rows: [
      { key: 'shots', label: '💉 Уколы', cells: dates.map(d => shots.includes(d)) },
      { key: 'supps', label: '💊 БАД', cells: dates.map(d => supps.includes(d)) },
      { key: 'train', label: '🏋️ Трени', cells: dates.map(d => trains.includes(d)) },
    ],
  };
}

/** Ячейки месяца для теплокарты: интенсивность = треки с данными (0..3). */
export function buildMonthCells(year: number, month0: number, db?: { shots?: any[]; supps?: any[]; workouts?: any[]; cardio?: any[] }): { date: string; level: number }[] {
  const first = new Date(year, month0, 1);
  const days = new Date(year, month0 + 1, 0).getDate();
  const out: { date: string; level: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const key = localKey(new Date(year, month0, d));
    const s = buildDayStatus(key, db);
    out.push({ date: key, level: (s.shots > 0 ? 1 : 0) + (s.supps > 0 ? 1 : 0) + (s.workouts + s.cardio > 0 ? 1 : 0) });
  }
  void first;
  return out;
}

const DOT: React.CSSProperties = { width: 10, height: 10, borderRadius: 6, display: 'inline-block', marginRight: 4 };

/* ── C1: лента «Сегодня + 6 дней» ──────────────────────────────────────── */
export const ScheduleDayStrip: React.FC = () => {
  const today = useMemo(() => localKey(new Date()), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftKey(today, i - 3)), [today]);
  return (
    <div data-cal="daystrip" style={CARD} role="list" aria-label="Лента недели уколы БАД тренировки">
      <div style={{ color: WHITE, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>📅 Сегодня ± 3 дня</div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {days.map(d => {
          const s = buildDayStatus(d);
          const isToday = d === today;
          return (
            <div key={d} role="listitem" aria-label={`${d}: уколов ${s.shots}, БАД ${s.supps}, тренировок ${s.workouts + s.cardio}`}
              style={{ minWidth: 84, borderRadius: 12, padding: 8, border: isToday ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.10)', background: isToday ? 'rgba(0,230,138,0.10)' : 'transparent' }}>
              <div style={{ color: WHITE, fontSize: 11, ...TABULAR }}>{d.slice(5)}{isToday ? ' ·●' : ''}</div>
              <div style={{ marginTop: 6, fontSize: 11, color: WHITE }}>
                <div><span style={{ ...DOT, background: s.shots ? '#7cc4ff' : 'rgba(255,255,255,0.12)' }} />💉 {s.shots}</div>
                <div><span style={{ ...DOT, background: s.supps ? '#c9f73a' : 'rgba(255,255,255,0.12)' }} />💊 {s.supps}</div>
                <div><span style={{ ...DOT, background: (s.workouts + s.cardio) ? ACCENT : 'rgba(255,255,255,0.12)' }} />🏋️ {s.workouts + s.cardio}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── C2: матрица недели 7×3 ────────────────────────────────────────────── */
export const ScheduleWeekMatrix: React.FC = () => {
  const today = useMemo(() => localKey(new Date()), []);
  const monday = useMemo(() => shiftKey(today, -((new Date(`${today}T00:00:00`).getDay() + 6) % 7)), [today]);
  const m = useMemo(() => buildWeekMatrix(monday), [monday]);
  return (
    <div data-cal="weekmatrix" style={CARD} role="table" aria-label="Матрица недели">
      <div style={{ color: WHITE, fontSize: 13, fontWeight: 800, marginBottom: 8 }}>🗓 Неделя с {monday.slice(5)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '86px repeat(7, 1fr)', gap: 4, alignItems: 'center' }}>
        <div />
        {m.dates.map(d => <div key={d} style={{ color: WHITE, fontSize: 10, textAlign: 'center', ...TABULAR }}>{d.slice(8)}</div>)}
        {m.rows.map(row => (
          <React.Fragment key={row.key}>
            <div style={{ color: WHITE, fontSize: 11 }}>{row.label}</div>
            {row.cells.map((c, i) => (
              <div key={i} role="cell" aria-label={`${row.label} ${m.dates[i]} ${c ? 'да' : 'нет'}`}
                style={{ height: 32, borderRadius: 8, background: c ? 'rgba(0,230,138,0.35)' : 'rgba(255,255,255,0.06)', border: c ? `1px solid ${ACCENT}` : '1px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 13 }}>
                {c ? '●' : '·'}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/* ── C3: теплокарта месяца + счётчики ──────────────────────────────────── */
export const ScheduleMonthHeat: React.FC = () => {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const cells = useMemo(() => buildMonthCells(ym.y, ym.m), [ym]);
  const monthLabel = `${pad(ym.m + 1)}.${ym.y}`;
  const bg = (l: number) => l === 0 ? 'rgba(255,255,255,0.05)' : l === 1 ? 'rgba(0,230,138,0.20)' : l === 2 ? 'rgba(0,230,138,0.45)' : 'rgba(0,230,138,0.75)';
  return (
    <div data-cal="monthheat" style={CARD} aria-label={`Теплокарта ${monthLabel}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button type="button" data-act="cal-prev" style={{ minWidth: 44, minHeight: 44, borderRadius: 12, background: 'transparent', color: WHITE, border: '1px solid rgba(255,255,255,0.14)', fontSize: 16 }} aria-label="Предыдущий месяц"
          onClick={() => setYm(v => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}>‹</button>
        <div style={{ color: WHITE, fontSize: 14, fontWeight: 800, ...TABULAR }}>{monthLabel}</div>
        <button type="button" data-act="cal-next" style={{ minWidth: 44, minHeight: 44, borderRadius: 12, background: 'transparent', color: WHITE, border: '1px solid rgba(255,255,255,0.14)', fontSize: 16 }} aria-label="Следующий месяц"
          onClick={() => setYm(v => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map(c => (
          <div key={c.date} data-date={c.date} data-level={c.level} title={`${c.date} · ${c.level}/3`}
            style={{ height: 34, borderRadius: 8, background: bg(c.level), display: 'flex', alignItems: 'center', justifyContent: 'center', color: WHITE, fontSize: 10, ...TABULAR }}>
            {c.date.slice(8)}
          </div>
        ))}
      </div>
      <div style={{ color: WHITE, fontSize: 11, marginTop: 8 }}>Насыщенность = треки с данными: 💉 + 💊 + 🏋️ (макс 3). Детали — тап по дню в Дневниках.</div>
    </div>
  );
};

export const MedScheduleCalendarPanel: React.FC = () => {
  const [tab, setTab] = useState<'strip' | 'week' | 'month'>('strip');
  return (
    <section data-widget="medcal-panel" aria-label="Календарь уколы БАД тренировки" style={CARD}>
      <div role="tablist" aria-label="Вариант календаря" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {([['strip', '📅 Лента'], ['week', '🗓 Матрица'], ['month', '🗺 Месяц']] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} data-tab={k} onClick={() => setTab(k)}
            style={{ flex: 1, minHeight: 44, borderRadius: 12, border: tab === k ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.12)', background: tab === k ? 'rgba(0,230,138,0.12)' : 'transparent', color: WHITE, fontWeight: 800, fontSize: 13 }}>{label}</button>
        ))}
      </div>
      {tab === 'strip' && <ScheduleDayStrip />}
      {tab === 'week' && <ScheduleWeekMatrix />}
      {tab === 'month' && <ScheduleMonthHeat />}
    </section>
  );
};
