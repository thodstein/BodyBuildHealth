/**
 * bb-exercise-rotation.engine.ts — умная ротация упражнений по паттернам.
 *
 * Schoenfeld 2017: вариативность упражнений предотвращает адаптацию и
 * стимулирует разные моторные единицы. Ротация по двигательным паттернам
 * (horizontal_push: flat bench → incline bench → dumbbell press) эффективнее
 * случайной ротации.
 *
 * Правила:
 * 1. Не повторять упражнение в течение 4 недель (cooldown period).
 * 2. Ротация по паттернам: если жим лёжа был тяжёлым, заменить на гантели.
 * 3. Предотвращение повторов внутри мезоцикла (максимум 2 раза за 8 недель).
 */
import type { BBPlan, BBExercise } from './bb-builder.engine';
import { derivePattern } from '../movement-pattern';

export interface RotationHistoryEntry {
  exerciseName: string;
  pattern: string;
  week: number;
  phase: string;
}

export interface RotationRecommendation {
  exerciseName: string;
  reason: string;
  cooldownRemaining: number;
}

const COOLDOWN_WEEKS = 4;
const MAX_REPEATS_PER_MESO = 3;

/* ── Волна-1.4: cooldown-окно как enforced-состояние генерации ──
 * История «мышца → упражнение → {последняя неделя, счётчик}». Из неё строится
 * список заблокированных имён: та же неделя (внутринедельная ротация),
 * gap 1..3 недель (4-недельное окно тишины) и исчерпанный лимит повторов
 * (max 3 за мезоцикл). Семантика совпадает с canUseExercise, но состояние
 * пригодно для инкрементальной генерации плана. */
export interface CooldownUseRecord { lastWeek: number; count: number }
export type CooldownHistory = Map<string, Map<string, CooldownUseRecord>>;

export function cooldownBlockedNames(history: CooldownHistory, muscle: string, week: number): string[] {
  const map = history.get(muscle);
  if (!map || map.size === 0) return [];
  const out: string[] = [];
  for (const [name, rec] of map) {
    const gap = week - rec.lastWeek;
    // Та же неделя = упражнение уже взято в предыдущей сессии недели.
    if (rec.lastWeek === week || (gap > 0 && gap < COOLDOWN_WEEKS) || rec.count >= MAX_REPEATS_PER_MESO) out.push(name);
  }
  return out;
}

export function recordCooldownUse(history: CooldownHistory, muscle: string, name: string, week: number): void {
  if (!name) return;
  if (!history.has(muscle)) history.set(muscle, new Map());
  const map = history.get(muscle)!;
  const rec = map.get(name);
  if (rec && rec.lastWeek === week) return; // неделя уже учтена
  map.set(name, { lastWeek: week, count: (rec ? rec.count : 0) + 1 });
}

/**
 * Извлечь историю упражнений из плана (для анализа ротации).
 */
export function extractRotationHistory(plan: BBPlan): RotationHistoryEntry[] {
  const history: RotationHistoryEntry[] = [];
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        const name = ex.name || ex.exerciseName || '';
        if (!name) continue;
        history.push({
          exerciseName: name,
          pattern: derivePattern(ex),
          week: w.week,
          phase: String(w.phase || 'accumulation'),
        });
      }
    }
  }
  return history;
}

/**
 * Проверить, можно ли использовать упражнение на текущей неделе.
 * @param exerciseName — имя упражнения
 * @param currentWeek — номер текущей недели
 * @param history — история из предыдущих недель
 * @returns { allowed, cooldownRemaining, reason }
 */
export function canUseExercise(
  exerciseName: string,
  currentWeek: number,
  history: RotationHistoryEntry[],
): { allowed: boolean; cooldownRemaining: number; reason: string } {
  const pattern = history.find(h => h.exerciseName === exerciseName)?.pattern || '';
  // Проверка cooldown: не использовать упражнение в течение 4 недель после последнего использования
  const lastUsed = history
    .filter(h => h.exerciseName === exerciseName && h.week < currentWeek)
    .sort((a, b) => b.week - a.week)[0];

  if (lastUsed) {
    const weeksSinceLastUse = currentWeek - lastUsed.week;
    if (weeksSinceLastUse < COOLDOWN_WEEKS) {
      return {
        allowed: false,
        cooldownRemaining: COOLDOWN_WEEKS - weeksSinceLastUse,
        reason: `Упражнение использовалось на неделе ${lastUsed.week}. Cooldown: ${COOLDOWN_WEEKS - weeksSinceLastUse} нед. осталось.`,
      };
    }
  }

  // Проверка max repeats per mesocycle
  const useCount = history.filter(h => h.exerciseName === exerciseName).length;
  if (useCount >= MAX_REPEATS_PER_MESO) {
    return {
      allowed: false,
      cooldownRemaining: 0,
      reason: `Упражнение уже использовалось ${useCount} раз за мезоцикл (максимум ${MAX_REPEATS_PER_MESO}).`,
    };
  }

  return { allowed: true, cooldownRemaining: 0, reason: '' };
}

/**
 * Найти альтернативу по тому же паттерну (движение, не имя).
 * Schoenfeld 2017: ротация по паттернам сохраняет стимул, но меняет моторные единицы.
 */
export function findPatternAlternative(
  originalPattern: string,
  usedExerciseNames: Set<string>,
  candidates: BBExercise[],
): BBExercise | null {
  const samePattern = candidates.filter(ex => {
    const name = ex.name || ex.exerciseName || '';
    if (usedExerciseNames.has(name)) return false;
    return derivePattern(ex) === originalPattern;
  });
  return samePattern[0] || null;
}

/**
 * Анализировать ротацию упражнений в плане и дать рекомендации.
 */
export function analyzeRotation(plan: BBPlan): {
  totalExercises: number;
  uniqueExercises: number;
  repeatRate: number;
  issues: string[];
  recommendations: RotationRecommendation[];
} {
  const history = extractRotationHistory(plan);
  const allNames = history.map(h => h.exerciseName);
  const uniqueNames = new Set(allNames);
  const totalExercises = allNames.length;
  const uniqueExercises = uniqueNames.size;
  const repeatRate = totalExercises > 0 ? Math.round(((totalExercises - uniqueExercises) / totalExercises) * 100) / 100 : 0;

  const issues: string[] = [];
  const recommendations: RotationRecommendation[] = [];

  // Проверка повторов в течение 4 недель
  const exerciseWeeks: Record<string, number[]> = {};
  for (const h of history) {
    if (!exerciseWeeks[h.exerciseName]) exerciseWeeks[h.exerciseName] = [];
    exerciseWeeks[h.exerciseName].push(h.week);
  }

  for (const [name, weeks] of Object.entries(exerciseWeeks)) {
    if (weeks.length < 2) continue;
    const sorted = [...weeks].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap < COOLDOWN_WEEKS && gap > 0) {
        issues.push(`${name}: повтор на неделях ${sorted[i - 1]} и ${sorted[i]} (gap ${gap} нед < ${COOLDOWN_WEEKS} cooldown).`);
      }
    }
    if (weeks.length > MAX_REPEATS_PER_MESO) {
      issues.push(`${name}: ${weeks.length} повторов за мезоцикл (максимум ${MAX_REPEATS_PER_MESO}).`);
    }
  }

  return {
    totalExercises,
    uniqueExercises,
    repeatRate,
    issues,
    recommendations,
  };
}