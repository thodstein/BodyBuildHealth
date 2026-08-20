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

export const TRAINING_DAY_ORDER = [0, 2, 4, 1, 3, 5, 6] as const;

export function trainingDayForIndex(index: number): number {
  return TRAINING_DAY_ORDER[((index % TRAINING_DAY_ORDER.length) + TRAINING_DAY_ORDER.length) % TRAINING_DAY_ORDER.length];
}

export function sessionDayOfWeek(session: Pick<UserSession, 'dayOfWeek'>, index: number): number {
  return Number.isInteger(session.dayOfWeek) && session.dayOfWeek! >= 0 && session.dayOfWeek! <= 6
    ? session.dayOfWeek!
    : trainingDayForIndex(index);
}

/** Рекомендованный день недели для сессии (по индексу в неделе) — стандартная раскладка Пн/Ср/Пт/Вт/Чт/Сб/Вс. */
export function recommendedDayForIndex(index: number): number {
  return trainingDayForIndex(index);
}

/** Сессия стоит на своём рекомендованном дне недели? */
export function sessionUsesRecommendedDay(session: Pick<UserSession, 'dayOfWeek'>, index: number): boolean {
  return sessionDayOfWeek(session, index) === trainingDayForIndex(index);
}

/**
 * Перенести сессию (по индексу) на новый день недели во ВСЕХ неделях программы —
 * шаблон недели повторяется для всех мезоциклов. Невалидный день → рекомендация.
 */
export function moveWeekScheduleDay(weeks: UserWeek[], sessionIdx: number, day: number): UserWeek[] {
  const d = Number.isInteger(day) && day >= 0 && day <= 6 ? day : trainingDayForIndex(sessionIdx);
  return weeks.map(w =>
    sessionIdx < 0 || sessionIdx >= w.sessions.length
      ? w
      : { ...w, sessions: w.sessions.map((s, i) => (i === sessionIdx ? { ...s, dayOfWeek: d } : s)) },
  );
}

/** Вернуть всем неделям рекомендованные дни недели (Пн/Ср/Пт/Вт/Чт/Сб/Вс по индексу сессии). */
export function resetScheduleToRecommended(weeks: UserWeek[]): UserWeek[] {
  return weeks.map(w => ({
    ...w,
    sessions: w.sessions.map((s, i) => ({ ...s, dayOfWeek: trainingDayForIndex(i) })),
  }));
}

export function firstFreeTrainingDay(sessions: Array<Pick<UserSession, 'dayOfWeek'>>): number {
  const used = new Set(sessions.map((session, index) => sessionDayOfWeek(session, index)));
  return TRAINING_DAY_ORDER.find(day => !used.has(day)) ?? trainingDayForIndex(sessions.length);
}

/** Resize a week's session list without replacing existing user content. */
export function resizeTrainingSessions(sessions: UserSession[], target: number, deload = false): UserSession[] {
  const count = Math.max(1, Math.min(7, Math.round(target)));
  const result = [...sessions];
  while (result.length < count) {
    const dayNumber = result.length + 1;
    result.push({
      id: newId('ses'),
      name: deload ? `Разгрузка ${dayNumber}` : `День ${dayNumber}`,
      dayOfWeek: firstFreeTrainingDay(result),
      focus: deload ? 'deload' : '',
      blocks: deload ? [{
        id: newId('blk'),
        type: 'accessory',
        exerciseName: '',
        muscle: '',
        role: 'accessory',
        sets: [{ reps: 15, rir: 4, weight: 0, restSec: 60 }],
      }] : [],
    });
  }
  while (result.length > count) {
    const removable = result.findIndex(session => session.blocks.length === 0 || session.focus === 'deload');
    result.splice(removable >= 0 ? removable : result.length - 1, 1);
  }
  return result;
}

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
