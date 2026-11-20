/**
 * set-intensity.engine.ts — насколько подход близок к личному пределу.
 *
 * Абсолютный вес сам по себе ничего не говорит об усилии: 80 кг для одного —
 * разминка, для другого — работа на пределе. Поэтому e1RM подхода (Epley)
 * сравниваем с лучшим e1RM этого же упражнения в истории и получаем
 * интенсивность в процентах. На этом строится подсказка прямо в подходе:
 * «82% от лучшего 120 кг», а при превышении — предупреждение о рекорде ДО того,
 * как подход записан.
 */

import { epley1RM } from './e1rm';

/** Минимально нужные поля сессии: движок не зависит от типа дневника. */
export interface IntensitySession {
  date: string;
  exercises?: {
    exerciseName: string;
    sets?: { weightKg: number; reps: number }[];
  }[];
}

export interface ExerciseBest {
  /** Лучший e1RM за историю, кг (целое). */
  e1rm: number;
  /** Вес и повторы подхода, который дал этот e1RM. */
  weight: number;
  reps: number;
  /** Дата той тренировки (YYYY-MM-DD). */
  date: string;
}

export type IntensityZone = 'unknown' | 'light' | 'working' | 'near_max' | 'max' | 'record';

export interface SetIntensity {
  /** e1RM самого подхода, кг. */
  e1rm: number;
  /** Лучший e1RM упражнения в истории или null, если истории нет. */
  bestE1RM: number | null;
  /** Интенсивность в % от лучшего e1RM (одна десятая). null — не с чем сравнивать. */
  pct: number | null;
  /** Отличие от лучшего e1RM в %: +2.5 значит «на 2.5% выше личного лучшего». */
  deltaPct: number | null;
  /** Подход бьёт лучший e1RM упражнения. */
  isRecord: boolean;
  zone: IntensityZone;
  label: string;
  color: string;
}

/**
 * Ключ упражнения для сравнения: регистр, лишние пробелы и пунктуация не
 * должны превращать «Жим лёжа» и «жим лёжа » в разные движения.
 */
export function normalizeExerciseName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:()\[\]"'`«»]/g, '')
    .trim();
}

/**
 * Лучший e1RM по каждому упражнению за период. Нулевые и мусорные подходы
 * пропускаются: «вес 0 × 20» — это не рекорд.
 */
export function collectExerciseBests(sessions: IntensitySession[]): Map<string, ExerciseBest> {
  const out = new Map<string, ExerciseBest>();
  for (const s of sessions || []) {
    const date = String(s?.date || '');
    for (const ex of s?.exercises || []) {
      const key = normalizeExerciseName(ex?.exerciseName || '');
      if (!key) continue;
      for (const st of ex?.sets || []) {
        const weight = Number(st?.weightKg);
        const reps = Number(st?.reps);
        if (!Number.isFinite(weight) || !Number.isFinite(reps)) continue;
        const e1rm = epley1RM(weight, reps);
        if (e1rm <= 0) continue;
        const prev = out.get(key);
        // При равном e1RM оставляем более позднюю дату: актуальный вес важнее.
        if (!prev || e1rm > prev.e1rm || (e1rm === prev.e1rm && date > prev.date)) {
          out.set(key, { e1rm, weight, reps, date });
        }
      }
    }
  }
  return out;
}

export const INTENSITY_ZONE_COLOR: Record<IntensityZone, string> = {
  unknown: '#94a3b8',
  light: '#94a3b8',
  working: '#60a5fa',
  near_max: '#f59e0b',
  max: '#f97316',
  record: '#00e68a',
};

const ZONE_LABEL: Record<IntensityZone, string> = {
  unknown: 'нет истории',
  light: 'объёмная',
  working: 'рабочая',
  near_max: 'около предела',
  max: 'предел',
  record: 'выше личного лучшего',
};

export function intensityZoneOf(pct: number | null, isRecord = false): IntensityZone {
  if (pct === null) return 'unknown';
  // Рекорд — только строго выше личного лучшего: ровно 100% это повторение
  // лучшего подхода, а не новый рекорд.
  if (isRecord) return 'record';
  if (pct >= 90) return 'max';
  if (pct >= 80) return 'near_max';
  if (pct >= 60) return 'working';
  return 'light';
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Интенсивность конкретного подхода относительно личного лучшего e1RM.
 * Без истории возвращает zone 'unknown' и null вместо процентов — UI должен
 * честно молчать, а не показывать 0%.
 */
export function setIntensity(weight: number, reps: number, best: ExerciseBest | null | undefined): SetIntensity {
  const e1rm = epley1RM(Number(weight), Number(reps));
  const bestE1RM = best && best.e1rm > 0 ? best.e1rm : null;
  if (e1rm <= 0 || bestE1RM === null) {
    return {
      e1rm, bestE1RM,
      pct: null, deltaPct: null, isRecord: false,
      zone: 'unknown', label: ZONE_LABEL.unknown, color: INTENSITY_ZONE_COLOR.unknown,
    };
  }
  const raw = (e1rm / bestE1RM) * 100;
  const pct = round1(raw);
  const isRecord = e1rm > bestE1RM;
  const zone = intensityZoneOf(pct, isRecord);
  return {
    e1rm, bestE1RM,
    pct,
    deltaPct: round1(raw - 100),
    isRecord,
    zone,
    label: ZONE_LABEL[zone],
    color: INTENSITY_ZONE_COLOR[zone],
  };
}

/**
 * Кандидат на рекорд внутри текущей тренировки: подход выше и личного лучшего
 * из истории, и всего, что уже записано в этой сессии. Один и тот же подход
 * второй раз рекордом не считается.
 */
export function isRecordCandidate(
  weight: number,
  reps: number,
  best: ExerciseBest | null | undefined,
  sessionBestE1RM = 0,
): boolean {
  const e1rm = epley1RM(Number(weight), Number(reps));
  if (e1rm <= 0) return false;
  const history = best && best.e1rm > 0 ? best.e1rm : 0;
  return e1rm > Math.max(history, sessionBestE1RM);
}
