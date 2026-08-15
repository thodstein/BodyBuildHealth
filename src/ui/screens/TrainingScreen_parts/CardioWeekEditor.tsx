/**
 * CardioWeekEditor.tsx — конструктор недели кардио-цикла:
 * раскладка по дням (Пн-Вс), масштабирование минут ±10%, переключатель HIIT
 * и полноценный редактор сессий (тип, минуты, частота, удалить, добавить).
 */
import React, { useMemo, useState } from 'react';
import {
  spreadSessionsAcrossDays, DAY_LABELS_RU, CARDIO_PHASE_LABELS,
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle, kcalForCardio,
  type CardioCycle, type CardioType, type CardioSession, type CardioWeek,
} from '../../../engines/lms/cardio.engine';

const BTN: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 36, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.16)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' };
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 };
const DAY_CELL: React.CSSProperties = {
  flex: '1 1 40px', minWidth: 40, borderRadius: 8, padding: '5px 4px', textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 10,
};
const SEL: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '6px 8px', color: '#fff', fontSize: 12,
};
const NUM: React.CSSProperties = { ...SEL, width: 62 };

const TYPES: CardioType[] = ['zone2', 'miss', 'hiit', 'recovery'];
const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };
const TYPE_SHORT: Record<CardioType, string> = { zone2: 'Z2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };

function rebuildTotals(week: CardioWeek): CardioWeek {
  const totalMinutes = week.sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
  const totalKcal = week.sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
  return { ...week, totalMinutes, totalKcal };
}

export const CardioWeekEditor: React.FC<{ cycle: CardioCycle | null; onChanged?: () => void }> = ({ cycle, onChanged }) => {
  const [weekNo, setWeekNo] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const [editSessions, setEditSessions] = useState(false);
  const [newType, setNewType] = useState<CardioType>('zone2');

  const week: CardioWeek | null = useMemo(() => {
    if (!cycle) return null;
    const clamped = Math.max(1, Math.min(cycle.totalWeeks, weekNo));
    return cycle.weeks.find(w => w.week === clamped) ?? null;
  }, [cycle, weekNo]);

  const days = useMemo(() => (week ? spreadSessionsAcrossDays(week) : []), [week]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 2500); };

  const saveWeek = (patch: (w: CardioWeek) => CardioWeek) => {
    if (!cycle || !week) return;
    const next = { ...cycle, weeks: cycle.weeks.map(w => (w.week === week.week ? rebuildTotals(patch(w)) : w)) };
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    onChanged?.();
    flashMsg('💾 Неделя обновлена');
  };

  const scaleMinutes = (mult: number) => saveWeek(w => ({
    ...w,
    sessions: w.sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)), kcalPerSession: kcalForCardio(s.type, Math.max(10, Math.round(s.durationMin * mult))) })),
  }));

  const updateSession = (idx: number, patch: Partial<CardioSession>) => saveWeek(w => ({
    ...w,
    sessions: w.sessions.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s, ...patch };
      next.kcalPerSession = kcalForCardio(next.type, next.durationMin);
      return next;
    }),
  }));

  const removeSession = (idx: number) => saveWeek(w => ({ ...w, sessions: w.sessions.filter((_, i) => i !== idx) }));

  const addSession = () => saveWeek(w => ({
    ...w,
    sessions: [...w.sessions, { type: newType, durationMin: 30, weeklyFrequency: 1, intensity: newType === 'hiit' ? 'high' : newType === 'recovery' ? 'low' : 'moderate', kcalPerSession: kcalForCardio(newType, 30), purpose: 'Ручная сессия' }],
  }));

  if (!cycle || !week) return null;

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>🛠 Конструктор недели</span>
        <button style={BTN} onClick={() => setWeekNo(Math.max(1, weekNo - 1))} aria-label="Предыдущая неделя">−</button>
        <span style={{ fontSize: 13, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{week.week}</span>
        <button style={BTN} onClick={() => setWeekNo(Math.min(cycle.totalWeeks, weekNo + 1))} aria-label="Следующая неделя">+</button>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{CARDIO_PHASE_LABELS[week.phase]}{week.deload ? ' · делод' : ''}{week.taper ? ' · taper' : ''} · {week.totalMinutes} мин</span>
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600 }} role="status">{flash}</div>}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {DAY_LABELS_RU.map((d, i) => {
          const sess = days.filter(s => s.dayOfWeek === i);
          return (
            <div key={d} style={DAY_CELL}>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 2 }}>{d}</div>
              {sess.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.2)' }}>—</div> : sess.map((s, j) => (
                <div key={j} style={{ color: '#4ade80', fontWeight: 600, whiteSpace: 'nowrap' }}>{TYPE_SHORT[s.type]} {s.durationMin}м</div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={ROW}>
        <button style={BTN} onClick={() => scaleMinutes(0.9)} title="−10% минут на неделе">−10% мин</button>
        <button style={BTN_PRIMARY} onClick={() => scaleMinutes(1.1)} title="+10% минут на неделе">+10% мин</button>
        <button style={BTN} onClick={() => setEditSessions(v => !v)}>{editSessions ? '▾ Скрыть сессии' : '✏️ Редактировать сессии'}</button>
      </div>

      {editSessions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {week.sessions.map((s, idx) => (
            <div key={idx} style={ROW}>
              <select value={s.type} onChange={e => updateSession(idx, { type: e.target.value as CardioType })} style={SEL} aria-label={`Тип сессии ${idx + 1}`}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <input type="number" value={s.durationMin} onChange={e => updateSession(idx, { durationMin: Math.max(5, Math.min(180, Number(e.target.value) || 30)) })} inputMode="numeric" style={NUM} aria-label={`Минуты сессии ${idx + 1}`} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>мин ×</span>
              <button style={{ ...BTN, minHeight: 30, padding: '4px 8px' }} onClick={() => updateSession(idx, { weeklyFrequency: Math.max(1, s.weeklyFrequency - 1) })} aria-label="Меньше частоты">−</button>
              <span style={{ fontSize: 12, fontWeight: 800, minWidth: 16, textAlign: 'center' }}>{s.weeklyFrequency}</span>
              <button style={{ ...BTN, minHeight: 30, padding: '4px 8px' }} onClick={() => updateSession(idx, { weeklyFrequency: Math.min(7, s.weeklyFrequency + 1) })} aria-label="Больше частоты">+</button>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>в нед</span>
              <button style={BTN_DANGER} onClick={() => removeSession(idx)} aria-label={`Удалить сессию ${idx + 1}`}>✕</button>
            </div>
          ))}
          <div style={ROW}>
            <select value={newType} onChange={e => setNewType(e.target.value as CardioType)} style={SEL} aria-label="Тип новой сессии">
              {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button style={BTN_PRIMARY} onClick={addSession}>+ Добавить сессию</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
        Раскладка по дням — ориентировочная (без учёта силовых тренировок); точные дни задайте в дневнике.
      </div>
    </div>
  );
};
