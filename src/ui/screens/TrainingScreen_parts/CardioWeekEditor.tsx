/**
 * CardioWeekEditor.tsx — конструктор недели кардио-цикла:
 * раскладка по дням (Пн-Вс), масштабирование минут ±10%, переключатель HIIT
 * и полноценный редактор сессий (тип, минуты, частота, удалить, добавить).
 */
import React, { useMemo, useState } from 'react';
import {
  spreadSessionsAcrossDays, DAY_LABELS_RU, CARDIO_PHASE_LABELS,
  loadCardioCycles, saveCardioCycle, setActiveCardioCycle, kcalForCardio,
  saveCardioCycleVersion, latestCardioCycleVersion, restoreCardioCycleVersion,
  cardioWeekForDate, cardioSafetyReport, cycleBodyWeight, cardioWeekLegConflicts,
  type CardioCycle, type CardioType, type CardioSession, type CardioWeek,
} from '../../../engines/lms/cardio.engine';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_DANGER, BTN_SMALL } from './CardioUI';

const DAY_CELL: React.CSSProperties = {
  flex: '1 1 40px', minWidth: 44, borderRadius: 10, padding: '6px 4px', textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 10,
  minHeight: 56, display: 'flex', flexDirection: 'column', gap: 3,
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
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const week: CardioWeek | null = useMemo(() => {
    if (!cycle) return null;
    const clamped = Math.max(1, Math.min(cycle.totalWeeks, weekNo));
    return cycle.weeks.find(w => w.week === clamped) ?? null;
  }, [cycle, weekNo]);

  const days = useMemo(() => (week ? spreadSessionsAcrossDays(week) : []), [week]);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 2500); };

  const saveWeek = (patch: (w: CardioWeek) => CardioWeek) => {
    if (!cycle || !week) return;
    saveCardioCycleVersion(cycle, `правка недели ${week.week}`);
    const next = { ...cycle, weeks: cycle.weeks.map(w => (w.week === week.week ? rebuildTotals(patch(w)) : w)) };
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    onChanged?.();
    flashMsg('💾 Неделя обновлена');
  };

  const undoVersion = () => {
    if (!cycle) return;
    const restored = restoreCardioCycleVersion(cycle.id);
    if (!restored) { flashMsg('⚠ Нет сохранённых версий'); return; }
    saveCardioCycle(restored);
    setActiveCardioCycle(restored);
    onChanged?.();
    flashMsg('↩ Версия недели восстановлена');
  };

  const copyToNext = () => {
    if (!cycle || !week || week.week >= cycle.totalWeeks) return;
    saveCardioCycleVersion(cycle, 'копия недели');
    const next = {
      ...cycle,
      weeks: cycle.weeks.map(w => (w.week === week.week + 1 ? { ...rebuildTotals({ ...week, week: week.week + 1 }), phase: w.phase, deload: w.deload, taper: w.taper, rationale: w.rationale } : w)),
    };
    saveCardioCycle(next);
    setActiveCardioCycle(next);
    setWeekNo(Math.min(cycle.totalWeeks, week.week + 1));
    onChanged?.();
    flashMsg(`⧉ Неделя ${week.week} скопирована в неделю ${week.week + 1}`);
  };

  const hasVersion = cycle ? latestCardioCycleVersion(cycle.id) != null : false;

  const goCurrentWeek = () => {
    if (!cycle) return;
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const w = cardioWeekForDate(cycle, iso, cycle.startDate);
    setWeekNo(Math.min(cycle.totalWeeks, Math.max(1, w?.week ?? 1)));
  };

  const safety = useMemo(() => (week ? cardioSafetyReport({ ...cycle!, weeks: [week] }).warnings : []), [week, cycle]);

  const legDays = useMemo(() => new Set((cycle?.config?.legDays ?? []).filter(d => d >= 0 && d <= 6)), [cycle]);
  const legConflicts = useMemo(() => (cycle && week ? cardioWeekLegConflicts(cycle, week.week) : []), [cycle, week]);

  const bw = cycle ? cycleBodyWeight(cycle) : 80;

  const scaleMinutes = (mult: number) => saveWeek(w => ({
    ...w,
    sessions: w.sessions.map(s => ({ ...s, durationMin: Math.max(10, Math.round(s.durationMin * mult)), kcalPerSession: kcalForCardio(s.type, Math.max(10, Math.round(s.durationMin * mult)), bw, s.equipment) })),
  }));

  const updateSession = (idx: number, patch: Partial<CardioSession>) => saveWeek(w => ({
    ...w,
    sessions: w.sessions.map((s, i) => {
      if (i !== idx) return s;
      const next = { ...s, ...patch };
      next.kcalPerSession = kcalForCardio(next.type, next.durationMin, bw, next.equipment);
      return next;
    }),
  }));

  const removeSession = (idx: number) => saveWeek(w => ({ ...w, sessions: w.sessions.filter((_, i) => i !== idx) }));

  const addSession = () => saveWeek(w => ({
    ...w,
    sessions: [...w.sessions, { type: newType, durationMin: 30, weeklyFrequency: 1, intensity: newType === 'hiit' ? 'high' : newType === 'recovery' ? 'low' : 'moderate', kcalPerSession: kcalForCardio(newType, 30, bw, undefined), purpose: 'Ручная сессия' }],
  }));

  if (!cycle || !week) return null;

  const onDragStart = (idx: number) => setDragIdx(idx);
  const onDragOverDay = (day: number, e: React.DragEvent) => { e.preventDefault(); setDragOverDay(day); };
  const onDropDay = (day: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx == null) return;
    const idx = dragIdx;
    setDragIdx(null);
    setDragOverDay(null);
    updateSession(idx, { dayOfНеделя: day });
  };

  return (
    <div style={CARD}>
      <style>{`@media (max-width:480px){.cardio-day-grid{display:grid!important;grid-template-columns:repeat(4,1fr)}.cardio-day-grid>div{min-width:0!important}}`}</style>
      <div style={ROW}>
        <span style={LABEL}>🛠 Конструктор недели</span>
        <button style={BTN_SMALL} onClick={() => setWeekNo(Math.max(1, weekNo - 1))} aria-label="Предыдущая неделя">−</button>
        <span style={{ fontSize: 13, fontWeight: 850, minWidth: 30, textAlign: 'center' }}>{week.week}</span>
        <button style={BTN_SMALL} onClick={() => setWeekNo(Math.min(cycle.totalWeeks, weekNo + 1))} aria-label="Следующая неделя">+</button>
        <button style={BTN_SMALL} onClick={goCurrentWeek} title="К текущей неделе" aria-label="К текущей неделе">📍 Сегодня</button>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{CARDIO_PHASE_LABELS[week.phase]}{week.deload ? ' · делод' : ''}{week.taper ? ' · taper' : ''} · {week.totalMinutes} мин</span>
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 700 }} role="status">{flash}</div>}
      {safety.length > 0 && safety.map((s, i) => (
        <div key={i} style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 8px' }} role="alert">⚠ {s}</div>
      ))}
      {legConflicts.length > 0 && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '6px 8px' }} role="alert">
          ⚠ Сессии на дне ног ({legConflicts.map(c => DAY_LABELS_RU[c.dayOfWeek]).join(', ')}) — перетащите сессию на свободный день (DnD).
        </div>
      )}

      <div className="cardio-day-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {DAY_LABELS_RU.map((d, i) => {
          const isLeg = legDays.has(i);
          const sess = days.filter(s => s.dayOfWeek === i);
          const isOver = dragOverDay === i;
          const isConflict = isLeg && sess.some(s => s.type !== 'recovery');
          return (
            <div
              key={d}
              onDragOver={e => onDragOverDay(i, e)}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={e => onDropDay(i, e)}
              style={{
                ...DAY_CELL,
                ...(isLeg ? { background: isConflict ? 'rgba(239,68,68,0.09)' : 'rgba(245,158,11,0.08)', border: isConflict ? '1px solid rgba(239,68,68,0.38)' : '1px solid rgba(245,158,11,0.32)' } : {}),
                ...(isOver ? { background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.45)', boxShadow: '0 0 10px rgba(0,230,138,0.18)' } : {}),
              }}
            >
              <div style={{ color: isLeg ? '#fbbf24' : 'rgba(255,255,255,0.55)', fontWeight: 800, fontSize: 11 }}>{d}{isLeg ? ' 🦵' : ''}</div>
              {sess.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.22)', fontSize: 11, marginTop: 4 }}>—</div> : sess.map((s, j) => (
                <div key={j} style={{ color: isLeg && s.type !== 'recovery' ? '#f87171' : '#4ade80', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', background: `${isLeg && s.type !== 'recovery' ? 'rgba(239,68,68,0.12)' : 'rgba(0,230,138,0.08)'}`, border: `1px solid ${isLeg && s.type !== 'recovery' ? 'rgba(239,68,68,0.24)' : 'rgba(0,230,138,0.18)'}`, borderRadius: 6, padding: '1px 4px' }}>{TYPE_SHORT[s.type]} {s.durationMin}м</div>
              ))}
              {isOver && <div style={{ fontSize: 8, color: '#00e68a', fontWeight: 700 }}>⇣ сюда</div>}
            </div>
          );
        })}
      </div>

      <div style={ROW}>
        <button style={BTN_SMALL} onClick={() => scaleMinutes(0.9)} title="−10% минут на неделе">−10% мин</button>
        <button style={{ ...BTN_PRIMARY, minHeight: 32, padding: '6px 12px', fontSize: 11 } as never} onClick={() => scaleMinutes(1.1)} title="+10% минут на неделе">+10% мин</button>
        <button style={BTN_SMALL} onClick={() => setEditSessions(v => !v)}>{editSessions ? '▾ Скрыть сессии' : '✏️ Редактировать сессии'}</button>
        {week.week < cycle.totalWeeks && <button style={BTN_SMALL} onClick={copyToNext} title="Скопировать сессии недели в следующую">⧉ В след. неделю</button>}
        {hasVersion && <button style={BTN_SMALL} onClick={undoVersion} title="Отменить последнюю правку">↩ Вернуть</button>}
      </div>

      {editSessions && (
        <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={HINT_SM}>Перетащите строку на день недели выше, или выберите день в селекте. DnD — быстрый перенос. Клавиатура: ←/→ перемещает день.</div>
          {week.sessions.map((s, idx) => (
            <div key={idx} role="listitem" aria-grabbed={dragIdx === idx} tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const cur = s.dayOfWeek ?? 0; const next = (cur + (e.key === 'ArrowLeft' ? -1 : 1) + 7) % 7; updateSession(idx, { dayOfНеделя: next }); } }} style={{ ...ROW, opacity: dragIdx === idx ? 0.6 : 1, border: dragIdx === idx ? '1px dashed rgba(0,230,138,0.35)' : '1px solid transparent', borderRadius: 8, padding: '4px 0' }} draggable onDragStart={() => onDragStart(idx)} onDragEnd={() => setDragIdx(null)} title="Перетащите на день недели или используйте ←/→ для перемещения">
              <span style={{ cursor: 'grab', fontSize: 12, color: 'rgba(255,255,255,0.85)', padding: '0 4px', userSelect: 'none' }} aria-hidden>⋮⋮</span>
              <select value={s.type} onChange={e => updateSession(idx, { type: e.target.value as CardioType })} style={SEL} aria-label={`Тип сессии ${idx + 1}`}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <select value={s.dayOfWeek != null ? String(s.dayOfWeek) : ''} onChange={e => updateSession(idx, { dayOfНеделя: e.target.value === '' ? undefined : Number(e.target.value) })} style={SEL} aria-label={`День недели сессии ${idx + 1}`}>
                <option value="">Авто</option>
                {DAY_LABELS_RU.map((d, di) => <option key={di} value={di}>{d}{legDays.has(di) ? ' (ноги)' : ''}</option>)}
              </select>
              {s.dayOfWeek != null && legDays.has(s.dayOfWeek) && s.type !== 'recovery' && (
                <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }} title="День тяжёлых ног — интенсивное кардио лучше перенести">⚠ ноги</span>
              )}
              <input type="number" value={s.durationMin} onChange={e => updateSession(idx, { durationMin: Math.max(5, Math.min(180, Number(e.target.value) || 30)) })} inputMode="numeric" style={NUM} aria-label={`Минуты сессии ${idx + 1}`} />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>мин ×</span>
              <button style={{ ...BTN, minHeight: 30, padding: '4px 8px' }} onClick={() => updateSession(idx, { weeklyFrequency: Math.max(1, s.weeklyFrequency - 1) })} aria-label="Меньше частоты">−</button>
              <span style={{ fontSize: 12, fontWeight: 800, minWidth: 16, textAlign: 'center' }}>{s.weeklyFrequency}</span>
              <button style={{ ...BTN, minHeight: 30, padding: '4px 8px' }} onClick={() => updateSession(idx, { weeklyFrequency: Math.min(7, s.weeklyFrequency + 1) })} aria-label="Больше частоты">+</button>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>в нед</span>
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

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>
        {legDays.size > 0
          ? `🦵 Дни тяжёлых ног: ${DAY_LABELS_RU.filter((_, i) => legDays.has(i)).join(', ')} — интенсивное кардио на них не ставится (recovery — можно в любой день); точные дни задайте в дневнике.`
          : 'Раскладка по дням — ориентировочная (без учёта силовых тренировок); точные дни задайте в дневнике.'}
      </div>
    </div>
  );
};
