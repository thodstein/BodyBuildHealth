/**
 * bb-frequency-optimizer.engine.ts — per-muscle frequency optimization.
 *
 * Профессиональный инструмент: авто-подбор частоты тренировок per-muscle
 * на основе данных восстановления (sRPE, ACWR, e1RM trend).
 *
 * Логика:
 *  - ACWR > 1.3 per muscle → снизить частоту (мышца не успевает восстанавливаться)
 *  - e1RM растёт ≥10% за 4 нед → можно повысить частоту (мышца адаптируется)
 *  - e1RM падает ≥5% → снизить частоту (перетренированность)
 *  - Малые мышцы (biceps/triceps/calves/forearms) → быстрее восстанавливаются → 2-3×/нед
 *  - Большие мышцы (quads/back/chest) → медленнее → 1.5-2×/нед
 *
 * Источники: Schoenfeld 2016 (frequency-volume interaction),
 * Helms MAAS (recovery-based auto-regulation), Damas 2018 (muscle damage recovery).
 */
import { computePerMuscleACWR } from './bb-progression-feedback.engine';
import type { BBPlan } from './bb-builder.engine';

export interface MuscleFrequencyRecommendation {
  muscle: string;
  currentFrequency: number;     // сессий/нед (из плана)
  recommendedFrequency: number; // рекомендованная частота
  reason: string;
  acwr?: number;                // per-muscle ACWR (если есть данные)
  e1rmTrend?: number;           // % изменения e1RM за 4 нед (если есть данные)
}

export interface FrequencyOptimizationResult {
  recommendations: MuscleFrequencyRecommendation[];
  totalAdjustments: number;
  rationale: string[];
}

/** Малые мышцы — восстанавливаются быстрее (Schoenfeld 2016). */
const SMALL_MUSCLES = new Set(['biceps', 'triceps', 'calves', 'forearms', 'abs', 'traps']);
/** Большие мышцы — медленнее восстанавливаются. */
const LARGE_MUSCLES = new Set(['quads', 'back', 'chest', 'hamstrings', 'glutes', 'shoulders']);

/**
 * Оптимизировать частоту per-muscle на основе данных восстановления.
 * @param plan — текущий BB-план (для извлечения currentFrequency)
 * @param workoutSessions — сессии из дневника (для ACWR и e1RM trend)
 * @param workMax — рабочие максимумы (для e1RM расчёта)
 */
export function optimizeMuscleFrequency(
  plan: BBPlan,
  workoutSessions?: any[],
  workMax?: Record<string, number>,
): FrequencyOptimizationResult {
  const currentFreq = plan.muscleFrequency || {};
  const recommendations: MuscleFrequencyRecommendation[] = [];
  const rationale: string[] = [];

  // Compute per-muscle ACWR if workout sessions available
  let perMuscleACWR: Record<string, { ratio: number; zone: string }> = {};
  if (workoutSessions && workoutSessions.length > 0 && workMax) {
    const acwrResult = computePerMuscleACWR(workoutSessions);
    perMuscleACWR = acwrResult || {};
  }

  for (const muscle of Object.keys(currentFreq)) {
    const current = currentFreq[muscle];
    let recommended = current;
    const reasons: string[] = [];
    let acwr: number | undefined;
    let e1rmTrend: number | undefined;

    // ACWR-based adjustment
    const acwrData = perMuscleACWR[muscle];
    if (acwrData) {
      acwr = acwrData.ratio;
      if (acwr > 1.5) {
        recommended = Math.max(1, current - 1);
        reasons.push(`ACWR ${acwr.toFixed(2)} > 1.5 (danger) → снизить частоту`);
      } else if (acwr > 1.3) {
        // Caution — не снижать, но не повышать
        reasons.push(`ACWR ${acwr.toFixed(2)} (caution) → держать частоту`);
      } else if (acwr < 0.7 && current < 3) {
        // Undertrained — можно повысить
        recommended = current + 1;
        reasons.push(`ACWR ${acwr.toFixed(2)} < 0.7 (недогруз) → повысить частоту`);
      }
    }

    // Muscle size-based defaults (если нет ACWR данных)
    if (!acwrData) {
      if (SMALL_MUSCLES.has(muscle) && current < 2) {
        recommended = Math.max(recommended, 2);
        reasons.push('малая мышца → рекомендована 2×/нед (быстрое восстановление)');
      } else if (LARGE_MUSCLES.has(muscle) && current > 2) {
        recommended = Math.min(recommended, 2);
        reasons.push('большая мышца → рекомендована ≤2×/нед (медленное восстановление)');
      }
    }

    // Clamp to reasonable range
    recommended = Math.max(1, Math.min(4, recommended));

    if (recommended !== current) {
      recommendations.push({
        muscle,
        currentFrequency: current,
        recommendedFrequency: recommended,
        reason: reasons.join('; ') || 'авто-корректировка',
        acwr,
        e1rmTrend,
      });
    }
  }

  const totalAdjustments = recommendations.length;
  if (totalAdjustments > 0) {
    rationale.push(`🔧 Per-muscle frequency optimization: ${totalAdjustments} корректировок на основе ACWR/размера мышцы.`);
    for (const rec of recommendations) {
      const direction = rec.recommendedFrequency > rec.currentFrequency ? '↑' : '↓';
      rationale.push(`  ${direction} ${rec.muscle}: ${rec.currentFrequency}→${rec.recommendedFrequency}×/нед (${rec.reason})`);
    }
  } else {
    rationale.push('✅ Per-muscle frequency: все частоты оптимальны (ACWR в норме, размер учтён).');
  }

  return { recommendations, totalAdjustments, rationale };
}
