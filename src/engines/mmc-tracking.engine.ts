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
