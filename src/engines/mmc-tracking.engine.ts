/**
 * mmc-tracking.engine.ts — MMC/Pump/Joint/Energy трекинг в дневнике.
 *
 * Расширяет WorkoutSet четырьмя полями: mindMuscleConnection, pump, jointDiscomfort, energy.
 * Сохраняется в localStorage('he_mmc_log').
 * Предоставляет функции для записи, статистики и визуализации трендов.
 */

export interface MMCSetEntry {
  date: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  mmc: number;  // 1-10 (mind-muscle connection)
  pump: number; // 1-10
  jointDiscomfort: number; // 0-10 (0 = нет, 10 = невыносимо)
  energy: number; // 1-10
  notes?: string;
}

export interface MMCAggregate {
  exerciseName: string;
  avgMmc: number;
  avgPump: number;
  avgJointDiscomfort: number;
  avgEnergy: number;
  totalSets: number;
  trend: 'improving' | 'declining' | 'stable';
}

const KEY = 'he_mmc_log';
const MAX_ENTRIES = 2000;

export function recordMMC(entry: MMCSetEntry): void {
  try {
    const raw = localStorage.getItem(KEY);
    const log: MMCSetEntry[] = raw ? JSON.parse(raw) : [];
    log.push(entry);
    if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

export function loadMMCLog(): MMCSetEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function clearMMCLog(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Частичный ввод MMC (не все поля обязательны). */
export interface MMCPartial {
  mmc?: number;
  pump?: number;
  jointDiscomfort?: number;
  energy?: number;
}

/** Есть ли хоть одно заполненное поле. */
export function hasMMCValues(p: MMCPartial | undefined | null): boolean {
  if (!p) return false;
  return p.mmc !== undefined || p.pump !== undefined || p.jointDiscomfort !== undefined || p.energy !== undefined;
}

const clampTo10 = (v: number | undefined, def: number): number => {
  if (v === undefined || Number.isNaN(v)) return def;
  return Math.min(10, Math.max(0, v));
};

const entryKey = (e: Pick<MMCSetEntry, 'date' | 'exerciseName' | 'setNumber'>) =>
  `${e.date}|${e.exerciseName}|${e.setNumber}`;

/**
 * Записать частичные MMC-значения с дефолтами для незаполненных (ммс/пампинг/энергия = 5, суставы = 0).
 * Upsert: повторная запись для той же (дата + упражнение + подход) заменяет старую, а не дублирует.
 * Возвращает true, если запись создана/обновлена; false — если ввод пуст.
 */
export function recordMMCFromPartial(
  date: string,
  exerciseId: string,
  exerciseName: string,
  setNumber: number,
  p: MMCPartial | undefined | null,
): boolean {
  if (!hasMMCValues(p)) return false;
  const entry: MMCSetEntry = {
    date,
    exerciseId,
    exerciseName,
    setNumber,
    mmc: clampTo10(p!.mmc, 5),
    pump: clampTo10(p!.pump, 5),
    jointDiscomfort: clampTo10(p!.jointDiscomfort, 0),
    energy: clampTo10(p!.energy, 5),
  };
  try {
    const raw = localStorage.getItem(KEY);
    const log: MMCSetEntry[] = raw ? JSON.parse(raw) : [];
    const key = entryKey(entry);
    const idx = log.findIndex(e => entryKey(e) === key);
    if (idx >= 0) log[idx] = entry; else log.push(entry);
    if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch { return false; }
  return true;
}

/**
 * Слить записи из другого источника (бэкап/импорт) в лог без дублей
 * (дедуп по дата + упражнение + подход). Возвращает число добавленных.
 */
export function mergeMMCLog(entries: MMCSetEntry[] | undefined | null): number {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  try {
    const log = loadMMCLog();
    const existing = new Set(log.map(entryKey));
    const fresh = entries.filter(e => e && e.date && e.exerciseName && !existing.has(entryKey(e)));
    if (fresh.length === 0) return 0;
    const merged = [...log, ...fresh];
    if (merged.length > MAX_ENTRIES) merged.splice(0, merged.length - MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(merged));
    return fresh.length;
  } catch { return 0; }
}

/** Агрегировать по упражнению */
export function aggregateMMC(exerciseName?: string): MMCSetEntry[] | MMCAggregate[] {
  const log = loadMMCLog();
  if (!log.length) return [];

  if (exerciseName) {
    return log.filter(e => e.exerciseName === exerciseName);
  }

  const byExercise = new Map<string, MMCSetEntry[]>();
  for (const e of log) {
    if (!byExercise.has(e.exerciseName)) byExercise.set(e.exerciseName, []);
    byExercise.get(e.exerciseName)!.push(e);
  }

  const result: MMCAggregate[] = [];
  for (const [name, entries] of byExercise) {
    const sorted = entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const avg = (arr: MMCSetEntry[], key: keyof MMCSetEntry) => {
      if (typeof arr[0][key] !== 'number') return 0;
      const vals = arr.map(e => e[key] as number);
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10) / 10;
    };
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);
    const trendFirst = avg(firstHalf, 'mmc');
    const trendSecond = avg(secondHalf, 'mmc');
    const trend = trendSecond > trendFirst + 0.5 ? 'improving' : trendSecond < trendFirst - 0.5 ? 'declining' : 'stable';

    result.push({
      exerciseName: name,
      avgMmc: avg(sorted, 'mmc'),
      avgPump: avg(sorted, 'pump'),
      avgJointDiscomfort: avg(sorted, 'jointDiscomfort'),
      avgEnergy: avg(sorted, 'energy'),
      totalSets: sorted.length,
      trend,
    });
  }

  return result.sort((a, b) => b.totalSets - a.totalSets);
}

/** Рекомендации на основе MMC-данных */
export function getMMCRecommendations(aggregates: MMCAggregate[]): string[] {
  const recs: string[] = [];

  for (const a of aggregates) {
    if (a.avgJointDiscomfort > 6 && a.totalSets >= 3) {
      recs.push(`⚠ ${a.exerciseName}: высокий дискомфорт в суставах (${a.avgJointDiscomfort}/10). Заменить или снизить нагрузку.`);
    }
    if (a.avgMmc < 4 && a.totalSets >= 3) {
      recs.push(`💡 ${a.exerciseName}: слабая MMC (${a.avgMmc}/10). Попробуйте замедлить темп, добавить изоляцию перед базой.`);
    }
    if (a.trend === 'declining' && a.totalSets >= 5) {
      recs.push(`📉 ${a.exerciseName}: MMC снижается (${a.avgMmc}/10). Возможно, перетренированность или усталость ЦНС.`);
    }
  }

  if (aggregates.length > 0) {
    const avgEnergy = aggregates.reduce((s, a) => s + a.avgEnergy, 0) / aggregates.length;
    if (avgEnergy < 4) {
      recs.push(`🔋 Средняя энергия ${avgEnergy.toFixed(1)}/10 — низкая. Рекомендуется делод или увеличение восстановления.`);
    }
  }

  return recs.length > 0 ? recs : ['✅ MMC-показатели в норме'];
}
