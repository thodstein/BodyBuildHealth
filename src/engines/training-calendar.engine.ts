/**
 * Training Calendar + Water Tracking + Export Engine
 *
 * Training Calendar: monthly/daily planned vs actual workout tracking
 * Water Tracker: daily goals, hourly logging, trends, reminders
 * Export Engine: JSON/CSV exports
 *
 * Интерпретация анализов живёт в одном месте — `lab-analysis.engine.ts`
 * (дубль таблиц порогов отсюда удалён, чтобы не расходились нормы и советы).
 *
 * @module training-calendar-engine
 */

// Канон календарной даты: все «дни» здесь — то, что видит человек (подсветка
// сегодня, ключи ячеек календаря, окна недели/месяца). UTC-версия в вечернее
// время UTC+3…+12 сдвигала всё на «вчера».
import { localIsoDate, localIsoDateOffset } from '../core/local-date';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CalendarDay {
  date: string;
  dayOfWeek: number;     // 0=Mon..6=Sun
  isTrainingDay: boolean;
  plannedFocus: string;
  plannedExercises: number;
  plannedDuration?: number;
  plannedVolume: number;
  plannedSets: number;
  actualCompleted: boolean;
  actualDuration: number;
  actualVolume: number;
  actualSets: number;
  actualExercises: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  weekNumber: number;
  mesocyclePhase: string;
  compliance: number;       // 0-100: % выполнения плана
  status: 'done' | 'partial' | 'missed' | 'rest' | 'planned' | 'none';
}

export interface CalendarWeek {
  weekNumber: number;
  days: CalendarDay[];
  plannedSessions: number;
  completedSessions: number;
  plannedVolume: number;
  actualVolume: number;
  compliance: number;
  startDate: string;
  endDate: string;
  mesocyclePhase: string;
}

export interface MesocycleOverview {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  weekCompliance: { week: number; planned: number; actual: number; compliance: number }[];
  totalPlannedSessions: number;
  totalCompleted: number;
  totalPlannedVolume: number;
  totalActualVolume: number;
  overallCompliance: number;
  phaseDistribution: { phase: string; weeks: number; compliance: number }[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface CalendarHeatmapData {
  date: string;
  value: number;          // 0-100 (compliance or volume)
  plannedVolume: number;
  actualVolume: number;
  status: CalendarDay['status'];
}

export interface PlanFactSession {
  date: string;
  dayOfWeek: number;
  planned: { focus: string; exercises: number; sets: number; volume: number; duration?: number } | null;
  actual: { exercises: number; sets: number; volume: number; duration: number } | null;
  compliance: number;
  status: CalendarDay['status'];
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  totalPlannedSessions: number;
  totalCompleted: number;
  totalVolume: number;
  compliance: number; // %
  weekSummaries?: CalendarWeek[];
}

export interface WaterLog {
  date: string;
  hourlyLogs: { hour: number; amountMl: number }[];
  totalMl: number;
  goalMl: number;
  percentComplete: number;
}

export interface WaterStats {
  today: WaterLog;
  weekAvg: number;
  monthAvg: number;
  bestDay: { date: string; amount: number };
  streak: number; // days meeting goal
  trend: number;  // % change vs last week
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Calendar Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateCalendarMonth(
  year: number, month: number,
  plannedSessions: { date: string; focus: string; exercises: number; duration?: number }[],
  actualSessions: { date: string; completed: boolean; duration: number; volume: number }[],
): CalendarMonth {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = localIsoDate();
  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  // Find first day of month (0=Sun..6=Sat, convert to 0=Mon)
  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1; // Convert to Mon=0

  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(makeEmptyDay(i, 0));
  }

  let totalPlanned = 0, totalCompleted = 0, totalVolume = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const planned = plannedSessions.find(s => s.date === dateStr);
    const actual = actualSessions.find(s => s.date === dateStr);

    const dayOfWeek = (firstDay + day - 1) % 7;
    if (planned) totalPlanned++;
    if (actual?.completed) { totalCompleted++; totalVolume += actual.volume || 0; }

    const isTraining = !!planned;
    const isPast = dateStr < today;
    const isFuture = dateStr > today;

    let status: CalendarDay['status'] = 'none';
    let compliance = 0;
    if (isTraining && actual?.completed) {
      const pv = planned?.duration;
      if (pv != null && pv > 0) {
        compliance = Math.round(Math.min(100, ((actual.duration || 0) / pv) * 100));
        status = compliance >= 80 ? 'done' : compliance >= 30 ? 'partial' : 'missed';
      } else {
        // Плановая длительность не задана — сравнивать не с чем, и «0%» означал бы
        // «пропущено» для тренировки, которая по дневнику выполнена. Факт выполнения
        // известен, поэтому день закрыт как выполненный (как и во втором билдере,
        // где достаточно наличия факта).
        compliance = 100;
        status = 'done';
      }
    } else if (isTraining && isPast) {
      status = 'missed';
    } else if (isTraining && isFuture) {
      status = 'planned';
    } else if (!isTraining && actual?.completed) {
      status = 'done';
    }

    currentWeek.push({
      date: dateStr, dayOfWeek, isTrainingDay: isTraining,
      plannedFocus: planned?.focus || '',
      plannedExercises: planned?.exercises || 0,
       plannedDuration: planned?.duration,
      plannedVolume: 0,
      plannedSets: 0,
      actualCompleted: actual?.completed || false,
      actualDuration: actual?.duration || 0,
      actualVolume: actual?.volume || 0,
      actualSets: 0, actualExercises: 0,
      isToday: dateStr === today,
      isPast,
      isFuture,
      weekNumber: Math.ceil(day / 7),
      mesocyclePhase: '',
      compliance,
      status,
    });

    if (currentWeek.length === 7 || day === daysInMonth) {
      while (currentWeek.length < 7) {
        currentWeek.push(makeEmptyDay(currentWeek.length, 0));
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  return {
    year, month,
    weeks,
    totalPlannedSessions: totalPlanned,
    totalCompleted,
    totalVolume,
    compliance: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
  };
}

/** Get training day names (Mon-Fri = training, Sat-Sun = optional) */
export function getDayTrainingFocus(dayOfWeek: number, split: string): string {
  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  if (split === 'ppl') {
    return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Отдых'][dayOfWeek];
  }
  if (split === 'upper_lower') {
    return ['Верх', 'Низ', 'Отдых', 'Верх', 'Низ', 'Отдых', 'Отдых'][dayOfWeek];
  }
  if (split === 'fullbody') {
    return ['FBW A', 'Отдых', 'FBW B', 'Отдых', 'FBW C', 'Отдых', 'Отдых'][dayOfWeek];
  }
  return ['Тренировка', 'Тренировка', 'Отдых', 'Тренировка', 'Тренировка', 'Отдых', 'Отдых'][dayOfWeek];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1.1 Enhanced Training Calendar — Plan vs Fact
// ═══════════════════════════════════════════════════════════════════════════

const DAY_NAMES_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_NAMES_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export { DAY_NAMES_RU, MONTH_NAMES_RU };

interface PlannedSession {
  date: string;
  focus: string;
  exercises: string[];
  sets: number;
  volume: number;
  duration?: number;
}

interface ActualSession {
  date: string;
  exercises: string[];
  sets: number;
  volume: number;
  duration: number;
}

/** Построить календарь с планом vs факт из реальных данных (BridgeSession + WorkoutLog) */
export function generateTrainingCalendar(
  year: number, month: number,
  plannedMap: Map<string, PlannedSession>,
  actualMap: Map<string, ActualSession>,
  mesoPhases?: Map<string, string>,
): CalendarMonth {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = localIsoDate();
  const weeks: CalendarDay[][] = [];
  let currentWeek: CalendarDay[] = [];

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(makeEmptyDay(i, 0));
  }

  let totalPlanned = 0, totalCompleted = 0, totalVol = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const planned = plannedMap.get(dateStr);
    const actual = actualMap.get(dateStr);
    const phase = mesoPhases?.get(dateStr) || '';

    const dow = (firstDay + day - 1) % 7;
    const isTraining = !!planned;
    if (isTraining) totalPlanned++;

    let status: CalendarDay['status'] = 'none';
    let compliance = 0;
    if (isTraining && actual) {
      compliance = planned!.volume > 0 ? Math.round(Math.min(100, (actual.volume / planned!.volume) * 100)) : (actual.sets > 0 ? 100 : 0);
      status = compliance >= 80 ? 'done' : compliance >= 30 ? 'partial' : 'missed';
      totalCompleted++;
      totalVol += actual.volume;
    } else if (isTraining && dateStr <= today) {
      status = 'missed';
    } else if (isTraining && dateStr > today) {
      status = 'planned';
    } else if (!isTraining && actual) {
      status = 'done';
      totalVol += actual.volume;
    } else if (!isTraining) {
      status = dateStr <= today ? (dow >= 5 ? 'rest' : 'none') : 'none';
    }

    const cd: CalendarDay = {
      date: dateStr, dayOfWeek: dow,
      isTrainingDay: isTraining,
      plannedFocus: planned?.focus || '',
      plannedExercises: planned?.exercises?.length || 0,
       plannedDuration: planned?.duration,
      plannedVolume: planned?.volume || 0,
      plannedSets: planned?.sets || 0,
      actualCompleted: !!actual,
      actualDuration: actual?.duration || 0,
      actualVolume: actual?.volume || 0,
      actualSets: actual?.sets || 0,
      actualExercises: actual?.exercises?.length || 0,
      isToday: dateStr === today,
      isPast: dateStr < today,
      isFuture: dateStr > today,
      weekNumber: Math.ceil(day / 7),
      mesocyclePhase: phase,
      compliance,
      status,
    };

    currentWeek.push(cd);

    if (currentWeek.length === 7 || day === daysInMonth) {
      while (currentWeek.length < 7) {
        currentWeek.push(makeEmptyDay(currentWeek.length, weeks.length + 1));
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  const weekSummaries = buildWeekSummaries(weeks);

  return {
    year, month,
    weeks,
    weekSummaries,
    totalPlannedSessions: totalPlanned,
    totalCompleted: weeks.flat().filter(d => d.status === 'done').length,
    totalVolume: totalVol,
    compliance: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
  };
}

function makeEmptyDay(dow: number, wk: number): CalendarDay {
  return {
    date: '', dayOfWeek: dow, isTrainingDay: false,
    plannedFocus: '', plannedExercises: 0, plannedDuration: 0, plannedVolume: 0, plannedSets: 0,
    actualCompleted: false, actualDuration: 0, actualVolume: 0, actualSets: 0, actualExercises: 0,
    isToday: false, isPast: false, isFuture: true, weekNumber: wk, mesocyclePhase: '',
    compliance: 0, status: 'none',
  };
}

function buildWeekSummaries(weeks: CalendarDay[][]): CalendarWeek[] {
  return weeks.map((days, i) => {
    const active = days.filter(d => d.date);
    const planned = active.filter(d => d.isTrainingDay);
    const completed = active.filter(d => d.status === 'done');
    const plannedVol = planned.reduce((s, d) => s + d.plannedVolume, 0);
    const actualVol = active.reduce((s, d) => s + d.actualVolume, 0);
    return {
      weekNumber: i + 1,
      days,
      plannedSessions: planned.length,
      completedSessions: completed.length,
      plannedVolume: plannedVol,
      actualVolume: actualVol,
      compliance: planned.length > 0 ? Math.round((completed.length / planned.length) * 100) : 0,
      startDate: active[0]?.date || '',
      endDate: active[active.length - 1]?.date || '',
      mesocyclePhase: planned[0]?.mesocyclePhase || '',
    };
  });
}

/** Построить heatmap за период (для визуализации интенсивности тренировок) */
export function getCalendarHeatmap(
  startDate: string, endDate: string,
  actualMap: Map<string, ActualSession>,
): CalendarHeatmapData[] {
  const out: CalendarHeatmapData[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = localIsoDate();

  const cursor = new Date(start);
  while (cursor <= end) {
    const ds = localIsoDate(cursor);
    const actual = actualMap.get(ds);
    const plannedVol = 0;
    const actualVol = actual?.volume || 0;
    const value = actualVol;

    out.push({
      date: ds,
      value,
      plannedVolume: plannedVol,
      actualVolume: actualVol,
      status: actual ? (actualVol > 0 ? 'done' : 'rest') : (ds > today ? 'planned' : 'rest'),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

/** Извлечь данные плана из BridgeSession[] и построить plannedMap */
export function buildPlannedMapFromBridgeSessions(
  sessions: { date: string; focus: string; exercises: { exerciseName: string }[]; totalSets: number; totalVolume: number; duration?: number; }[],
  startDate: string, endDate: string,
): Map<string, PlannedSession> {
  const map = new Map<string, PlannedSession>();
  for (const s of sessions) {
    if (s.date >= startDate && s.date <= endDate) {
      map.set(s.date, {
        date: s.date,
        focus: s.focus || 'Тренировка',
        exercises: s.exercises.map(e => e.exerciseName),
        sets: s.totalSets,
        volume: s.totalVolume,
        duration: s.duration,
      });
    }
  }
  return map;
}

/** Извлечь данные факта из WorkoutLog[] */
export function buildActualMapFromWorkoutLogs(
  logs: { date: string; exercises?: { exerciseName?: string; sets?: any[]; totalVolume?: number }[]; duration?: number }[],
  startDate: string, endDate: string,
): Map<string, ActualSession> {
  const map = new Map<string, ActualSession>();
  for (const l of logs) {
    if (l.date >= startDate && l.date <= endDate) {
      const exs = l.exercises || [];
      const vol = exs.reduce((sum, e) => sum + (e.totalVolume || 0), 0);
      const sets = exs.reduce((sum, e) => sum + (e.sets?.length || 0), 0);
      map.set(l.date, {
        date: l.date,
        exercises: exs.map(e => e.exerciseName || ''),
        sets,
        volume: vol,
        duration: l.duration || 0,
      });
    }
  }
  return map;
}

/**
 * Обзор мезоцикла — агрегация по неделям с планом vs факт.
 * weeks — массив { weekNumber, plannedSessions, completedSessions, plannedVolume, actualVolume }
 */
export function getMesocycleOverview(
  id: string, name: string,
  startDate: string, endDate: string,
  weeks: { weekNumber: number; plannedSessions: number; completedSessions: number; plannedVolume: number; actualVolume: number; mesocyclePhase?: string }[],
): MesocycleOverview {
  const phaseMap = new Map<string, { weeks: number; compliance: number }>();
  let totalPlanned = 0, totalCompleted = 0, totalPlannedVol = 0, totalActualVol = 0;

  const weekCompliance = weeks.map(w => {
    const compliance = w.plannedSessions > 0 ? Math.round((w.completedSessions / w.plannedSessions) * 100) : 0;
    totalPlanned += w.plannedSessions;
    totalCompleted += w.completedSessions;
    totalPlannedVol += w.plannedVolume;
    totalActualVol += w.actualVolume;
    const phase = w.mesocyclePhase || '';
    if (phase) {
      const cur = phaseMap.get(phase) || { weeks: 0, compliance: 0 };
      phaseMap.set(phase, { weeks: cur.weeks + 1, compliance: cur.compliance + compliance });
    }
    return { week: w.weekNumber, planned: w.plannedSessions, actual: w.completedSessions, compliance };
  });

  const phaseDistribution = Array.from(phaseMap.entries()).map(([phase, v]) => ({
    phase, weeks: v.weeks, compliance: Math.round(v.compliance / v.weeks),
  }));

  const overallCompliance = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;

  // Trend: сравниваем первую и последнюю неделю
  let trend: MesocycleOverview['trend'] = 'stable';
  if (weekCompliance.length >= 2) {
    const diff = weekCompliance[weekCompliance.length - 1].compliance - weekCompliance[0].compliance;
    trend = diff > 10 ? 'improving' : diff < -10 ? 'declining' : 'stable';
  }

  return {
    id, name, startDate, endDate,
    totalWeeks: weeks.length,
    weekCompliance,
    totalPlannedSessions: totalPlanned,
    totalCompleted,
    totalPlannedVolume: totalPlannedVol,
    totalActualVolume: totalActualVol,
    overallCompliance,
    phaseDistribution,
    trend,
  };
}

/** Простой генератор синтетического плана (fallback, если нет BridgeSession) */
export function generateSyntheticPlan(
  year: number, month: number,
  daysPerWeek: number,
  split: string,
): Map<string, PlannedSession> {
  const map = new Map<string, PlannedSession>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const trainingDays: number[] = [];
  if (daysPerWeek >= 6) {
    for (let d = 0; d < 7; d++) if (d !== 6) trainingDays.push(d);
  } else if (daysPerWeek >= 4) {
    trainingDays.push(0, 1, 3, 4);
  } else {
    trainingDays.push(0, 2, 4);
  }

  let firstDow = new Date(year, month, 1).getDay();
  firstDow = firstDow === 0 ? 6 : firstDow - 1;

  for (let day = 1; day <= daysInMonth; day++) {
    const dow = (firstDow + day - 1) % 7;
    if (trainingDays.includes(dow)) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const focus = getDayTrainingFocus(dow, split);
      map.set(dateStr, {
        date: dateStr,
        focus,
        exercises: [`Основное (${focus})`, 'Подсобка'],
        sets: 15,
        volume: 3000,
        duration: 60,
      });
    }
  }
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Water & Hydration Tracker
// ═══════════════════════════════════════════════════════════════════════════

import { loadWaterLog, addWater } from './nutrition-tracker.engine';

export function getTodayWaterLog(goalMl: number = 3000): WaterLog {
  const today = localIsoDate();
  const entries = loadWaterLog();
  const todayEntry = entries.find(e => e.date === today);
  const total = todayEntry?.amountMl || 0;

  // Generate hourly dummy log (simplified)
  const hourlyLogs: WaterLog['hourlyLogs'] = [];
  const hour = new Date().getHours();
  const perHour = total / Math.max(1, hour - 6);

  for (let h = 7; h <= Math.min(23, hour); h++) {
    hourlyLogs.push({ hour: h, amountMl: Math.round(perHour) });
  }

  return {
    date: today,
    hourlyLogs,
    totalMl: total,
    goalMl,
    percentComplete: Math.round(Math.min(100, (total / goalMl) * 100)),
  };
}

export function getWaterStats(): WaterStats {
  const entries = loadWaterLog();
  const today = localIsoDate();

  // Today
  const todayEntry = entries.find(e => e.date === today) || { date: today, amountMl: 0 };
  const todayLog: WaterLog = {
    date: today, hourlyLogs: [], totalMl: todayEntry.amountMl,
    goalMl: 3000, percentComplete: Math.round((todayEntry.amountMl / 3000) * 100),
  };

  // Week avg
  const weekAgo = localIsoDateOffset(-7);
  const weekEntries = entries.filter(e => e.date >= weekAgo);
  const weekAvg = weekEntries.length > 0
    ? Math.round(weekEntries.reduce((s, e) => s + e.amountMl, 0) / weekEntries.length)
    : 0;

  // Month avg
  const monthAgo = localIsoDateOffset(-30);
  const monthEntries = entries.filter(e => e.date >= monthAgo);
  const monthAvg = monthEntries.length > 0
    ? Math.round(monthEntries.reduce((s, e) => s + e.amountMl, 0) / monthEntries.length)
    : 0;

  // Best day
  const sorted = [...entries].sort((a, b) => b.amountMl - a.amountMl);
  const bestDay = sorted.length > 0
    ? { date: sorted[0].date, amount: sorted[0].amountMl }
    : { date: today, amount: 0 };

  // Streak
  let streak = 0;
  const dates = [...new Set(entries.map(e => e.date))].sort().reverse();
  for (const d of dates) {
    const entry = entries.find(e => e.date === d);
    if (entry && entry.amountMl >= 2500) streak++;
    else break;
  }

  // Trend
  const prevWeek = localIsoDateOffset(-14);
  const prevWeekEntries = entries.filter(e => e.date >= prevWeek && e.date < weekAgo);
  const prevAvg = prevWeekEntries.length > 0
    ? prevWeekEntries.reduce((s, e) => s + e.amountMl, 0) / prevWeekEntries.length
    : weekAvg;
  const trend = prevAvg > 0 ? Math.round(((weekAvg - prevAvg) / prevAvg) * 100) : 0;

  return { today: todayLog, weekAvg, monthAvg, bestDay, streak, trend };
}

/** Quick add water in a single call */
export function quickAddWater(amountMl: number): number {
  addWater(amountMl);
  return getTodayWaterLog().totalMl;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Export Engine (JSON/CSV)
// ═══════════════════════════════════════════════════════════════════════════

export function exportToJSON(data: any): string {
  return JSON.stringify(data, null, 2);
}

export function exportWorkoutsToCSV(): string {
  // Simple inline CSV generation from localStorage
  try {
    const sessions = JSON.parse(localStorage.getItem('he_workout_log_v2') || '[]');
    let csv = 'Date,Exercise,Set,Weight,Reps,RPE,RIR\n';
    for (const sess of sessions) {
      for (const ex of sess.exercises || []) {
        for (const set of ex.sets || []) {
          csv += `${sess.date},${ex.exerciseName},${set.setNumber},${set.weightKg},${set.reps},${set.rpe},${set.rir}\n`;
        }
      }
    }
    return csv;
  } catch { return 'No data'; }
}
