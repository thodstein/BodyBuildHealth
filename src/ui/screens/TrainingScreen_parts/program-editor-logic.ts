/**
 * program-editor-logic.ts — чистые функции бизнес-логики редактора программ.
 *
 * Выделено из ProgramEditorComponents.tsx для изолированного тестирования.
 * Все функции не зависят от React и DOM, работают с чистыми данными.
 */
import type { UserWeek, UserBlock, UserSession, UserSet } from '../../../engines/user-program/user-program.types';
import type { TrainingProfile } from './training-profile';
import { newId } from '../../../engines/user-program/user-program.types';
import {
  muscleAwareSets,
  makeSetsFromTemplate,
  suggestExercisesForGroup,
} from '../../../engines/manual-constructor';

export interface AddWeakToWeekOptions {
  weeks: UserWeek[];
  muscle: string;
  level: string;
  profile: TrainingProfile;
  maxExercisesPerWeek?: number; // сколько упражнений добавлять (по умолчанию 2)
  sessionIndex?: number;        // в какую сессию добавлять (по умолчанию 0)
}

/**
 * Добавить упражнения для слабой группы во все недели (кроме deload).
 * Возвращает новый массив недель с добавленными блоками.
 * Каждый блок получает уникальный id (newId).
 */
export function addWeakToWeekLogic(opts: AddWeakToWeekOptions): UserWeek[] {
  const {
    weeks,
    muscle,
    level,
    profile,
    maxExercisesPerWeek = 2,
    sessionIndex = 0,
  } = opts;

  const equipment = (profile.equipment ?? []) as string[];
  const weakPoints = (profile.weakPoints ?? []) as string[];
  const avoidAxialLoad = profile.avoidAxialLoad ?? false;
  const favoriteExercises = (profile.favoriteExercises ?? []) as string[];
  const excludedExercises = (profile.excludedExercises ?? []) as string[];
  const workMax = profile.workMax ?? {};

  const recs = suggestExercisesForGroup(
    muscle,
    level,
    maxExercisesPerWeek,
    equipment,
    weakPoints,
    [],
    avoidAxialLoad,
    favoriteExercises,
    excludedExercises,
  );
  if (recs.length === 0) return weeks;

  const makeBlocks = (): UserBlock[] =>
    recs.slice(0, maxExercisesPerWeek).map((r) => ({
      id: newId('blk'),
      type: 'accessory' as const,
      exerciseName: r.name,
      muscle,
      role: 'accessory' as const,
      sets: makeSetsFromTemplate(
        muscleAwareSets(muscle, level),
        (workMax as Record<string, number>)[muscle] ?? 40,
      ),
    }));

  return weeks.map((w) =>
    w.deload
      ? w
      : {
          ...w,
          sessions: w.sessions.map((s, si) =>
            si === sessionIndex ? { ...s, blocks: [...s.blocks, ...makeBlocks()] } : s,
          ),
        },
  );
}

/**
 * Вычислить рабочий вес по проценту от 1ПМ.
 * Для подсобных упражнений (accessory) возвращает null — вес вводится вручную.
 */
export function calcW(
  pct: number,
  lift: 'squat' | 'bench' | 'dead' | 'accessory',
  workMax: Record<string, number>,
): number | null {
  if (lift === 'accessory') return null;
  const pm = workMax[lift];
  if (!pm || pm <= 0) return null;
  return Math.round((pm * pct) / 2.5) * 2.5;
}

/**
 * Проверить, что все блоки в массиве недель имеют уникальные id.
 */
export function allBlockIdsUnique(weeks: UserWeek[]): boolean {
  const ids = new Set<string>();
  for (const w of weeks) {
    for (const s of w.sessions) {
      for (const b of s.blocks) {
        if (ids.has(b.id)) return false;
        ids.add(b.id);
      }
    }
  }
  return true;
}

/**
 * Обычный прогрессивный расчёт веса для клонирования недели.
 */
export function cloneWeekProgression(weight: number, factor = 1.025): number {
  if (weight <= 0) return weight;
  return Math.round(weight * factor / 2.5) * 2.5;
}
