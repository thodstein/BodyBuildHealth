import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  generateTrainingCalendar,
  buildPlannedMapFromBridgeSessions,
  buildActualMapFromWorkoutLogs,
  getMesocycleOverview,
  DAY_NAMES_RU,
  MONTH_NAMES_RU,
  type CalendarDay,
  getWaterStats, quickAddWater, type WaterStats,
  exportWorkoutsToCSV, exportToJSON,
} from '../../../engines/training-calendar.engine';
import { StrengthDiary } from '../../../engines/strength-diary.engine';
import type { WorkoutLog } from '../../../core/types';
import { localIsoDate } from './diary-shared';
import { onPlRuntimeSaved } from '../../../core/pl-runtime-events';
import { planDatesForIndexes } from '../../../engines/training-day.engine';
import { getProfile } from '../../../core/profile-manager';
import { onAnyProfileChangeCrossTab } from '../../../core/profile-events';
import { saveCsvApk, saveTextFileApk } from '../../../core/apk-share';

const ACCENT = '#00e68a';
const DIM = '#fff';
const CARD: React.CSSProperties = { padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 };

const STATUS_COLORS: Record<string, string> = {
  done: '#00e68a',
  partial: '#f59e0b',
  missed: '#ef4444',
  rest: 'rgba(255,255,255,0.12)',
  planned: '#3b82f6',
  none: 'rgba(255,255,255,0.03)',
};

const STATUS_BG: Record<string, string> = {
  done: 'rgba(0,230,138,0.12)',
  partial: 'rgba(245,158,11,0.12)',
  missed: 'rgba(239,68,68,0.12)',
  rest: 'rgba(255,255,255,0.03)',
  planned: 'rgba(59,130,246,0.12)',
  none: 'rgba(255,255,255,0.02)',
};

const btnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#fff', padding: '6px 10px', cursor: 'pointer', fontSize: 13, lineHeight: 1 };

const STATUS_LABELS: Record<string, string> = {
  done: 'Выполнено',
  partial: 'Частично',
  missed: 'Пропущено',
  rest: 'Отдых',
  planned: 'Запланировано',
  none: '',
};

const MANUAL_FLAG_KEY = 'he_cal_manual';

/** Ручные отметки дат из localStorage (Set ISO-дат). */
export function readManualFlags(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MANUAL_FLAG_KEY) || '[]'));
  } catch {
    return new Set<string>();
  }
}

/** Виртуальный лог ручной отметки (пустая тренировка-маркер для календаря). */
export function manualVirtualLog(date: string): WorkoutLog {
  return { id: 'cal_man_' + date, date, exercises: [], duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'manual' } as WorkoutLog;
}

/** ISO-дата (YYYY-MM-DD) или null: произвольную строку датой не считаем. */
function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const iso = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/**
 * Честная дата дня плана: явная ISO-дата важнее расчёта `startDate + dayOfWeek`
 * (0=Пн…6=Вс). Если ни даты, ни старта с днём недели нет — null: дата по индексу
 * массива ставила бы план на 1/2/3-е число, и календарь объявлял бы эти дни
 * пропущенными, хотя тренировки были в другие даты.
 */
function resolvePlannedDate(day: any, startDate?: unknown): string | null {
  const explicit = isoDateOrNull(day?.date);
  if (explicit) return explicit;
  const start = isoDateOrNull(startDate ?? day?.startDate);
  const rawDow = day?.dayOfWeek;
  const dow = Number(rawDow);
  if (!start || rawDow == null || !Number.isInteger(dow) || dow < 0 || dow > 6) return null;
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + dow);
  return localIsoDate(d);
}

/** Объём и число подходов дня плана — только из реальных targetSets, без «3000/15». */
function summarizeTargetSets(exercises: unknown): { totalVolume: number; totalSets: number } {
  const list = Array.isArray(exercises) ? exercises : [];
  let totalVolume = 0;
  let totalSets = 0;
  for (const exercise of list as any[]) {
    const sets = Array.isArray(exercise?.targetSets)
      ? exercise.targetSets
      : Array.isArray(exercise?.sets)
        ? exercise.sets
        : [];
    for (const set of sets as any[]) {
      totalVolume += (Number(set?.weight ?? set?.weightKg) || 0) * (Number(set?.reps) || 0);
      totalSets += 1;
    }
  }
  return { totalVolume, totalSets };
}

export function runtimeDaysToBridgeSessions(runtime: any, year: number, month: number) {
  if (!runtime || !Array.isArray(runtime.days) || runtime.days.length === 0) return null;
  const startWeek = Number(runtime.week) > 0 ? Number(runtime.week) : 1;
  // Якорь плана: N-й день — N-й тренировочный день от `startDate` по графику
  // профиля. Индекс берём по исходному массиву runtime.days (его не фильтруем).
  let anchoredDates: string[] | null = null;
  try {
    const training = (getProfile() as any)?.settings?.training;
    anchoredDates = planDatesForIndexes({ planDays: runtime.days.length, startDate: runtime.startDate, training });
  } catch { anchoredDates = null; }
  const sessions: any[] = [];
  runtime.days.forEach((day: any, index: number) => {
    // День без выводимой даты пропускаем: показать план на выдуманном числе и
    // пометить его «пропущено» хуже, чем не показать день вовсе.
    // Явная дата дня → дата по якорю (`startDate` + график профиля) → и
    // только потом `startDate + dayOfWeek`. Раньше `dayOfWeek` перебивал
    // якорь: после смены графика план оставался на старых днях недели,
    // хотя плеер и виджет уже считали даты от якоря.
    const date = isoDateOrNull(day?.date) ?? anchoredDates?.[index] ?? resolvePlannedDate(day, runtime.startDate) ?? null;
    if (!date) return;
    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    const bridgeExercises = exercises.map((exercise: any, exerciseIndex: number) => {
      const sets = Array.isArray(exercise.targetSets) ? exercise.targetSets : [];
      const bridgeSets = sets.map((set: any, setIndex: number) => {
        // Плановый подход без RIR не получает выдуманных «RIR 0 / RPE 10»:
        // раньше `Number(undefined) || 0` писал «до отказа» там, где плана не было.
        const rirNum = Number(set?.rir);
        const hasRir = set?.rir != null && set.rir !== '' && Number.isFinite(rirNum);
        // RPE выводится как 10 − RIR, поэтому RIR живёт в тех же границах 0…10:
        // раньше клэмпился только RPE и `rir: 15` давал пару `{ rir: 15, rpe: 0 }` —
        // «до отказа» рядом с RIR 15 в одном подходе.
        const rirClamped = hasRir ? Math.max(0, Math.min(10, Math.round(rirNum))) : null;
        return {
          setNumber: setIndex + 1,
          weightKg: Number(set.weight) || 0,
          reps: Number(set.reps) || 0,
          rpe: rirClamped == null ? undefined : Math.max(0, Math.min(10, 10 - rirClamped)),
          rir: rirClamped ?? undefined,
          isPR: false,
          notes: '',
          plannedWeight: set.weight == null || !Number.isFinite(Number(set.weight)) ? undefined : Number(set.weight),
          plannedReps: set.reps == null || !Number.isFinite(Number(set.reps)) ? undefined : Number(set.reps),
          plannedRir: rirClamped ?? undefined,
        };
      });
      return {
        exerciseId: `runtime-${index}-${exerciseIndex}`,
        exerciseName: exercise.name || 'Упражнение',
        pattern: exercise.muscleGroup || '',
        muscleGroup: exercise.muscleGroup || '',
        order: exerciseIndex + 1,
        sets: bridgeSets,
        totalVolume: bridgeSets.reduce((sum: number, set: any) => sum + set.weightKg * set.reps, 0),
        best1RM: 0,
        avgRPE: 0,
      };
    });
    const track = String(runtime.track || '').toLowerCase();
    const source = track === 'bb' ? 'BB' : track === 'arm' || track === 'armlifting' ? 'ARM' : 'SRC';
    const sessionId = `runtime-${index}`;
    sessions.push({
      sessionId,
      date,
      focus: day.label || runtime.focus || 'Тренировка',
      exercises: bridgeExercises,
      totalVolume: bridgeExercises.reduce((sum: number, exercise: any) => sum + exercise.totalVolume, 0),
      totalSets: bridgeExercises.reduce((sum: number, exercise: any) => sum + exercise.sets.length, 0),
      totalReps: bridgeExercises.reduce((sum: number, exercise: any) => sum + exercise.sets.reduce((inner: number, set: any) => inner + set.reps, 0), 0),
      weekNumber: startWeek,
      planned: true,
      source,
      provenanceSource: source,
      plannedSessionId: sessionId,
      duration: typeof day.durationMin === 'number' ? day.durationMin : undefined,
    });
  });
  return sessions;
}

/**
 * Сессии плана из массива: дата — явная или startDate+dayOfWeek, иначе день
 * пропускается; объём и подходы — реальные суммы targetSets, а не «3000/15».
 */
export function plannedEntriesToBridgeSessions(entries: any[]) {
  if (!Array.isArray(entries)) return [];
  const sessions: any[] = [];
  for (const entry of entries) {
    const date = resolvePlannedDate(entry, entry?.startDate);
    if (!date) continue;
    const exercises = Array.isArray(entry?.exercises) ? entry.exercises : [];
    const summary = summarizeTargetSets(exercises);
    sessions.push({
      ...entry,
      date,
      focus: entry?.focus || 'Тренировка',
      exercises: exercises.map((exercise: any) => ({
        ...exercise,
        exerciseName: exercise?.exerciseName || exercise?.name || 'Упражнение',
      })),
      totalVolume: summary.totalVolume,
      totalSets: summary.totalSets,
    });
  }
  return sessions;
}

export const TrainingCalendarTab: React.FC = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<'month' | 'week' | 'meso'>('month');
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [historyWorkouts, setHistoryWorkouts] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [water, setWater] = useState<WaterStats>(() => getWaterStats());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  useEffect(() => {
    if (toast) {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 3000);
      return () => { if (toastTimer.current !== null) { window.clearTimeout(toastTimer.current); toastTimer.current = null; } };
    }
  }, [toast]);
  const refreshWater = useCallback((amt: number) => { quickAddWater(amt); setWater(getWaterStats()); }, []);
  // Экспорт журнала: `<a download>` в Capacitor WebView файл никуда не
  // сохраняет (см. core/apk-share.ts) — календарь оставался единственным
  // экраном тренировок с «веб-скачиванием», на native файл терялся молча.
  // Один путь на обе платформы: native — Documents + Share, web — скачивание.
  const saveFile = useCallback(async (filename: string, text: string, mime = 'text/plain') => {
    const res = mime.includes('csv') ? await saveCsvApk(filename, text) : await saveTextFileApk(filename, text, mime);
    if (res === 'failed') setToast('Не удалось сохранить файл');
  }, []);
  const [flaggedDates, setFlaggedDates] = useState<Set<string>>(() => readManualFlags());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const diary = new StrengthDiary();
        const logs = await diary.getWorkoutLogs();
        if (!cancelled) {
          // Ручные отметки переживают перезагрузку: мержим виртуалки сразу,
          // иначе загрузка затирала их до первого переключения флага.
          const flags = readManualFlags();
          const merged = [...logs];
          for (const d of flags) {
            if (!merged.some(w => w.date === d)) merged.push(manualVirtualLog(d));
          }
          setHistoryWorkouts(merged.reverse());
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  // План, перегенерированный в том же месяце, должен появиться без смены
  // месяца: слушаем запись `he_pl_runtime` — и событие своего окна, и
  // `storage` из другой вкладки (общий сигнал продюсеров плана).
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  useEffect(() => onPlRuntimeSaved(() => setRuntimeVersion(v => v + 1)), []);

  // Даты плана считаются по графику профиля (`settings.training`), но сам
  // `he_pl_runtime` при смене графика не перезаписывается: без подписки
  // календарь держал плановый слой на старых днях недели до перезагрузки.
  const [profileVersion, setProfileVersion] = useState(0);
  useEffect(() => onAnyProfileChangeCrossTab(() => setProfileVersion(v => v + 1)), []);

  const plannedData = useMemo(() => {
    try {
      const runtime = JSON.parse(localStorage.getItem('he_pl_runtime') || 'null');
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = new Date(year, month + 1, 0);
      const endStr = localIsoDate(endDate);
      if (Array.isArray(runtime) && runtime.length > 0) {
        return buildPlannedMapFromBridgeSessions(plannedEntriesToBridgeSessions(runtime), startStr, endStr);
      }
      const runtimeSessions = runtimeDaysToBridgeSessions(runtime, year, month);
      if (runtimeSessions?.length) {
        return buildPlannedMapFromBridgeSessions(runtimeSessions, startStr, endStr);
      }
    } catch { /* ignore */ }
    return null;
  }, [monthKey, runtimeVersion, profileVersion]);

  const actualMap = useMemo(() => {
    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = new Date(year, month + 1, 0);
    const endStr = localIsoDate(endDate);
    return buildActualMapFromWorkoutLogs(historyWorkouts, startStr, endStr);
  }, [monthKey, historyWorkouts]);

  const cal = useMemo(() => {
    // Только настоящий план: демо-план PPL выдавал себя за план пользователя и
    // помечал прошедшие дни «пропущено». Нет плана — пустой календарь без выдумок.
    const plannedMap = plannedData || new Map();
    return generateTrainingCalendar(year, month, plannedMap, actualMap);
  }, [monthKey, plannedData, actualMap]);

  // Даты с психо-чек-инами и мобильностью (бейджи на ячейках календаря)
  const mindDates = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem('he_mindset_checks') || '[]');
      return new Set((Array.isArray(list) ? list : []).filter((c: any) => typeof c?.date === 'string').map((c: any) => c.date.slice(0, 10)));
    } catch { return new Set<string>(); }
  }, [monthKey]);
  const mobDates = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem('he_mobility_checks') || '[]');
      return new Set((Array.isArray(list) ? list : []).filter((c: any) => typeof c?.date === 'string' && c.done).map((c: any) => c.date.slice(0, 10)));
    } catch { return new Set<string>(); }
  }, [monthKey]);
  // Даты с выполненной разминкой (бейдж 🔥 на ячейках календаря)
  const warmDates = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem('he_warmup_diary') || '[]');
      return new Set((Array.isArray(list) ? list : []).filter((e: any) => typeof e?.date === 'string' && e.done).map((e: any) => e.date.slice(0, 10)));
    } catch { return new Set<string>(); }
  }, [monthKey]);
  // Даты с выполненной заминкой (бейдж ❄️ на ячейках календаря)
  const coolDates = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem('he_cooldown_diary') || '[]');
      return new Set((Array.isArray(list) ? list : []).filter((e: any) => typeof e?.date === 'string' && e.done).map((e: any) => e.date.slice(0, 10)));
    } catch { return new Set<string>(); }
  }, [monthKey]);

  const weekSummaries = cal.weekSummaries || [];

  const navigateMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
    setSelectedWeek(0);
  };

  const goToday = useCallback(() => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setSelectedWeek(0);
    setView('month');
  }, []);

  const today = localIsoDate();

  const toggleManualDone = useCallback((date: string) => {
    setFlaggedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      localStorage.setItem(MANUAL_FLAG_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // После ручного флага обновляем historyWorkouts — добавляем виртуальный лог
  useEffect(() => {
    if (flaggedDates.size === 0) return;
    // Функциональный апдейт без чтения замыкания: дублей нет при любом порядке эффектов.
    setHistoryWorkouts(prev => {
      const extra = [...flaggedDates]
        .filter(d => !prev.some(w => w.date === d))
        .map(d => manualVirtualLog(d));
      return extra.length > 0 ? [...prev, ...extra] : prev;
    });
  }, [flaggedDates]);

  const totalDone = cal.weeks.flat().filter(d => d.status === 'done').length;
  const totalPartial = cal.weeks.flat().filter(d => d.status === 'partial').length;
  const totalMissed = cal.weeks.flat().filter(d => d.status === 'missed').length;
  const totalPlannedVol = cal.weeks.flat().reduce((s, d) => s + d.plannedVolume, 0);
  const totalActualVol = cal.weeks.flat().reduce((s, d) => s + d.actualVolume, 0);

  const formatVol = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;

  if (loading) {
    return <div className="train-calendar" style={{ padding: 20, color: DIM, textAlign: 'center' }}>Загрузка календаря...</div>;
  }

  return (
    <div className="train-calendar" style={{ maxWidth: 720, margin: '0 auto', padding: 12, color: '#fff' }}>
      {/* Водный баланс — вода из training-calendar.engine (ранее неиспользуемая) */}
      <div className="cal-water" style={{ padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12, display:'flex', flexDirection:'column', gap: 8 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>💧 Водный баланс</span>
          <span style={{ fontSize: 11, color: water.today.percentComplete >= 100 ? '#22c55e' : water.today.percentComplete >= 60 ? '#eab308' : '#ef4444', fontWeight: 700 }}>{water.today.percentComplete}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: Math.min(100, water.today.percentComplete) + '%', height: '100%', background: water.today.percentComplete >= 100 ? '#22c55e' : water.today.percentComplete >= 60 ? '#eab308' : '#ef4444', borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 10, color: DIM }}>{water.today.totalMl} / {water.today.goalMl} мл сегодня · нед.ср. {water.weekAvg} мл · серия {water.streak} дн. {water.trend>=0?'+':''}{water.trend}%</div>
        <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
          {[200, 300, 500].map(ml => <button key={ml} onClick={() => refreshWater(ml)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color: ACCENT, cursor:'pointer', fontSize:12, fontWeight:700 }}>+{ml} мл</button>)}
        </div>
      </div>
      {toast && (
        <div role="alert" style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {toast}
        </div>
      )}
      {/* Экспорт тренировок — ранее неиспользуемые exportWorkoutsToCSV/exportToJSON */}
      <div className="cal-export" style={{ padding: 14, borderRadius: 12, background: 'rgba(24,24,27,0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12, display:'flex', flexDirection:'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>📤 Экспорт тренировок</span>
        <div style={{ fontSize: 10, color: DIM }}>Сохранить журнал тренировок (he_workout_log_v2) в CSV/JSON для анализа или передачи тренеру.</div>
        <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
          <button data-act="export-csv" onClick={() => { void saveFile('workouts.csv', exportWorkoutsToCSV(), 'text/csv'); }} style={{ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(0,230,138,0.3)', background:'rgba(0,230,138,0.08)', color: ACCENT, cursor:'pointer', fontSize:12, fontWeight:700 }}>⬇ Экспорт CSV</button>
          <button data-act="export-json" onClick={() => { try { const raw = localStorage.getItem('he_workout_log_v2') || '[]'; const data = JSON.parse(raw); void saveFile('workouts.json', exportToJSON(data), 'application/json'); } catch { setToast('Ошибка чтения журнала тренировок'); } }} style={{ padding:'10px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.05)', color: '#fff', cursor:'pointer', fontSize:12, fontWeight:700 }}>⬇ Экспорт JSON</button>
        </div>
      </div>
      {/* Header */}
      <div className="cal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => navigateMonth(-1)} style={btnStyle}>◀</button>
          <span style={{ fontSize: 16, fontWeight: 700, margin: '0 8px', color: ACCENT, whiteSpace: 'nowrap' }}>{MONTH_NAMES_RU[month]} {year}</span>
          <button onClick={() => navigateMonth(1)} style={btnStyle}>▶</button>
          <button onClick={goToday} style={{ ...btnStyle, marginLeft: 4, background: 'rgba(0,230,138,0.08)', borderColor: 'rgba(0,230,138,0.3)', color: ACCENT, fontSize: 10 }}>Сегодня</button>
        </div>
        <div className="cal-view" style={{ display: 'flex', gap: 4 }}>
          {(['month', 'week', 'meso'] as const).map(v => (
            <button key={v} onClick={() => { setView(v); setSelectedWeek(0); }} style={{
              padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: view === v ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
              background: view === v ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
              color: view === v ? ACCENT : DIM,
            }}>
              {v === 'month' ? '📅 Месяц' : v === 'week' ? '📆 Неделя' : '📊 Мезоцикл'}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {view === 'month' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <MiniStat label="Выполнено" value={totalDone} color={ACCENT} />
            <MiniStat label="Частично" value={totalPartial} color="#f59e0b" />
            <MiniStat label="Пропущено" value={totalMissed} color="#ef4444" />
            <MiniStat label="Объём" value={formatVol(totalActualVol)} color="#3b82f6" />
          </div>

          {/* Compliance gauge bar */}
          <div style={CARD}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginBottom: 3 }}>
              <span>Compliance месяца</span>
              <span style={{ fontWeight: 700, color: cal.compliance >= 80 ? ACCENT : cal.compliance >= 50 ? '#f59e0b' : '#ef4444' }}>{cal.compliance}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, cal.compliance)}%`, background: cal.compliance >= 80 ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT}aa)` : cal.compliance >= 50 ? 'linear-gradient(90deg, #f59e0b, #f59e0baa)' : 'linear-gradient(90deg, #ef4444, #ef4444aa)', transition: 'width 0.4s' }} />
            </div>
          </div>

          {/* День-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            <div />
            {DAY_NAMES_RU.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: DIM, padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {cal.weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: '32px repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
              <div style={{ fontSize: 10, color: DIM, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>Н{wi + 1}</div>
              {week.map((day, di) => (
                <CalendarCell key={di} day={day} today={today} mindDates={mindDates} mobDates={mobDates} warmDates={warmDates} coolDates={coolDates} onClick={() => { setView('week'); setSelectedWeek(wi + 1); }} />
              ))}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {['done', 'partial', 'missed', 'planned', 'rest'].filter(k => k !== 'none').map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: DIM }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[k] }} />
                {STATUS_LABELS[k]}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Неделя detail view */}
      {view === 'week' && (
        <>
          <div className="cal-weeks" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {weekSummaries.map((ws, i) => (
              <button key={i} onClick={() => setSelectedWeek(ws.weekNumber)} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                border: selectedWeek === ws.weekNumber ? '1px solid ' + ACCENT : '1px solid rgba(255,255,255,0.08)',
                background: selectedWeek === ws.weekNumber ? 'rgba(0,230,138,0.12)' : 'rgba(255,255,255,0.02)',
                color: selectedWeek === ws.weekNumber ? ACCENT : DIM,
              }}>
                Нед {ws.weekNumber} → {ws.compliance}%
              </button>
            ))}
          </div>

          {(() => {
            const ws = weekSummaries.find(w => w.weekNumber === selectedWeek) || weekSummaries[0];
            if (!ws) return <div style={{ color: DIM, textAlign: 'center', padding: 20 }}>Нет данных</div>;

            const activeDays = ws.days.filter(d => d.date);
            return (
              <>
                <div style={CARD}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>📆 Неделя {ws.weekNumber} ({ws.startDate} — {ws.endDate})</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <MiniStat label="Запланировано" value={ws.plannedSessions} color="#3b82f6" />
                    <MiniStat label="Выполнено" value={ws.completedSessions} color={ACCENT} />
                    <MiniStat label="Compliance" value={`${ws.compliance}%`} color={ws.compliance >= 80 ? ACCENT : ws.compliance >= 50 ? '#f59e0b' : '#ef4444'} />
                    <MiniStat label="Объём план" value={formatVol(ws.plannedVolume)} color="#3b82f6" />
                    <MiniStat label="Объём факт" value={formatVol(ws.actualVolume)} color={ACCENT} />
                  </div>
                  {ws.mesocyclePhase && <div style={{ fontSize: 10, color: '#a855f7', marginBottom: 8 }}>🏷 Фаза: {ws.mesocyclePhase}</div>}
                </div>

                {activeDays.map((day, i) => {
                  const exNames = actualMap.get(day.date)?.exercises || [];
                  return (
                    <div key={i} style={{ ...CARD, opacity: day.date ? 1 : 0.3 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                            {DAY_NAMES_RU[day.dayOfWeek]} · {day.date}
                          </span>
                          {day.isToday && <span style={{ fontSize: 10, color: ACCENT, marginLeft: 6, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.12)', border: '1px solid rgba(0,230,138,0.2)' }}>Сегодня</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {day.date && day.date <= today && (
                            <button onClick={(e) => { e.stopPropagation(); toggleManualDone(day.date); }}
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: flaggedDates.has(day.date) ? 'rgba(0,230,138,0.15)' : 'rgba(255,255,255,0.04)', color: flaggedDates.has(day.date) ? ACCENT : DIM }}>
                              {flaggedDates.has(day.date) ? '✓ Отм.' : '☐ Отм.'}
                            </button>
                          )}
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: STATUS_BG[day.status] || 'transparent',
                            color: STATUS_COLORS[day.status] || DIM,
                          }}>{STATUS_LABELS[day.status] || ''}</span>
                        </div>
                      </div>

                      {day.isTrainingDay && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
                          <div><span style={{ color: DIM }}>Фокус:</span> <span style={{ color: '#fff' }}>{day.plannedFocus || '—'}</span></div>
                          <div><span style={{ color: DIM }}>Подходов:</span> <span style={{ color: '#fff' }}>{day.plannedSets} план / {day.actualSets} факт</span></div>
                          <div><span style={{ color: DIM }}>Объём:</span> <span style={{ color: '#fff' }}>{formatVol(day.plannedVolume)} план / {formatVol(day.actualVolume)} факт</span></div>
                          <div><span style={{ color: DIM }}>Соблюдение:</span> <span style={{ color: day.compliance >= 80 ? ACCENT : day.compliance >= 30 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{day.compliance}%</span></div>
                        </div>
                      )}

                      {/* Exercise names from actual workout */}
                      {exNames.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {exNames.filter(Boolean).map((ex, ei) => (
                            <span key={ei} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,230,138,0.08)', border: '1px solid rgba(0,230,138,0.15)', color: ACCENT }}>
                              {ex}
                            </span>
                          ))}
                        </div>
                      )}

                      {day.isTrainingDay && day.plannedVolume > 0 && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.min(100, day.compliance)}%`,
                              background: day.compliance >= 80 ? ACCENT : day.compliance >= 30 ? '#f59e0b' : '#ef4444',
                              transition: 'width 0.3s',
                            }} />
                          </div>
                        </div>
                      )}

                      {!day.isTrainingDay && day.actualVolume > 0 && (
                        <div style={{ fontSize: 10, color: ACCENT, marginTop: 4 }}>
                          ✅ Незапланированная тренировка — {formatVol(day.actualVolume)} кг
                        </div>
                      )}

                      {flaggedDates.has(day.date) && !day.actualCompleted && (
                        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⚑ Отмечено вручную
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </>
      )}

      {/* Mesocycle overview */}
      {view === 'meso' && (() => {
        const overview = getMesocycleOverview(
          monthKey, `${MONTH_NAMES_RU[month]} ${year}`,
          `${year}-${String(month + 1).padStart(2, '0')}-01`,
          `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`,
          weekSummaries.map(w => ({
            weekNumber: w.weekNumber,
            plannedSessions: w.plannedSessions,
            completedSessions: w.completedSessions,
            plannedVolume: w.plannedVolume,
            actualVolume: w.actualVolume,
            mesocyclePhase: w.mesocyclePhase || '',
          })),
        );

        const trendLabel = overview.trend === 'improving' ? '📈 Улучшение' : overview.trend === 'declining' ? '📉 Спад' : '➡ Стабильно';
        const trendColor = overview.trend === 'improving' ? ACCENT : overview.trend === 'declining' ? '#ef4444' : '#f59e0b';

        return (
          <>
            <div style={CARD}>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 8 }}>📊 Обзор мезоцикла — {MONTH_NAMES_RU[month]} {year}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <MiniStat label="План" value={overview.totalPlannedSessions} color="#3b82f6" />
                <MiniStat label="Выполнено" value={overview.totalCompleted} color={ACCENT} />
                <MiniStat label="Compliance" value={`${overview.overallCompliance}%`} color={overview.overallCompliance >= 80 ? ACCENT : overview.overallCompliance >= 50 ? '#f59e0b' : '#ef4444'} />
                <MiniStat label="Тренд" value={trendLabel} color={trendColor} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <MiniStat label="Объём план" value={formatVol(overview.totalPlannedVolume)} color="#3b82f6" />
                <MiniStat label="Объём факт" value={formatVol(overview.totalActualVolume)} color={ACCENT} />
                <MiniStat label="Реализация" value={overview.totalPlannedVolume > 0 ? `${Math.round((overview.totalActualVolume / overview.totalPlannedVolume) * 100)}%` : '—'} color={overview.totalActualVolume >= overview.totalPlannedVolume * 0.8 ? ACCENT : '#f59e0b'} />
              </div>
            </div>

            {/* Phase distribution */}
            {overview.phaseDistribution.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🏷 Фазы мезоцикла</div>
                {overview.phaseDistribution.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, marginBottom: 4 }}>
                    <span style={{ color: ACCENT }}>{p.phase}</span>
                    <span style={{ color: DIM }}>{p.weeks} нед · compliance {p.compliance}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Неделя-by-week compliance */}
            {overview.weekCompliance.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Compliance по неделям</div>
                {overview.weekCompliance.map((wc, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: DIM, marginBottom: 2 }}>
                      <span>Нед {wc.week}</span>
                      <span>{wc.actual}/{wc.planned} — {wc.compliance}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, wc.compliance)}%`, background: wc.compliance >= 80 ? 'linear-gradient(90deg, #00e68a88, #00e68a)' : wc.compliance >= 50 ? 'linear-gradient(90deg, #f59e0b88, #f59e0b)' : 'linear-gradient(90deg, #ef444488, #ef4444)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Volume by week */}
            {overview.weekCompliance.length > 0 && (
              <div style={CARD}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Объём по неделям (план vs факт)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, paddingTop: 8 }}>
                  {(() => {
                    const maxVol = Math.max(...overview.weekCompliance.map(w => Math.max(overview.totalPlannedVolume / overview.weekCompliance.length, overview.totalActualVolume / overview.weekCompliance.length)), 1);
                    return overview.weekCompliance.map((wc, i) => {
                      const weekPlanned = Math.round(overview.totalPlannedVolume / overview.weekCompliance.length);
                      const weekActual = Math.round(overview.totalActualVolume / overview.weekCompliance.length);
                      const ph = `${(weekPlanned / maxVol) * 80}px`;
                      const ah = `${(weekActual / maxVol) * 80}px`;
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ fontSize: 10, color: DIM }}>{formatVol(weekActual)}</div>
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                            <div title="План" style={{ height: ph === '0px' ? '2px' : ph, width: '70%', borderRadius: 2, background: 'rgba(59,130,246,0.35)', border: '1px dashed rgba(59,130,246,0.5)', minHeight: 2, transition: 'height 0.3s' }} />
                            <div title="Факт" style={{ height: ah === '0px' ? '2px' : ah, width: '60%', borderRadius: 2, background: ACCENT, border: '1px solid rgba(0,230,138,0.3)', minHeight: 2, transition: 'height 0.3s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>Н{wc.week}</div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 10, color: DIM, marginTop: 8 }}>
                  <span>▬ Факт</span>
                  <span style={{ borderTop: '1px dashed rgba(59,130,246,0.5)' }}>--- План</span>
                </div>
              </div>
            )}

            {/* Trend */}
            <div style={CARD}>
              <div style={{ fontSize: 11, fontWeight: 700, color: trendColor }}>{trendLabel}</div>
            </div>
          </>
        );
      })()}
    </div>
  );
};

/** Calendar cell for month grid */
const CalendarCell: React.FC<{ day: CalendarDay; today: string; mindDates?: Set<string>; mobDates?: Set<string>; warmDates?: Set<string>; coolDates?: Set<string>; onClick: () => void }> = ({ day, today, mindDates, mobDates, warmDates, coolDates, onClick }) => {
  if (!day.date) {
    return <div style={{ aspectRatio: '1', borderRadius: 8 }} />;
  }

  const isToday = day.date === today;
  const bg = STATUS_BG[day.status] || 'rgba(255,255,255,0.02)';
  const border = isToday
    ? '1px solid ' + ACCENT
    : `1px solid ${STATUS_COLORS[day.status]}33`;
  const hasMind = !!mindDates && mindDates.has(day.date);
  const hasMob = !!mobDates && mobDates.has(day.date);
  const hasWarm = !!warmDates && warmDates.has(day.date);
  const hasCool = !!coolDates && coolDates.has(day.date);

  return (
    <div className="cal-cell" data-status={day.status} data-date={day.date} data-today={isToday ? 'true' : 'false'} onClick={onClick} title={[
      STATUS_LABELS[day.status] || '',
      hasMind ? '🧠 психо-чек-ин' : '',
      hasMob ? '🧘 мобильность выполнена' : '',
      hasWarm ? '🔥 разминка выполнена' : '',
      hasCool ? '❄️ заминка выполнена' : '',
    ].filter(Boolean).join(' · ') || ''} style={{
      aspectRatio: '1',
      borderRadius: 8,
      background: bg,
      border,
      padding: 2,
      cursor: day.isTrainingDay ? 'pointer' : 'default',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.15s',
      position: 'relative',
    }}>
      <div style={{ fontSize: 10, fontWeight: isToday ? 800 : 500, color: isToday ? ACCENT : '#fff' }}>
        {day.date.slice(8)}
      </div>
      {(hasMind || hasMob || hasWarm || hasCool) && (
        <div style={{ position: 'absolute', top: 1, right: 2, display: 'flex', gap: 1, fontSize: 7 }}>
          {hasMind && <span title="Психо-чек-ин">🧠</span>}
          {hasMob && <span title="Мобильность">🧘</span>}
          {hasWarm && <span title="Разминка">🔥</span>}
          {hasCool && <span title="Заминка">❄️</span>}
        </div>
      )}
      {day.isTrainingDay && (
        <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>
          {day.plannedExercises}упр
        </div>
      )}
      {day.isTrainingDay && day.status !== 'planned' && (
        <div style={{ fontSize: 10, color: STATUS_COLORS[day.status] || DIM, marginTop: 1 }}>
          {day.compliance}%
        </div>
      )}
      {day.isTrainingDay && (
        <div style={{
          position: 'absolute', bottom: 2, left: 2, right: 2,
          height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 1,
            width: `${Math.min(100, day.compliance)}%`,
            background: STATUS_COLORS[day.status] || ACCENT,
          }} />
        </div>
      )}
    </div>
  );
};

/** Mini stat chip */
const MiniStat: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div className="cal-stat" style={{
    padding: '6px 10px', borderRadius: 8, fontSize: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'center', minWidth: 60,
  }}>
    <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 10, color: DIM, marginTop: 1 }}>{label}</div>
  </div>
);

export default React.memo(TrainingCalendarTab);
