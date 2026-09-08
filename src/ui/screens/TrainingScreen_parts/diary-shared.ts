/**
 * diary-shared.ts — общие хелперы форм записи дневника тренировок.
 * Единый источник для поиска прошлых данных упражнения и PR
 * (устраняет дублирование между QuickEntry и DiaryRecordingForm).
 */
import { epley1RM } from '../../../engines/e1rm';
import { exerciseMatchScore, getAliasesForExercise } from '../../../engines/exercise-aliases';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';
import { LEVEL_VOLUMES } from '../../../engines/training.engine';
import { GRP_RU } from './diary-tokens';
import type { WorkoutLog } from '../../../core/types';

export interface PrevWorkoutData {
  weight: number;
  reps: number;
  rir: number;
  date?: string;
}

/** Лучшая прошлая сессия упражнения (по e1RM) из истории тренировок. */
export function getPreviousWorkoutData(historyWorkouts: WorkoutLog[], exerciseName: string): PrevWorkoutData | null {
  let best: { weight: number; reps: number; rir: number; date?: string; e1rm: number } | null = null;
  for (const wl of historyWorkouts) {
    // legacy-записи могут не иметь exercises или иметь не-массив (например, {}) — не роняем форму
    const wlExercises = Array.isArray(wl.exercises) ? wl.exercises : [];
    for (const ex of wlExercises) {
      const score = exerciseMatchScore(ex.exerciseName, exerciseName);
      if (score >= 0.5) {
        for (const set of ex.sets || []) {
          const e1rm = epley1RM(set.weight, set.reps);
          if (!best || e1rm > best.e1rm) {
            best = { weight: set.weight, reps: set.reps, rir: set.rir || 2, date: wl.date, e1rm };
          }
        }
      }
    }
  }
  return best ? { weight: best.weight, reps: best.reps, rir: best.rir, date: best.date } : null;
}

export interface PersonalRecord {
  weight: number;
  reps: number;
  e1rm: number;
}

/** Личный рекорд (лучший e1RM) по упражнению из истории. */
export function getPersonalRecord(historyWorkouts: WorkoutLog[], exerciseName: string): PersonalRecord | null {
  let best: { weight: number; reps: number; e1rm: number } | null = null;
  for (const wl of historyWorkouts) {
    for (const ex of Array.isArray(wl.exercises) ? wl.exercises : []) {
      const score = exerciseMatchScore(ex.exerciseName, exerciseName);
      if (score >= 0.5) {
        for (const set of ex.sets || []) {
          const e1rm = epley1RM(set.weight, set.reps);
          if (!best || e1rm > best.e1rm) {
            best = { weight: set.weight, reps: set.reps, e1rm };
          }
        }
      }
    }
  }
  return best;
}

/* ─── Единый поиск каталога + сиды нового упражнения ───
 * Общий источник для QuickEntry и DiaryRecordingForm (было два расходящихся
 * фильтра; групповой фильтр «Грудь/Спина/…» в подробной форме гас, т.к. эффект
 * поиска перезатирал вручную подставленный список пустым совпадением по имени). */

type CatalogEntry = (typeof EXERCISE_CATALOG)[number];

/** RU-метка группы → id группы каталога (плюс сам id: 'chest', 'quads'…). */
function groupIdForQuery(q: string): string | null {
  const direct = GROUP_ALIASES[q];
  if (direct) return direct;
  for (const [id, label] of Object.entries(GRP_RU)) {
    if (q === label.toLowerCase() || q === id.toLowerCase()) return GROUP_ALIASES[id] || id;
  }
  return null;
}

/** Семейство «ноги»: в каталоге разбито на quads/hamstrings/glutes/calves/legs. */
const LEG_FAMILY = ['legs', 'quads', 'hamstrings', 'glutes', 'calves'];

/**
 * Гранулярные группы специализации → грубые группы каталога
 * (в каталоге нет 'biceps'/'quads' — только 'arms'/'legs', иначе фильтр пуст).
 */
const GROUP_ALIASES: Record<string, string> = {
  biceps: 'arms',
  triceps: 'arms',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
};

function catalogNameHit(ex: CatalogEntry, q: string): boolean {
  const name = ((ex as { name?: string }).name || '').toLowerCase();
  const id = ((ex as { id?: string }).id || '').toLowerCase();
  if (name.includes(q) || (id && id.includes(q))) return true;
  try {
    return getAliasesForExercise((ex as { id: string }).id).some(a => a.toLowerCase().includes(q));
  } catch {
    return false;
  }
}

/**
 * Единый поиск упражнений по каталогу: имя/id/алиасы + метки групп («грудь» →
 * вся группа груди первой). Запрос-группа возвращает до 30 записей, обычный —
 * до `limit`. Пустой запрос → [].
 */
export function searchExerciseCatalog(query: string, limit = 8): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // «Ноги» — семейство групп каталога, а не одна группа.
  if (q === 'ноги' || q === 'legs') {
    return EXERCISE_CATALOG.filter(e => LEG_FAMILY.includes((e as { group?: string }).group || '')).slice(0, 30);
  }
  const groupId = groupIdForQuery(q);
  if (groupId) {
    const inGroup = EXERCISE_CATALOG.filter(e => (e as { group?: string }).group === groupId);
    const rest = EXERCISE_CATALOG.filter(e => (e as { group?: string }).group !== groupId && catalogNameHit(e, q));
    return [...inGroup, ...rest].slice(0, 30);
  }
  return EXERCISE_CATALOG.filter(e => catalogNameHit(e, q)).slice(0, limit);
}

export interface NewExerciseSeed {
  weight: number;
  reps: number;
  rir: number;
}

/**
 * Стартовые вес/повторы/RIR для ДОБАВЛЯЕМОГО упражнения — из ЕГО истории
 * (не из текущего выбранного: иначе второе упражнение наследовало вес первого).
 */
export function seedForNewExercise(
  historyWorkouts: WorkoutLog[],
  exerciseName: string,
  isBodyweight: boolean,
): NewExerciseSeed {
  const prev = getPreviousWorkoutData(historyWorkouts, exerciseName);
  return {
    weight: isBodyweight ? 0 : (prev?.weight || 0),
    reps: prev?.reps || 10,
    rir: prev?.rir ?? 2,
  };
}

/**
 * Базовый MRV-порог (сеты/нед на группу) для алерта перетренированности.
 * enhanced едет на базе advanced (фарма-надбавка идёт множителем onCourse),
 * неизвестный уровень — 20. onCourse ×1.2. Гард от пустого профиля.
 */
export function mrvBaseForLevel(level: string, onCourse: boolean): number {
  const key = level === 'enhanced' ? 'advanced' : level;
  const base = (LEVEL_VOLUMES as Record<string, { mrv: number } | undefined>)[key]?.mrv ?? 20;
  return base * (onCourse ? 1.2 : 1);
}

/**
 * Локальная дата YYYY-MM-DD (без UTC-сдвига: toISOString даёт вчерашний день
 * для UTC+3…+12 около полуночи — «сегодня» и ключи дневников уезжали).
 */
export function localIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Лучший e1RM по тренировкам недели (хронология) — для спарклайна шапки
 * week-карточки. Раньше все карточки показывали одну глобальную серию.
 */
export function bestE1rmSeriesForWeek(workouts: WorkoutLog[]): number[] {
  const sorted = [...workouts].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const series: number[] = [];
  for (const w of sorted) {
    let best = 0;
    for (const ex of (Array.isArray(w.exercises) ? w.exercises : []) as { estimated1RM?: number }[]) {
      if ((ex.estimated1RM || 0) > best) best = ex.estimated1RM || 0;
    }
    series.push(Math.round(best));
  }
  return series;
}
