/**
 * sleep-facts.engine.ts — факты сна из дневника (he_sleep_diary).
 * Чистые функции: эффективность, регулярность, джетлаг, долг сна,
 * автоподсчёт часов из режима, рекомендация времени отбоя.
 * + syncSleepToProfile: 7-дневное среднее → lifestyle.sleepHours (единый источник).
 */
import { getProfile, updateProfile } from '../core/profile-manager';

export interface SleepDiaryEntry {
  date: string;
  hours?: number;
  quality?: number; // 1..5
  awakenings?: number;
  bedtime?: string; // HH:MM
  wakeTime?: string; // HH:MM
  latency?: number; // мин
  alcohol?: boolean;
  screenTime?: number; // мин
  stressLevel?: number; // 1..10
  caffeineCutoff?: string;
  notes?: string;
}

/* ── Время ─────────────────────────────────────────────────────────────── */

/** 'HH:MM' → минуты от полуночи (null — невалидно). */
export const parseTimeHHMM = (t?: string): number | null => {
  if (!t || typeof t !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

/** Продолжительность сна по режиму (часы), с пересечением полуночи. */
export const sleepDurationFromTimes = (bedtime?: string, wakeTime?: string): number | null => {
  const b = parseTimeHHMM(bedtime);
  const w = parseTimeHHMM(wakeTime);
  if (b === null || w === null) return null;
  const minutes = (w - b + 1440) % 1440;
  if (minutes === 0) return null;
  return minutes / 60;
};

const formatHHMM = (minutes: number): string => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Во сколько лечь, чтобы встать в wakeTime при цели targetHours (HH:MM). */
export const recommendedBedtime = (wakeTime: string, targetHours: number): string | null => {
  const w = parseTimeHHMM(wakeTime);
  if (w === null || !Number.isFinite(targetHours) || targetHours <= 0) return null;
  return formatHHMM(w - targetHours * 60);
};

/* ── Эффективность ─────────────────────────────────────────────────────── */

/** Эффективность сна % = часы / время в кровати × 100 (0..100). */
export const computeSleepEfficiency = (e: SleepDiaryEntry): number | null => {
  const hours = Number(e.hours);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const inBed = sleepDurationFromTimes(e.bedtime, e.wakeTime);
  if (inBed === null || inBed <= 0) return null;
  const eff = (hours / inBed) * 100;
  return Math.round(Math.min(100, Math.max(0, eff)) * 10) / 10;
};

/** Средняя эффективность по записям (сверху вниз по дате, максимум maxEntries). */
export const avgSleepEfficiency = (entries: SleepDiaryEntry[], maxEntries = 30): number | null => {
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, maxEntries);
  const vals = recent.map(computeSleepEfficiency).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
};

/* ── Долг сна ──────────────────────────────────────────────────────────── */

/** Суммарный недобор сна за последние N календарных дней (только дни с записью). */
export const cumulativeSleepDebt = (
  entries: SleepDiaryEntry[],
  targetHours: number,
  days: number,
): { debt: number; recordedDays: number } => {
  if (!Number.isFinite(targetHours) || targetHours <= 0) return { debt: 0, recordedDays: 0 };
  const byDate = new Map<string, number>();
  for (const e of entries) {
    const h = Number(e.hours);
    if (e.date && Number.isFinite(h)) byDate.set(e.date, h);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let debt = 0;
  let recordedDays = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const h = byDate.get(key);
    if (h === undefined) continue;
    recordedDays += 1;
    debt += Math.max(0, targetHours - h);
  }
  return { debt: Math.round(debt * 10) / 10, recordedDays };
};

/* ── Регулярность режима ───────────────────────────────────────────────── */

const circularStdMin = (minutes: number[]): number => {
  const n = minutes.length;
  let sx = 0;
  let sy = 0;
  for (const m of minutes) {
    const a = (m / 1440) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const R = Math.sqrt(sx * sx + sy * sy) / n;
  const stdRad = Math.sqrt(-2 * Math.log(Math.max(R, 1e-9)));
  return Math.min(720, Math.round((stdRad / (2 * Math.PI)) * 1440));
};

/**
 * Регулярность режима за окно: σ отбоя/подъёма (круговое СКО, минуты)
 * и социальный джетлаг |midSleep будни − выходные| (минуты).
 */
export const computeSleepRegularity = (
  entries: SleepDiaryEntry[],
  windowDays = 14,
): { bedtimeStdMin: number; wakeStdMin: number; jetlagMin: number | null; samples: number } | null => {
  const cutoff = Date.now() - windowDays * 86400000;
  const beds: number[] = [];
  const wakes: number[] = [];
  const mids: { min: number; weekend: boolean }[] = [];
  for (const e of entries) {
    const t = Date.parse(e.date);
    if (!Number.isFinite(t) || t < cutoff) continue;
    const b = parseTimeHHMM(e.bedtime);
    const w = parseTimeHHMM(e.wakeTime);
    if (b === null || w === null) continue;
    beds.push(b);
    wakes.push(w);
    const dur = (w - b + 1440) % 1440;
    if (dur > 0) {
      const mid = (b + dur / 2) % 1440;
      const dow = new Date(t).getDay();
      mids.push({ min: mid, weekend: dow === 0 || dow === 6 });
    }
  }
  if (beds.length < 2) return null;
  const work = mids.filter((m) => !m.weekend).map((m) => m.min);
  const free = mids.filter((m) => m.weekend).map((m) => m.min);
  let jetlagMin: number | null = null;
  if (work.length >= 1 && free.length >= 1) {
    const avg = (arr: number[]) => {
      let sx = 0;
      let sy = 0;
      for (const m of arr) {
        const a = (m / 1440) * 2 * Math.PI;
        sx += Math.cos(a);
        sy += Math.sin(a);
      }
      const meanA = Math.atan2(sy, sx);
      return ((meanA / (2 * Math.PI)) * 1440 + 1440) % 1440;
    };
    const diff = Math.abs(avg(work) - avg(free));
    jetlagMin = Math.round(Math.min(diff, 1440 - diff));
  }
  return {
    bedtimeStdMin: circularStdMin(beds),
    wakeStdMin: circularStdMin(wakes),
    jetlagMin,
    samples: beds.length,
  };
};

/* ── Сводные факты для интеграции (readiness, билдеры, синк) ──────────── */

export interface SleepFacts {
  hasData: boolean;
  recentDays: number; // дней с записью за 7 календарных дней
  avgHours7: number | null;
  avgQuality7: number | null; // 1..5
  avgAwakenings7: number | null;
  lastNightHours: number | null;
  lastNightQuality: number | null; // 1..5
  lastNightAwakenings: number | null;
  lastNightDate: string | null;
  lastBedtime: string | null;
  lastWakeTime: string | null;
  efficiency30: number | null;
  debt7: number | null;
  debt30: number | null;
  targetHours: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export const computeSleepFacts = (entries: SleepDiaryEntry[], targetHours: number): SleepFacts => {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = dayKey(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yestKey = dayKey(yest);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoKey = dayKey(weekAgo);

  const recent7 = sorted.filter((e) => e.date >= weekAgoKey && e.date <= todayKey);
  const recentDays = new Set(recent7.map((e) => e.date)).size;
  const mean = (vals: number[]) => (vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null);

  const hours7 = recent7.map((e) => Number(e.hours)).filter((v) => Number.isFinite(v));
  const quality7 = recent7.map((e) => Number(e.quality)).filter((v) => Number.isFinite(v) && v > 0);
  const awak7 = recent7.map((e) => Number(e.awakenings)).filter((v) => Number.isFinite(v));

  const lastNight = sorted.find((e) => e.date === todayKey || e.date === yestKey) ?? null;

  const debt7 = cumulativeSleepDebt(entries, targetHours, 7);
  const debt30 = cumulativeSleepDebt(entries, targetHours, 30);

  return {
    hasData: entries.length > 0,
    recentDays,
    avgHours7: hours7.length ? round1(mean(hours7)!) : null,
    avgQuality7: quality7.length ? round1(mean(quality7)!) : null,
    avgAwakenings7: awak7.length ? round1(mean(awak7)!) : null,
    lastNightHours: lastNight && Number.isFinite(Number(lastNight.hours)) ? Number(lastNight.hours) : null,
    lastNightQuality: lastNight && Number.isFinite(Number(lastNight.quality)) && Number(lastNight.quality) > 0 ? Number(lastNight.quality) : null,
    lastNightAwakenings: lastNight && Number.isFinite(Number(lastNight.awakenings)) ? Number(lastNight.awakenings) : null,
    lastNightDate: lastNight?.date ?? null,
    lastBedtime: lastNight?.bedtime ?? null,
    lastWakeTime: lastNight?.wakeTime ?? null,
    efficiency30: avgSleepEfficiency(entries, 30),
    debt7: debt7.recordedDays ? debt7.debt : null,
    debt30: debt30.recordedDays ? debt30.debt : null,
    targetHours,
  };
};

/** Качество сна 1..5 → шкала 0..10 (для readiness). */
export const qualityTo10 = (q: number | null | undefined): number | null =>
  q !== null && q !== undefined && Number.isFinite(Number(q)) ? Math.min(10, Math.max(1, Number(q) * 2)) : null;

/* ── Профиль-синк: дневник = источник истины для lifestyle.sleepHours ──── */

/** Пишет 7-дневное среднее сна из дневника в профиль (если есть данные). */
export function syncSleepToProfile(entries: SleepDiaryEntry[]): void {
  if (!Array.isArray(entries) || entries.length === 0) return;
  try {
    const facts = computeSleepFacts(entries, 8);
    if (facts.avgHours7 === null) return;
    const profile = getProfile();
    const lifestyle = (profile.settings?.lifestyle ?? {}) as Record<string, unknown>;
    const current = Number(lifestyle.sleepHours);
    if (Number.isFinite(current) && Math.abs(current - facts.avgHours7) < 0.05) return;
    updateProfile({
      settings: {
        ...(profile.settings || {}),
        lifestyle: { ...(profile.settings?.lifestyle || {}), sleepHours: facts.avgHours7 },
      },
    });
  } catch (e) {
    console.warn('syncSleepToProfile failed:', e);
  }
}
