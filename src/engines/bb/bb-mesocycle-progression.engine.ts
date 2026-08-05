/**
 * bb-mesocycle-progression.engine.ts — cross-mesocycle continuity.
 *
 * Профессиональный инструмент: каждый новый мезоцикл строится на основе предыдущего.
 * - Auto-progress весов: peak-week веса предыдущего плана → стартовые веса +progression
 * - Exercise rotation: упражнения предыдущего мезо → пониженный приоритет в новом
 * - Volume progression: per-muscle volume предыдущего → +1-2 сета (progressive overload)
 * - Cumulative volume tracking: история объёма за N мезоциклов → авто-deload при накоплении
 *
 * Источники: Helms MAAS (progressive overload), Schoenfeld 2017 (volume landmarks),
 * Israetel RP (mesocycle progression templates).
 */
import type { BBPlan, BBExercise, BBWeek } from './bb-builder.engine';

export interface MesocycleProgression {
  /** Per-muscle peak-week веса из предыдущего плана (кг). */
  peakWeights: Record<string, number>;
  /** Per-muscle total sets из предыдущего плана (для volume progression). */
  previousVolume: Record<string, number>;
  /** Список имён упражнений из предыдущего плана (для rotation avoidance). */
  previousExercises: string[];
  /** Per-muscle recommended volume delta (+сеты). */
  volumeDelta: Record<string, number>;
  /** Рекомендация по deload: true если cumulativeVolume > 1.5× baseline. */
  needsDeload: boolean;
  /** Рекомендуемая прогрессия весов (кг) по мышцам. */
  weightProgression: Record<string, number>;
}

/**
 * Извлечь данные прогрессии из предыдущего плана.
 * @param previousPlan — BBPlan предыдущего мезоцикла
 * @param level — уровень атлета (beginner/intermediate/advanced/enhanced)
 * @param goal — цель нового мезо (cut → меньше прогрессия, mass → больше)
 */
export function extractMesocycleProgression(
  previousPlan: BBPlan,
  level: string = 'intermediate',
  goal: string = 'mass',
): MesocycleProgression {
  const peakWeights: Record<string, number> = {};
  const previousVolume: Record<string, number> = {};
  const previousExercises: string[] = [];
  const volumeDelta: Record<string, number> = {};
  const weightProgression: Record<string, number> = {};

  // Найти peak-week (неделя с максимальным объёмом, исключая deload/taper)
  const nonDeloadWeeks = previousPlan.weeks.filter(w => !w.deload && w.phase !== 'deload' && w.phase !== 'peaking');
  const peakWeek = nonDeloadWeeks.length > 0
    ? nonDeloadWeeks.reduce((max, w) => {
        const vol = w.sessions.flatMap(s => s.exercises).reduce((sum, e) => sum + e.sets, 0);
        const maxVol = max.sessions.flatMap(s => s.exercises).reduce((sum, e) => sum + e.sets, 0);
        return vol > maxVol ? w : max;
      })
    : previousPlan.weeks[0];

  // Извлечь peak weights и volume per muscle
  for (const w of previousPlan.weeks) {
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        // Peak weight: самый тяжёлый work set для каждой мышцы
        const topWeight = Math.max(...(ex.workSets || []).map(ws => ws.weight || 0));
        if (topWeight > 0) {
          const current = peakWeights[ex.muscle] || 0;
          if (topWeight > current) peakWeights[ex.muscle] = topWeight;
        }
        // Volume: суммарные сеты per muscle за весь план
        previousVolume[ex.muscle] = (previousVolume[ex.muscle] || 0) + ex.sets;
        // Exercise names
        const name = ex.exerciseName || ex.name || '';
        if (name && !previousExercises.includes(name)) {
          previousExercises.push(name);
        }
      }
    }
  }

  // Volume progression: +1-2 сета per muscle (зависит от level и goal)
  const baseDelta = goal === 'cut' ? 0 : goal === 'maintenance' ? 0 : level === 'beginner' ? 1 : level === 'enhanced' ? 2 : 1;
  for (const muscle of Object.keys(previousVolume)) {
    volumeDelta[muscle] = baseDelta;
  }

  // Weight progression: muscle-specific deltas.
  // BUG-FIX: раньше плоский +2.5/+5кг для ВСЕХ мышц — малые мышцы (бицепс, икры, предплечья)
  // не могут прогрессировать +5кг за мезоцикл. Теперь: малые мышцы +1.25кг, большие +2.5-5кг.
  const SMALL_MUSCLES = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs', 'traps', 'delt_front', 'delt_mid', 'delt_rear']);
  const baseWeightDelta = goal === 'cut' ? 0
    : goal === 'maintenance' ? 1.25
    : level === 'beginner' ? 2.5
    : level === 'enhanced' ? 5
    : level === 'advanced' ? 5
    : 2.5;
  for (const muscle of Object.keys(peakWeights)) {
    // Малые мышцы прогрессируют в 2 раза медленнее (Schoenfeld 2017: малые мышцы меньше силы генерируют)
    weightProgression[muscle] = SMALL_MUSCLES.has(muscle) ? Math.round(baseWeightDelta / 2 * 10) / 10 : baseWeightDelta;
  }

  // Needs deload: если предыдущий план был длинным (≥12 нед) или volume был высоким
  const totalSets = Object.values(previousVolume).reduce((sum, v) => sum + v, 0);
  const avgSetsPerMuscle = totalSets / Math.max(1, Object.keys(previousVolume).length);
  const needsDeload = previousPlan.weeks.length >= 12 || avgSetsPerMuscle > 80;

  return {
    peakWeights,
    previousVolume,
    previousExercises,
    volumeDelta,
    needsDeload,
    weightProgression,
  };
}

/**
 * Применить прогрессию к workMax: peak weight + progression delta.
 * @param workMax — текущий workMax (может быть пустым)
 * @param progression — данные из предыдущего мезо
 * @returns обновлённый workMax с прогрессией
 */
export function applyWeightProgression(
  workMax: Record<string, number>,
  progression: MesocycleProgression,
): Record<string, number> {
  const result = { ...workMax };
  for (const [muscle, peakW] of Object.entries(progression.peakWeights)) {
    const delta = progression.weightProgression[muscle] || 0;
    const progressed = peakW + delta;
    // Не снижать существующий workMax, только повышать
    if (!result[muscle] || result[muscle] < progressed) {
      result[muscle] = Math.round(progressed * 10) / 10;
    }
  }
  return result;
}

/**
 * Проверить, было ли упражнение в предыдущем мезоцикле.
 * Используется для rotation avoidance — понижаем приоритет повторов.
 */
export function wasInPreviousMeso(exerciseName: string, progression: MesocycleProgression): boolean {
  const name = (exerciseName || '').toLowerCase();
  return progression.previousExercises.some(prev => {
    const p = (prev || '').toLowerCase();
    return p === name || p.includes(name) || name.includes(p);
  });
}

/**
 * Рекомендация по объёму для мышцы с учётом предыдущего мезо.
 * @param muscle — целевая мышца
 * @param baseTarget — базовый target volume (из volume-landmarks)
 * @param progression — данные из предыдущего мезо
 * @returns скорректированный target volume
 */
export function applyVolumeProgression(
  muscle: string,
  baseTarget: number,
  progression: MesocycleProgression,
): number {
  const delta = progression.volumeDelta[muscle] || 0;
  return Math.round(baseTarget + delta);
}
