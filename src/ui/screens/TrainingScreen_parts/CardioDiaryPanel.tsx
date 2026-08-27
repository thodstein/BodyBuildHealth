/**
 * CardioDiaryPanel.tsx — дневник выполнения кардио: запись сессии,
 * статистика 7/28 дней, adherence недели активного цикла, рекомендация.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  loadCardioLog, saveCardioLogEntry, removeCardioLogEntry, replaceCardioLog,
  cardioLogStats, computeCardioAdvice, cardioWeekFact, estimateCardioEntryKcal,
  cardioPaceMinPerKm, validateCardioLogFields, clampCardioLogNumber,
  saveCardioWellness, loadCardioWellness, wellnessReadiness,
  type CardioLogEntry, type CardioLogFieldWarnings,
} from '../../../engines/lms/cardio-diary.engine';
import { cardioWeekAdherence } from '../../../engines/lms/cardio-diary.engine';
import { cardioWeightAdvice, cardioWeekForDate, cardioCoachHints, type CardioCycle, type CardioType, type CardioCoachHint } from '../../../engines/lms/cardio.engine';
import { getWeightLog } from '../../../engines/profile-store';
import { CARD, ROW, LABEL, HINT_SM, BTN, BTN_PRIMARY, BTN_SMALL, INPUT, CHIP, CHIP_ACTIVE, Badge, TYPE_COLOR } from './CardioUI';

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

export const CardioDiaryPanel: React.FC<{ cycle: CardioCycle | null; acwr?: number | null; recoveryLow?: boolean; onApplyWeightAdjust?: () => void; log?: CardioLogEntry[]; onLogChanged?: () => void }> = ({ cycle, acwr, recoveryLow, onApplyWeightAdjust, log: logProp, onLogChanged }) => {
  const [internalLog, setInternalLog] = useState<CardioLogEntry[]>(() => loadCardioLog());
  // Управляемый режим: родитель (CardioDiaryStep) передаёт журнал и уведомляется
  // об изменениях — виджеты синхронизированы после сохранения в таймере.
  const log = logProp ?? internalLog;
  const commitLog = useCallback((next: CardioLogEntry[]) => {
    if (onLogChanged) { onLogChanged(); } else { setInternalLog(next); }
  }, [onLogChanged]);
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
  const [warnings, setWarnings] = useState<CardioLogFieldWarnings | null>(null);
  // Undo: снимок журнала до последней операции (добавление/обновление/удаление).
  const [undoPrev, setUndoPrev] = useState<CardioLogEntry[] | null>(null);
  const [wellness, setWellness] = useState(() => {
    const w = loadCardioWellness().find(x => x.date === todayIso());
    return w ?? { sleep: 3, stress: 3, soreness: 3, mood: 3 };
  });

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
  const streak = useMemo(() => {
    const dates = Array.from(new Set(log.filter(e => e.completed).map(e => e.date))).sort();
    if (dates.length === 0) return { current: 0, best: 0 };
    let best = 1, cur = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]).getTime();
      const curD = new Date(dates[i]).getTime();
      const diff = Math.round((curD - prev) / 86400000);
      if (diff === 1) cur++;
      else { best = Math.max(best, cur); cur = 1; }
    }
    best = Math.max(best, cur);
    // current streak: from today backwards
    const today = todayIso();
    let curStreak = 0;
    let d = new Date(today);
    const set = new Set(dates);
    for (let i = 0; i < 30; i++) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (set.has(iso)) curStreak++;
      else if (i === 0) { /* today not done yet, check yesterday */ }
      else break;
      d.setDate(d.getDate() - 1);
      if (i === 0 && curStreak === 0) continue;
      if (!set.has(iso) && curStreak > 0) break;
    }
    // simpler current: consecutive from latest date backwards
    if (dates.length > 0) {
      let c = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        const diff = Math.round((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
        if (diff === 1) c++; else break;
      }
      // if latest date not today, streak is c but may be broken
      const latest = dates[dates.length - 1];
      const diffToday = Math.round((new Date(today).getTime() - new Date(latest).getTime()) / 86400000);
      if (diffToday > 1) curStreak = 0;
      else curStreak = c;
    }
    return { current: curStreak, best };
  }, [log]);
  const shareWeek = () => {
    const txt = `Кардио 7д: ${stats7.sessions} сесс · ${stats7.minutes} мин${stats7.km > 0 ? ` · ${stats7.km} км` : ''}${stats7.avgPace ? ` · ${stats7.avgPace}` : ''} · стрик ${streak.current}д (лучший ${streak.best}д)`;
    try { navigator.clipboard.writeText(txt).then(() => flashMsg('📋 Недельный отчет скопирован')).catch(() => flashMsg(txt)); } catch { flashMsg(txt); }
  };
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
    const w = validateCardioLogFields({ rpe, hr, km, minutes });
    if (w.rpe || w.hr || w.km || w.minutes) {
      setWarnings(w);
      flashMsg('⚠ Проверьте значения: ' + [w.rpe, w.hr, w.km, w.minutes].filter(Boolean).join('; '));
      return;
    }
    setWarnings(null);
    const dur = clampCardioLogNumber(minutes, 5, 180, 30);
    const entry: CardioLogEntry = {
      id: editingId ?? newId(), date, type, durationMin: dur, completed: true,
      rpe: Number(rpe) > 0 ? Number(rpe) : undefined,
      avgHr: Number(hr) > 0 ? Number(hr) : undefined,
      calories: Number(kcal) > 0 ? Number(kcal) : estimateCardioEntryKcal(type, dur, lastWeight ?? undefined),
      distanceKm: Number(km) > 0 ? Math.round(Number(km) * 10) / 10 : undefined,
    };
    const next = saveCardioLogEntry(entry);
    setUndoPrev(log);
    commitLog(next);
    setKcal('');
    setKm('');
    setEditingId(null);
    flashMsg(editingId ? '✏️ Сессия обновлена' : '💾 Сессия записана');
  };

  const csvEscape = (v: unknown) => {
    const s = String(v ?? '');
    return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    const head = 'Дата,Тип,Минуты,Км,Темп,Ккал,ЧСС,RPE,Завершено\n';
    const body = log.map(e =>
      [e.date, TYPE_LABEL[e.type], e.durationMin, e.distanceKm ?? '', cardioPaceMinPerKm(e.distanceKm, e.durationMin) ?? '', e.calories ?? '', e.avgHr ?? '', e.rpe ?? '', e.completed ? 'да' : 'нет'].map(csvEscape).join(','),
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + head + body], { type: 'text/csv' }));
    a.download = `cardio-log-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    flashMsg('📥 CSV экспортирован');
  };

  const exportJson = () => {
    const data = JSON.stringify(log, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `cardio-log-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    flashMsg('📥 JSON экспортирован');
  };

  return (
    <div style={CARD}>
      <div style={ROW}>
        <span style={LABEL}>📓 Дневник выполнения кардио</span>
        <Badge bg={streak.current >= 3 ? 'rgba(0,230,138,0.14)' : 'rgba(255,255,255,0.06)'} border={streak.current >= 3 ? 'rgba(0,230,138,0.28)' : 'rgba(255,255,255,0.08)'} color={streak.current >= 3 ? '#4ade80' : '#fff'}>🔥 стрик {streak.current}д</Badge>
        <button style={BTN_SMALL} onClick={exportCsv} title="Экспорт в CSV">📥 CSV</button>
        <button style={BTN_SMALL} onClick={exportJson} title="Экспорт в JSON">📥 JSON</button>
        {undoPrev && (
          <button style={{ ...BTN, minHeight: 30, padding: '4px 10px', fontSize: 10 }} onClick={() => { const restored = replaceCardioLog(undoPrev); commitLog(restored); setUndoPrev(null); flashMsg('↩ Отменено'); }} aria-label="Отменить последнее изменение">↩ Отменить</button>
        )}
      </div>
      {flash && <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }} role="status">{flash}</div>}

      <div style={ROW}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={INPUT} aria-label="Дата" />
        {TYPES.map(t => (
          <button key={t} style={type === t ? CHIP_ACTIVE : CHIP} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
        ))}
      </div>
      {editingId && <div style={{ fontSize: 11, color: '#fbbf24' }}>✏️ Редактирование записи — сохраните или нажмите ✕ на строке, чтобы отменить.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px,1fr))', gap: 6 }}>
        <input value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="Мин" inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="Минуты" />
        <input value={rpe} onChange={e => setRpe(e.target.value)} placeholder="RPE 1-10" inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="RPE" />
        <input value={hr} onChange={e => setHr(e.target.value)} placeholder="ЧСС" inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="ЧСС" />
        <input value={kcal} onChange={e => setKcal(e.target.value)} placeholder="ккал (авто)" inputMode="numeric" style={{ ...INPUT, width: 'auto' }} aria-label="Ккал" title="Оставьте пустым — ккал рассчитаются по весу и типу сессии" />
        <input value={km} onChange={e => setKm(e.target.value)} placeholder="км" inputMode="decimal" style={{ ...INPUT, width: 'auto' }} aria-label="Км" title="Дистанция (для бега/езды)" />
        <button style={{ ...BTN_PRIMARY, minHeight: 44 }} onClick={add}>{editingId ? '💾 Обновить' : '+ Записать'}</button>
        <button style={{ ...BTN, minHeight: 44 }} onClick={() => { setMinutes('30'); setRpe(''); setHr(''); setKcal(''); setKm(''); setEditingId(null); setWarnings(null); }} aria-label="Сбросить форму">✕ Сбросить</button>
      </div>
      {warnings && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 8px' }} role="alert">
          ⚠ {[warnings.rpe, warnings.hr, warnings.km, warnings.minutes].filter(Boolean).join(' · ')}
        </div>
      )}

      {adherence && (
        <div style={{ fontSize: 11, color: '#fff' }}>
          Неделя {adherence.week}: выполнено {adherence.doneSessions}/{adherence.plannedSessions} сессий · {adherence.doneMinutes}/{adherence.plannedMinutes} мин ({adherence.pctMinutes}%)
        </div>
      )}
      {weekHint && (
        <div style={{ fontSize: 11, color: HINT_COLOR[weekHint.kind] ?? '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 8px' }}>
          {HINT_ICON[weekHint.kind] ?? '💡'} {weekHint.text}
        </div>
      )}
      {cycleStats && (
        <div style={{ fontSize: 11, color: '#fff', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '6px 8px' }}>
          📊 Цикл: {cycleStats.weeksDone} пройденных нед · сессий {cycleStats.doneSessions}/{cycleStats.planned} ({cycleStats.pctSessions ?? 0}%) · минут {cycleStats.doneMin}/{cycleStats.plannedMin} ({cycleStats.pctMinutes ?? 0}%)
        </div>
      )}
      <div style={{ fontSize: 11, color: '#fff' }}>
        7д: {stats7.sessions} сессий · {stats7.minutes} мин{stats7.km > 0 ? ` · ${stats7.km} км` : ''}{stats7.avgPace ? ` · ${stats7.avgPace}` : ''}{stats7.kcal > 0 ? ` · ${stats7.kcal} ккал` : ''}{stats7.avgRpe != null ? ` · RPE ${stats7.avgRpe}` : ''}
        {stats7.avgHr != null ? ` · ЧСС ${stats7.avgHr}` : ''}
        {' '}· 28д: {stats28.sessions} сессий · {stats28.minutes} мин{stats28.km > 0 ? ` · ${stats28.km} км` : ''}{stats28.avgPace ? ` · ${stats28.avgPace}` : ''}{stats28.kcal > 0 ? ` · ${stats28.kcal} ккал` : ''}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10 }}>
        <div style={LABEL}>🧘 Wellness (POMS) — готовность {wellnessReadiness(wellness)}/10</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px,1fr))', gap: 6 }}>
          {[
            { k: 'sleep' as const, label: 'Сон 1-5' },
            { k: 'stress' as const, label: 'Стресс 1-5' },
            { k: 'soreness' as const, label: 'Боль 1-5' },
            { k: 'mood' as const, label: 'Настроение 1-5' },
          ].map(f => (
            <div key={f.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 10, color: '#fff' }}>{f.label}</span>
              <div style={ROW}>
                <button style={BTN_SMALL} onClick={() => setWellness(v => ({ ...v, [f.k]: Math.max(1, (v as unknown as Record<string, number>)[f.k] - 1) }))}>−</button>
                <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{(wellness as unknown as Record<string, number>)[f.k]}</span>
                <button style={BTN_SMALL} onClick={() => setWellness(v => ({ ...v, [f.k]: Math.min(5, (v as unknown as Record<string, number>)[f.k] + 1) }))}>+</button>
              </div>
            </div>
          ))}
        </div>
        <button
          style={{ ...BTN_SMALL, alignSelf: 'flex-start' }}
          onClick={() => {
            const entry = { date: todayIso(), ...wellness, readiness: wellnessReadiness(wellness) };
            saveCardioWellness(entry as unknown as Parameters<typeof saveCardioWellness>[0]);
            flashMsg(`🧘 Wellness сохранён — готовность ${entry.readiness}/10`);
          }}
        >
          💾 Сохранить wellness
        </button>
        <div style={HINT_SM}>1=плохо, 5=отлично. Готовность влияет на автотюн (как в diary-autoreg).</div>
      </div>

      {log.length === 0 && (
        <div style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 10px' }}>
          📭 Записей пока нет — заполните форму выше и нажмите «+ Записать», чтобы вести журнал кардио.
        </div>
      )}
      {log.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(showAll ? log : log.slice(0, 6)).map(e => (
            <div key={e.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', minWidth: 78, fontWeight: 700 }}>{e.date}</span>
              <span style={{ fontSize: 11, minWidth: 64, fontWeight: 800, color: TYPE_COLOR[e.type] ?? '#fff', background: `${TYPE_COLOR[e.type] ?? '#fff'}14`, border: `1px solid ${TYPE_COLOR[e.type] ?? '#fff'}28`, borderRadius: 20, padding: '2px 8px', textAlign: 'center' }}>{TYPE_LABEL[e.type]}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1, alignItems: 'center' }}>
                {e.completed === false
                  ? <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>⏭ пропущена</span>
                  : <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{e.durationMin} мин</span>}
                {e.completed !== false && e.rpe != null && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>RPE {e.rpe}</span>}
                {e.completed !== false && e.avgHr != null && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{e.avgHr} уд</span>}
                {e.completed !== false && e.calories != null && e.calories > 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{e.calories} ккал</span>}
                {e.completed !== false && e.distanceKm != null && e.distanceKm > 0 && (
                  <>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>{e.distanceKm} км</span>
                    <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>{cardioPaceMinPerKm(e.distanceKm, e.durationMin)}</span>
                  </>
                )}
              </span>
              <button style={{ ...BTN, minHeight: 36, padding: '6px 10px' }} onClick={() => startEdit(e)} aria-label={`Редактировать ${e.date}`} title="Редактировать">✎</button>
              <button style={{ ...BTN, minHeight: 36, padding: '6px 10px' }} onClick={() => { if (editingId === e.id) setEditingId(null); setUndoPrev(log); commitLog(removeCardioLogEntry(e.id)); }} aria-label={`Удалить ${e.date}`}>✕</button>
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
