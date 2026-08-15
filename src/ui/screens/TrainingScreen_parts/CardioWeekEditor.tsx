/**
 * CardioWeekEditor.tsx — ручная настройка недели кардио-цикла:
 * раскладка сессий по дням (Пн-Вс), масштабирование минут ±10%,
 * переключатель HIIT. Изменения применяются к активному циклу с сохранением.
 */
import React, { useMemo, useState } from 'react';
import {
  spreadSessionsAcrossDays, DAY_LABELS_RU, CARDIO_PHASE_LABELS,
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle,
  type CardioCycle, type CardioWeek,
} from '../../../engines/lms/cardio.engine';

const BTN: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
  color: '#fff', minHeight: 36, whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: 'rgba(0,230,138,0.16)', border: '1px solid rgba(0,230,138,0.4)', color: '#00e68a' };
const CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
};
const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 };
const DAY_CELL: React.CSSProperties = {
  flex: '1 1 40px', minWidth: 40, borderRadius: 8, padding: '5px 4px', textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 10,
};

const TYPE_LABEL: Record<string, string> = { zone2: 'Z2', hiit: 'HIIT', miss: 'MISS', recovery: 'Rec' };

export const CardioWeekEditor: React.FC<{ cycle: CardioCycle | null; onChanged?: () => void }> = ({ cycle, onChanged }) => {
  const [weekNo, setWeekNo] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);

  const week: CardioWeek | null = useMemo(() => {
    if (!cycle) return null;
    const clamped = Math.max(1, Math.min(cycle.totalWeeks, weekNo));
    return cycle.weeks.find(w => w.week === clamped) ?? null;
  }, [cycle, weekNo]);

  const days = useMemo(() => (week ? spreadSessionsAcrossDays(week) : []), [week]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 2500); };

  const saveWeek = (patch: (w: CardioWeek) => CardioWeek) => {
    if (!cycle || !week) return;
    const next = { ...cycle, weeks: cycle.weeks.map(w => (w.week === week.week ? patch(w) : w)) };
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    onChanged?.();
    flashMsg('💾 Неделя обновлена');
  };

  const scaleMinutes = (mult: number) => saveWeek(w => {
    const sessions = w.sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)) }));
    const totalMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    const totalKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
    return { ...w, sessions, totalMinutes, totalKcal };
  });

  const toggleHiit = () => saveWeek(w => {
    const hasHiit = w.sessions.some(s => s.type === 'hiit');
    const sessions = hasHiit ? w.sessions.filter(s => s.type !== 'hiit') : [...w.sessions, { type: 'hiit' as const, durationMin: 15, weeklyFrequency: 1, intensity: 'high' as const, kcalPerSession: Math.round(15 * 14), purpose: 'Ручное добавление HIIT' }];
    const totalMinutes = sessions.reduce((s, x) => s + x.durationMin * x.weeklyFrequency, 0);
    const totalKcal = sessions.reduce((s, x) => s + x.kcalPerSession * x.weeklyFrequency, 0);
    return { ...w, sessions, totalMinutes, totalKcal };
  });

  if (!cycle || !week) return null;

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>🛠 Ручная настройка недели</span>
        <button style={BTN} onClick={() => setWeekNo(Math.max(1, weekNo - 1))} aria-label="Предыдущая неделя">−</button>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{week.week}</span>
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
                <div key={j} style={{ color: '#4ade80', fontWeight: 600, whiteSpace: 'nowrap' }}>{TYPE_LABEL[s.type]} {s.durationMin}м</div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={ROW}>
        <button style={BTN} onClick={() => scaleMinutes(0.9)} title="−10% минут на неделе">−10% мин</button>
        <button style={BTN_PRIMARY} onClick={() => scaleMinutes(1.1)} title="+10% минут на неделе">+10% мин</button>
        <button style={BTN} onClick={toggleHiit} title={week.sessions.some(s => s.type === 'hiit') ? 'Убрать HIIT с недели' : 'Добавить HIIT 15×1 на неделю'}>
          {week.sessions.some(s => s.type === 'hiit') ? '🚫 Убрать HIIT' : '⚡ Добавить HIIT'}
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
        Раскладка по дням — ориентировочная (без учёта силовых тренировок); точные дни задайте в дневнике.
      </div>
    </div>
  );
};
