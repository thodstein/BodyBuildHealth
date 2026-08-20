/**
 * CardioDiaryPanel.tsx — дневник выполнения кардио: запись сессии,
 * статистика 7/28 дней, adherence недели активного цикла, рекомендация.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  loadCardioLog, saveCardioLogEntry, removeCardioLogEntry,
  cardioLogStats, computeCardioAdvice, cardioWeekFact, estimateCardioEntryKcal,
  type CardioLogEntry,
} from '../../../engines/lms/cardio-diary.engine';
import { cardioWeekAdherence } from '../../../engines/lms/cardio-diary.engine';
import { cardioWeightAdvice, cardioWeekForDate, cardioCoachHints, type CardioCycle, type CardioType, type CardioCoachHint } from '../../../engines/lms/cardio.engine';
import { getWeightLog } from '../../../engines/profile-store';
import { CARD, ROW, LABEL, BTN, BTN_PRIMARY, INPUT, CHIP, CHIP_ACTIVE } from './CardioUI';

const TYPES: CardioType[] = ['zone2', 'miss', 'hiit', 'recovery'];
const TYPE_LABEL: Record<CardioType, string> = { zone2: 'Zone 2', hiit: 'HIIT', miss: 'MISS', recovery: 'Recovery' };
const ADVICE_COLOR: Record<string, string> = { reduce: '#f87171', keep: '#22c55e', increase: '#3b82f6' };
const HINT_COLOR: Record<string, string> = { test: '#4ade80', deload: '#fbbf24', taper: '#eab308', peak: '#f87171' };
const HINT_ICON: Record<string, string> = { test: '🔬', deload: '🧘', taper: '📉', peak: '🎭' };

function newId(): string {
  return 'c-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const CardioDiaryPanel: React.FC<{ cycle: CardioCycle | null; acwr?: number | null; recoveryLow?: boolean; onApplyWeightAdjust?: () => void }> = ({ cycle, acwr, recoveryLow, onApplyWeightAdjust }) => {
  const [log, setLog] = useState<CardioLogEntry[]>(() => loadCardioLog());
  const [date, setDate] = useState(todayIso());
  const [type, setType] = useState<CardioType>('zone2');
  const [minutes, setMinutes] = useState('30');
  const [rpe, setRpe] = useState('');
  const [hr, setHr] = useState('');
  const [kcal, setKcal] = useState('');
  const [km, setKm] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const flashMsg = (m: string) => { setFlash(m); window.setTimeout(() => setFlash(null), 3000); };

  // Загрузить запись в форму для редактирования (та же id — save заменяет).
  const startEdit = (e: CardioLogEntry) => {
    setEditingId(e.id);
    setDate(e.date);
    setType(e.type);
    setMinutes(String(e.durationMin));
    setRpe(e.rpe != null ? String(e.rpe) : '');
    setHr(e.avgHr != null ? String(e.avgHr) : '');
    setKcal(e.calories != null ? String(e.calories) : '');
    setKm(e.distanceKm != null ? String(e.distanceKm) : '');
  };

  // Последний вес из журнала для оценки ккал (fallback — 80 кг).
  const lastWeight = useMemo<number | null>(() => {
    try {
      const weights = getWeightLog();
      const sorted = Array.isArray(weights) ? [...weights].filter(e => Number.isFinite(e.weight)).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
      return sorted.length > 0 ? sorted[0].weight : null;
    } catch { return null; }
  }, [log]);

  const stats7 = useMemo(() => cardioLogStats(log, 7), [log]);
  const stats28 = useMemo(() => cardioLogStats(log, 28), [log]);
  const advice = useMemo(() => computeCardioAdvice(cycle, log, { acwr, recoveryLow }), [log, cycle, acwr, recoveryLow]);
  const adherence = useMemo(() => {
    if (!cycle) return null;
    // Текущая неделя по дате (неделя 1 = cycle.startDate); фоллбек — неделя 1.
    const weekForDate = cardioWeekForDate(cycle, todayIso(), cycle.startDate);
    const currentWeek = weekForDate ? weekForDate.week : 1;
    return cardioWeekAdherence(cycle, Math.min(currentWeek, cycle.totalWeeks), log, cycle.startDate);
  }, [log, cycle]);
  // Тренерская подсказка текущей недели (замер/делод/taper/пик).
  const weekHint = useMemo<CardioCoachHint | null>(() => {
    if (!cycle) return null;
    const weekForDate = cardioWeekForDate(cycle, todayIso(), cycle.startDate);
    const currentWeek = Math.min(weekForDate ? weekForDate.week : 1, cycle.totalWeeks);
    return cardioCoachHints(cycle).find(h => h.week === currentWeek && h.kind !== 'work') ?? null;
  }, [cycle]);
  // Выполнение цикла в целом: прошедшие недели (сессии/минуты), до текущей.
  const cycleStats = useMemo(() => {
    if (!cycle) return null;
    const weekForDate = cardioWeekForDate(cycle, todayIso(), cycle.startDate);
    const currentWeek = Math.min(weekForDate ? weekForDate.week : 1, cycle.totalWeeks);
    const pastWeeks = cycle.weeks.filter(w => w.week < currentWeek);
    if (pastWeeks.length === 0) return null;
    const planned = pastWeeks.reduce((s, w) => s + w.sessions.reduce((a, x) => a + x.weeklyFrequency, 0), 0);
    const plannedMin = pastWeeks.reduce((s, w) => s + w.totalMinutes, 0);
    const doneSessions = pastWeeks.reduce((s, w) => s + cardioWeekAdherence(cycle, w.week, log, cycle.startDate).doneSessions, 0);
    const doneMin = pastWeeks.reduce((s, w) => s + cardioWeekFact(cycle, w.week, log, cycle.startDate).doneMinutes, 0);
    return {
      planned, plannedMin, doneSessions, doneMin,
      pctSessions: planned > 0 ? Math.round((doneSessions / planned) * 100) : null,
      pctMinutes: plannedMin > 0 ? Math.round((doneMin / plannedMin) * 100) : null,
      weeksDone: pastWeeks.length,
    };
  }, [cycle, log]);

  const add = () => {
    const dur = Math.max(5, Math.min(180, Number(minutes) || 30));
    const entry: CardioLogEntry = {
      id: editingId ?? newId(), date, type, durationMin: dur, completed: true,
      rpe: Number(rpe) > 0 ? Number(rpe) : undefined,
      avgHr: Number(hr) > 0 ? Number(hr) : undefined,
      calories: Number(kcal) > 0 ? Number(kcal) : estimateCardioEntryKcal(type, dur, lastWeight ?? undefined),
      distanceKm: Number(km) > 0 ? Math.round(Number(km) * 10) / 10 : undefined,
    };
    const next = saveCardioLogEntry(entry);
    setLog(next);
    setKcal('');
    setKm('');
    setEditingId(null);
    flashMsg(editingId ? '✏️ Сессия обновлена' : '💾 Сессия записана');
  };

  return (
    <div style={CARD}>
      <div style={LABEL}>📓 Дневник выполнения кардио</div>
      {flash && <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }} role="status">{flash}</div>}

      <div style={ROW}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={INPUT} aria-label="Дата" />
        {TYPES.map(t => (
          <button key={t} style={type === t ? CHIP_ACTIVE : CHIP} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
        ))}
      </div>
      {editingId && <div style={{ fontSize: 11, color: '#fbbf24' }}>✏️ Редактирование записи — сохраните или нажмите ✕ на строке, чтобы отменить.</div>}
      <div style={ROW}>
        <input value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Мин" inputMode="numeric" style={{ ...INPUT, width: 70 }} aria-label="Минуты" />
        <input value={rpe} onChange={e => setRpe(e.target.value)} placeholder="RPE 1-10" inputMode="numeric" style={{ ...INPUT, width: 80 }} aria-label="RPE" />
        <input value={hr} onChange={e => setHr(e.target.value)} placeholder="ЧСС" inputMode="numeric" style={{ ...INPUT, width: 70 }} aria-label="ЧСС" />
        <input value={kcal} onChange={e => setKcal(e.target.value)} placeholder="ккал (авто)" inputMode="numeric" style={{ ...INPUT, width: 90 }} aria-label="Ккал" title="Оставьте пустым — ккал рассчитаются по весу и типу сессии" />
        <input value={km} onChange={e => setKm(e.target.value)} placeholder="км" inputMode="decimal" style={{ ...INPUT, width: 60 }} aria-label="Км" title="Дистанция (для бега/езды)" />
        <button style={BTN_PRIMARY} onClick={add}>{editingId ? '💾 Обновить' : '+ Записать'}</button>
      </div>

      {adherence && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Неделя {adherence.week}: выполнено {adherence.doneSessions}/{adherence.plannedSessions} сессий · {adherence.doneMinutes}/{adherence.plannedMinutes} мин ({adherence.pctMinutes}%)
        </div>
      )}
      {weekHint && (
        <div style={{ fontSize: 11, color: HINT_COLOR[weekHint.kind] ?? 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px' }}>
          {HINT_ICON[weekHint.kind] ?? '💡'} {weekHint.text}
        </div>
      )}
      {cycleStats && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '6px 8px' }}>
          📊 Цикл: {cycleStats.weeksDone} пройденных нед · сессий {cycleStats.doneSessions}/{cycleStats.planned} ({cycleStats.pctSessions ?? 0}%) · минут {cycleStats.doneMin}/{cycleStats.plannedMin} ({cycleStats.pctMinutes ?? 0}%)
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        7д: {stats7.sessions} сессий · {stats7.minutes} мин{stats7.km > 0 ? ` · ${stats7.km} км` : ''}{stats7.kcal > 0 ? ` · ${stats7.kcal} ккал` : ''}{stats7.avgRpe != null ? ` · RPE ${stats7.avgRpe}` : ''}
        {stats7.avgHr != null ? ` · ЧСС ${stats7.avgHr}` : ''}
        {' '}· 28д: {stats28.sessions} сессий · {stats28.minutes} мин{stats28.km > 0 ? ` · ${stats28.km} км` : ''}{stats28.kcal > 0 ? ` · ${stats28.kcal} ккал` : ''}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: ADVICE_COLOR[advice.action] }}>
        {advice.action === 'reduce' ? '▼ Снизить' : advice.action === 'increase' ? '▲ Увеличить' : '▶ Продолжать'}: {advice.reason}
      </div>
      {(() => {
        if (!cycle || (cycle.goal !== 'cut' && cycle.goal !== 'recomp' && cycle.goal !== 'bb_prep')) return null;
        try {
          const w = getWeightLog();
          if (!Array.isArray(w) || w.length === 0) return null;
          const wa = cardioWeightAdvice(w, cycle);
          if (wa.action !== 'increase') return null;
          return (
            <div style={{ fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
              <div>⚖️ {wa.reason}</div>
              {onApplyWeightAdjust && (
                <button style={{ ...BTN, minHeight: 32, padding: '5px 10px', alignSelf: 'flex-start' }} onClick={onApplyWeightAdjust} aria-label="Применить +15 мин Zone 2">
                  ⚖️ Применить (+15 мин Zone 2)
                </button>
              )}
            </div>
          );
        } catch { return null; }
      })()}

      {log.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(showAll ? log : log.slice(0, 6)).map(e => (
            <div key={e.id} style={ROW}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 84 }}>{e.date}</span>
              <span style={{ fontSize: 11, minWidth: 60 }}>{TYPE_LABEL[e.type]}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 60 }}>{e.durationMin} мин</span>
              {e.rpe != null && <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 40 }}>RPE {e.rpe}</span>}
              {e.avgHr != null && <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 50 }}>{e.avgHr} уд</span>}
              {e.calories != null && e.calories > 0 && <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 50 }}>{e.calories} ккал</span>}
              {e.distanceKm != null && e.distanceKm > 0 && <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 50 }}>{e.distanceKm} км</span>}
              <button style={{ ...BTN, minHeight: 28, padding: '4px 8px' }} onClick={() => startEdit(e)} aria-label={`Редактировать ${e.date}`} title="Редактировать">✎</button>
              <button style={{ ...BTN, minHeight: 28, padding: '4px 8px' }} onClick={() => { if (editingId === e.id) setEditingId(null); setLog(removeCardioLogEntry(e.id)); }} aria-label={`Удалить ${e.date}`}>✕</button>
            </div>
          ))}
          {log.length > 6 && (
            <button style={{ ...BTN, minHeight: 30, padding: '5px 10px', alignSelf: 'flex-start' }} onClick={() => setShowAll(v => !v)} aria-label={showAll ? 'Скрыть записи' : `Показать все записи (${log.length})`}>
              {showAll ? '▴ Скрыть' : `▾ Показать все (${log.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
