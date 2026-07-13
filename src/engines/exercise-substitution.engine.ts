/**
 * exercise-substitution.engine.ts — интеллектуальная замена упражнений при травмах.
 *
 * Алгоритм:
 *  1. Определяем травмированную группу.
 *  2. Для каждого запланированного упражнения ищем замену по приоритету:
 *     a) canReplace (прямые замены из каталога)
 *     b) Та же substitutionGroup + низкий jointStress
 *     c) Тот же movementPattern + другой equipment
 *  3. Возвращаем замену с коэффициентом уверенности/безопасности.
 */

import { EXERCISE_CATALOG } from '../core/exercise-catalog';
import type { Exercise } from '../core/types';
import { derivePattern } from './movement-pattern';

/** Паттерн движения упражнения: из каталога либо выведенный эвристически. */
function patternOf(ex: Exercise): string {
  return (ex.movementPattern as string) || derivePattern(ex);
}

export interface SubstitutionResult {
  exercise: Exercise;
  confidence: 'high' | 'medium' | 'low';
  reason: string;                    // почему выбрана эта замена
  weightPct: number;                 // % от рабочего веса исходного (0.5-1.0)
  volumePct: number;                 // % от объёма исходного (0.5-1.0)
  repsMin: number;
  repsMax: number;
}

const JOINT_STRESS_ORDER: Record<string, number> = { low: 0, med: 1, high: 2 };

/** Поиск безопасных замен для упражнения по травмированным группам. */
export function findSubstitutions(
  exerciseName: string,
  muscleGroup: string,
  injuredMuscles: Set<string>,
): SubstitutionResult[] {
  const ex = EXERCISE_CATALOG.find(e => e.name === exerciseName || e.id === exerciseName);
  if (!ex) return [];

  const isDirectInjury = injuredMuscles.has(muscleGroup);
  const results: SubstitutionResult[] = [];

  if (!isDirectInjury) {
    // Если группа не травмирована напрямую, но есть риск (jointStress высок для соседних)
    results.push({
      exercise: ex,
      confidence: 'high',
      reason: 'Группа не травмирована — упражнение выполняется в штатном режиме',
      weightPct: 1.0,
      volumePct: 1.0,
      repsMin: 5,
      repsMax: 12,
    });
    return results;
  }

  // 1) Ищем по canReplace
  const directReplacements = EXERCISE_CATALOG.filter(
    e => (ex.canReplace || []).includes(e.id) && !injuredMuscles.has(e.group || muscleGroup)
  );
  for (const repl of directReplacements) {
    const wPct = ex.jointStress === 'high' && repl.jointStress === 'low' ? 0.85 : 1.0;
    results.push({
      exercise: repl,
      confidence: 'high',
      reason: `Прямая замена из каталога: ${repl.name} — ниже нагрузка на суставы (${repl.jointStress} vs ${ex.jointStress})`,
      weightPct: wPct,
      volumePct: 0.9,
      repsMin: 8,
      repsMax: 15,
    });
  }

  // 2) Та же substitutionGroup + низкий jointStress
  if (results.length < 2) {
    const sameGroupLowStress = EXERCISE_CATALOG.filter(
      e => e.id !== ex.id &&
        e.substitutionGroup === ex.substitutionGroup &&
        e.jointStress !== 'high' &&
        !injuredMuscles.has(e.group || muscleGroup) &&
        !results.some(r => r.exercise.id === e.id)
    );
    for (const repl of sameGroupLowStress) {
      results.push({
        exercise: repl,
        confidence: 'medium',
        reason: `Тот же паттерн (${ex.substitutionGroup}), но безопаснее для суставов (${repl.jointStress})`,
        weightPct: 0.75,
        volumePct: 0.8,
        repsMin: 10,
        repsMax: 18,
      });
    }
  }

  // 3) Тот же movementPattern + другой equipment (например, штанга → гантели)
  if (results.length < 3) {
    const exPattern = patternOf(ex);
    const samePatternOtherEq = EXERCISE_CATALOG.filter(
      e => e.id !== ex.id &&
        exPattern !== 'unknown' &&
        patternOf(e) === exPattern &&
        e.equipment !== ex.equipment &&
        e.jointStress !== 'high' &&
        !injuredMuscles.has(e.group || muscleGroup) &&
        !results.some(r => r.exercise.id === e.id)
    );
    for (const repl of samePatternOtherEq) {
      results.push({
        exercise: repl,
        confidence: 'medium',
        reason: `Тот же тип движения (${exPattern}), другое оборудование (${repl.equipment}) — снижение нагрузки`,
        weightPct: 0.7,
        volumePct: 0.75,
        repsMin: 12,
        repsMax: 20,
      });
    }
  }

  // 4) Изоляция для травмированной группы — только low-impact
  if (ex.type === 'compound' && results.length === 0) {
    const safeIsolation = EXERCISE_CATALOG.filter(
      e => e.group === muscleGroup &&
        e.type === 'isolation' &&
        e.jointStress === 'low' &&
        !results.some(r => r.exercise.id === e.id)
    );
    for (const repl of safeIsolation) {
      results.push({
        exercise: repl,
        confidence: 'low',
        reason: `Компаунд заменён изоляцией: ${repl.name} — минимальная нагрузка на суставы, поддержание объёма`,
        weightPct: 0.5,
        volumePct: 0.6,
        repsMin: 12,
        repsMax: 20,
      });
    }
  }

  // Если замен нет — возвращаем исходное с сильным снижением нагрузки
  if (results.length === 0) {
    results.push({
      exercise: ex,
      confidence: 'low',
      reason: `Не найдена безопасная замена — упражнение выполняется с уменьшенным весом (60%) и объёмом (50%). Рекомендуется консультация с тренером`,
      weightPct: 0.6,
      volumePct: 0.5,
      repsMin: 12,
      repsMax: 15,
    });
  }

  return results;
}

/** Массовый поиск замен для всех упражнений дня по списку травм. */
export function substituteExercisesForDay(
  exercises: Array<{ name: string; muscle: string; sets: number; weight: number; reps: number; rir: number }>,
  injuredMuscles: Set<string>,
): Array<{
  originalName: string;
  substituted: boolean;
  exerciseName: string;
  muscle: string;
  sets: number;
  weight: number;
  reps: number;
  rir: number;
  confidence: string;
  reason: string;
}> {
  const today = new Date().toISOString().slice(0, 10);

  return exercises.map(ex => {
    if (!injuredMuscles.has(ex.muscle)) {
      return { originalName: ex.name, substituted: false, exerciseName: ex.name, muscle: ex.muscle, sets: ex.sets, weight: ex.weight, reps: ex.reps, rir: ex.rir, confidence: 'high', reason: '' };
    }

    const subs = findSubstitutions(ex.name, ex.muscle, injuredMuscles);
    const best = subs[0];
    if (!best || best.exercise.id === EXERCISE_CATALOG.find(e => e.name === ex.name)?.id) {
      // Fallback: same exercise, reduced load
      return {
        originalName: ex.name,
        substituted: true,
        exerciseName: ex.name,
        muscle: ex.muscle,
        sets: Math.max(1, Math.round(ex.sets * 0.5)),
        weight: Math.round(ex.weight * 0.6),
        reps: Math.min(ex.reps + 4, 15),
        rir: Math.min(ex.rir + 1, 4),
        confidence: 'low',
        reason: 'Выполняется с уменьшенной нагрузкой (60% вес, 50% объём) — травма',
      };
    }

    return {
      originalName: ex.name,
      substituted: true,
      exerciseName: best.exercise.name,
      muscle: best.exercise.group || ex.muscle,
      sets: Math.max(1, Math.round(ex.sets * best.volumePct)),
      weight: Math.round((ex.weight || 80) * best.weightPct),
      reps: Math.min(ex.reps + 2, best.repsMax),
      rir: 3,
      confidence: best.confidence,
      reason: best.reason,
    };
  });
}
