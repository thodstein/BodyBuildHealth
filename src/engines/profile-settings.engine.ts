/**
 * Profile Settings Engine — User preferences, daily metrics, goals.
 *
 * Manages:
 *  - Daily metrics (sleep, HRV, water, steps, weight)
 *  - Training preferences (days, session length, equipment)
 *  - Nutrition targets (kcal, protein, fat, carbs)
 *  - Recovery tracking (stress, soreness, energy)
 *  - Goal tracking with progress
 *
 * Stores in localStorage under 'he_profile_metrics'.
 *
 * @module profile-settings-engine
 */

import { getWeightLog, saveWeightLog, type WeightEntry } from './profile-store';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DailyMetrics {
  date: string;
  sleepHours: number;
  sleepQuality: number;     // 1-5
  restingHR: number;
  hrvMs: number;
  weightKg: number;
  waterLiters: number;
  steps: number;
  subjectiveEnergy: number; // 1-5
  subjectiveSoreness: number; // 1-5
  subjectiveStress: number; // 1-5
  notes: string;
}

export interface TrainingPreferences {
  daysPerWeek: number;
  sessionLengthMin: number;
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'any';
  equipment: string[];
  gymType: 'home' | 'commercial' | 'both';
  focusAreas: string[];
  avoidExercises: string[];
}

export interface NutritionTargets {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  waterLiters: number;
  mealsPerDay: number;
  dietType: 'standard' | 'keto' | 'carnivore' | 'vegan' | 'intermittent_fasting' | 'flexible';
  fastingWindow?: number; // hours for IF
}

export interface BodyGoals {
  targetWeight: number;
  targetBodyFat: number;
  deadline: string;       // ISO date
  rate: number;           // kg/week
  startWeight: number;
  startBodyFat: number;
}

export interface MetricsHistory {
  dailyMetrics: DailyMetrics[];
  weeklyAverages: {
    sleep: number; hrv: number; weight: number; water: number;
    energy: number; soreness: number; stress: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════

const METRICS_KEY = 'he_daily_metrics';

export function loadMetrics(): DailyMetrics[] {
  try { return JSON.parse(localStorage.getItem(METRICS_KEY) || '[]'); } catch { return []; }
}

export function saveMetric(metric: DailyMetrics): DailyMetrics[] {
  const metrics = loadMetrics();
  const idx = metrics.findIndex(m => m.date === metric.date);
  if (idx >= 0) metrics[idx] = metric;
  else metrics.push(metric);
  metrics.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics.slice(-365)));
  return metrics;
}

/** Сегодня по ЛОКАЛЬНОМУ времени (YYYY-MM-DD) — как дневники Профиля (todayIso). */
export function todayLocalIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayMetric(): DailyMetrics {
  const today = todayLocalIso();
  const metrics = loadMetrics();
  const existing = metrics.find(m => m.date === today);
  if (existing) return existing;
  return {
    date: today, sleepHours: 7, sleepQuality: 4, restingHR: 60, hrvMs: 45,
    weightKg: 80, waterLiters: 2, steps: 5000,
    subjectiveEnergy: 4, subjectiveSoreness: 2, subjectiveStress: 3, notes: '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function getMetricsHistory(): MetricsHistory {
  const metrics = loadMetrics();
  const weeklyAverages: MetricsHistory['weeklyAverages'] = [];

  // Group by week
  const weekMap = new Map<number, DailyMetrics[]>();
  for (const m of metrics) {
    const d = new Date(m.date);
    const weekNum = Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
    if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
    weekMap.get(weekNum)!.push(m);
  }

  for (const [, weekMetrics] of weekMap) {
    const n = weekMetrics.length;
    weeklyAverages.push({
      sleep: weekMetrics.reduce((s, m) => s + m.sleepHours, 0) / n,
      hrv: weekMetrics.reduce((s, m) => s + m.hrvMs, 0) / n,
      weight: weekMetrics.reduce((s, m) => s + m.weightKg, 0) / n,
      water: weekMetrics.reduce((s, m) => s + m.waterLiters, 0) / n,
      energy: weekMetrics.reduce((s, m) => s + m.subjectiveEnergy, 0) / n,
      soreness: weekMetrics.reduce((s, m) => s + m.subjectiveSoreness, 0) / n,
      stress: weekMetrics.reduce((s, m) => s + m.subjectiveStress, 0) / n,
    });
  }

  return { dailyMetrics: metrics, weeklyAverages };
}

/** 7-day rolling averages */
export function getRollingAverages(): { sleep: number; hrv: number; weight: number; water: number } {
  const metrics = loadMetrics().slice(-7);
  if (!metrics.length) return { sleep: 7, hrv: 45, weight: 80, water: 2 };
  return {
    sleep: Math.round(metrics.reduce((s, m) => s + m.sleepHours, 0) / metrics.length * 10) / 10,
    hrv: Math.round(metrics.reduce((s, m) => s + m.hrvMs, 0) / metrics.length),
    weight: Math.round(metrics.reduce((s, m) => s + m.weightKg, 0) / metrics.length * 10) / 10,
    water: Math.round(metrics.reduce((s, m) => s + m.waterLiters, 0) / metrics.length * 10) / 10,
  };
}

/** Weight trend (linear regression over N days) */
export function weightTrend(days: number = 7): number {
  const metrics = loadMetrics().slice(-days);
  if (metrics.length < 3) return 0;

  const n = metrics.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += metrics[i].weightKg;
    sumXY += i * metrics[i].weightKg;
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return Math.round(slope * 7 * 100) / 100; // kg/week
}

/** Goal progress in % */
export function goalProgress(currentWeight: number, goal: BodyGoals): number {
  const total = goal.startWeight - goal.targetWeight;
  if (Math.abs(total) < 0.1) return 100;
  return Math.round(Math.min(100, Math.max(0, (goal.startWeight - currentWeight) / total * 100)));
}

/** Estimated weeks to goal */
export function weeksToGoal(currentWeight: number, goal: BodyGoals, trendKgPerWeek: number): number {
  const remaining = Math.abs(currentWeight - goal.targetWeight);
  const rate = Math.abs(trendKgPerWeek) > 0.05 ? Math.abs(trendKgPerWeek) : 0.3;
  return Math.round(remaining / rate);
}

// ═══════════════════════════════════════════════════════════════════════════
// Quick daily check-in form data
// ═══════════════════════════════════════════════════════════════════════════

export function quickCheckin(data: Partial<DailyMetrics>): DailyMetrics {
  const today = getTodayMetric();
  const merged = { ...today, ...data, date: today.date };
  saveMetric(merged);
  return merged;
}

/** Get all-time stats */
export function getAllTimeStats(): {
  totalDays: number; bestSleep: number; bestHRV: number;
  lowestWeight: number; highestWeight: number; longestStreak: number;
} {
  const metrics = loadMetrics();
  if (!metrics.length) return { totalDays: 0, bestSleep: 0, bestHRV: 0, lowestWeight: 0, highestWeight: 0, longestStreak: 0 };

  let streak = 0, longestStreak = 0;
  const sorted = metrics.map(m => m.date).sort();
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff <= 1.1) streak++;
    else { if (streak > longestStreak) longestStreak = streak; streak = 0; }
  }
  if (streak > longestStreak) longestStreak = streak;

  return {
    totalDays: metrics.length,
    bestSleep: metrics.length > 0 ? Math.max(...metrics.map(m => m.sleepHours)) : 0,
    bestHRV: metrics.length > 0 ? Math.max(...metrics.map(m => m.hrvMs)) : 0,
    lowestWeight: metrics.length > 0 ? Math.min(...metrics.map(m => m.weightKg)) : 0,
    highestWeight: metrics.length > 0 ? Math.max(...metrics.map(m => m.weightKg)) : 0,
    longestStreak,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Синхронизация с дневниками профиля (Профиль → Дневники)
// Канонические ключи: he_weight_log (вес), he_sleep_diary (сон), he_bp_diary (пульс).
// Чек-ин пишет/читает ТЕ ЖЕ записи, что и модалки дневников Профиля — данные
// не дублируются и видны в обоих местах.
// ═══════════════════════════════════════════════════════════════════════════

const SLEEP_DIARY_KEY = 'he_sleep_diary';
const BP_DIARY_KEY = 'he_bp_diary';

function readDiaryEntries<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Подтянуть сегодняшние значения из дневников профиля (вес/сон/пульс).
 *  Заполняет только те поля, для которых в дневниках есть запись на дату m.date. */
export function pullFromProfileDiaries(m: DailyMetrics): DailyMetrics {
  const merged = { ...m };
  try {
    const today = m.date;
    const weight = getWeightLog().find(e => e.date === today);
    if (weight && weight.weight > 0) merged.weightKg = weight.weight;
    const sleep = readDiaryEntries<{ date: string; hours?: number; quality?: number }>(SLEEP_DIARY_KEY).find(e => e.date === today);
    if (sleep && typeof sleep.hours === 'number' && sleep.hours > 0) merged.sleepHours = sleep.hours;
    if (sleep && typeof sleep.quality === 'number' && sleep.quality > 0) merged.sleepQuality = sleep.quality;
    const bp = readDiaryEntries<{ date: string; pulse?: number }>(BP_DIARY_KEY).find(e => e.date === today);
    if (bp && typeof bp.pulse === 'number' && bp.pulse > 0) merged.restingHR = bp.pulse;
  } catch { /* ignore */ }
  return merged;
}

/** Слить ИСТОРИЮ дневников профиля в чек-ин (he_daily_metrics):
 *  для дат, которых нет в чек-ине, создаются записи с весом/сном/пульсом из дневников —
 *  тренды и статистика чек-ина начинают учитывать данные, введённые в Профиле.
 *  Существующие записи чек-ина не перезаписываются. Возвращает число созданных записей. */
export function syncHistoryFromProfileDiaries(): number {
  try {
    const metrics = loadMetrics();
    const byDate = new Map(metrics.map(m => [m.date, m]));
    const created = new Set<string>();
    const ensure = (date: string): DailyMetrics | null => {
      if (!date) return null;
      let m = byDate.get(date);
      if (!m) {
        m = {
          date, sleepHours: 7, sleepQuality: 4, restingHR: 60, hrvMs: 45,
          weightKg: 80, waterLiters: 2, steps: 5000,
          subjectiveEnergy: 4, subjectiveSoreness: 2, subjectiveStress: 3, notes: '',
        };
        byDate.set(date, m);
        created.add(date);
      }
      return m;
    };
    for (const w of getWeightLog()) {
      if (!(w.weight > 0)) continue;
      const m = ensure(w.date);
      if (m && created.has(w.date)) m.weightKg = w.weight;
    }
    for (const s of readDiaryEntries<{ date?: string; hours?: number; quality?: number }>(SLEEP_DIARY_KEY)) {
      const m = ensure(s.date || '');
      if (m && created.has(s.date || '')) {
        if (typeof s.hours === 'number' && s.hours > 0) m.sleepHours = s.hours;
        if (typeof s.quality === 'number' && s.quality > 0) m.sleepQuality = s.quality;
      }
    }
    for (const b of readDiaryEntries<{ date?: string; pulse?: number }>(BP_DIARY_KEY)) {
      const m = ensure(b.date || '');
      if (m && created.has(b.date || '') && typeof b.pulse === 'number' && b.pulse > 0) m.restingHR = b.pulse;
    }
    if (created.size > 0) {
      const merged = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
      localStorage.setItem(METRICS_KEY, JSON.stringify(merged));
    }
    return created.size;
  } catch { return 0; }
}

/** Записать чек-ин в дневники профиля: вес → he_weight_log, сон → he_sleep_diary,
 *  пульс → he_bp_diary. Записи обновляются (upsert по дате), существующие поля
 *  (замеры/пробуждения/АД) сохраняются. Возвращает, какие дневники затронуты. */
export function pushToProfileDiaries(m: DailyMetrics): { weight: boolean; sleep: boolean; bp: boolean } {
  const out = { weight: false, sleep: false, bp: false };
  try {
    if (m.weightKg > 0) {
      const log = getWeightLog();
      const idx = log.findIndex(e => e.date === m.date);
      const merged: WeightEntry = idx >= 0
        ? { ...log[idx], weight: m.weightKg }
        : { date: m.date, weight: m.weightKg };
      saveWeightLog([...log.filter((_, i) => i !== idx), merged]);
      out.weight = true;
    }
    if (m.sleepHours > 0) {
      const diary = readDiaryEntries<{ date: string; hours?: number; quality?: number }>(SLEEP_DIARY_KEY);
      const idx = diary.findIndex(e => e && e.date === m.date);
      const entry = { ...(idx >= 0 ? diary[idx] : {}), date: m.date, hours: m.sleepHours };
      if (m.sleepQuality > 0) entry.quality = m.sleepQuality;
      if (idx >= 0) diary[idx] = entry; else diary.push(entry);
      localStorage.setItem(SLEEP_DIARY_KEY, JSON.stringify(diary));
      out.sleep = true;
    }
    if (m.restingHR > 0) {
      const bp = readDiaryEntries<{ date: string; pulse?: number }>(BP_DIARY_KEY);
      const idx = bp.findIndex(e => e && e.date === m.date);
      const entry = { ...(idx >= 0 ? bp[idx] : {}), date: m.date, pulse: m.restingHR };
      if (idx >= 0) bp[idx] = entry; else bp.push(entry);
      localStorage.setItem(BP_DIARY_KEY, JSON.stringify(bp));
      out.bp = true;
    }
  } catch { /* ignore */ }
  return out;
}
