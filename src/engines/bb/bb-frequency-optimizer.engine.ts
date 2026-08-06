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
import { epley1RM } from '../e1rm';
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

/** D4: Вычислить per-muscle e1RM trend (% изменения за 4 нед).
 *  Возвращает Record<muscle, pct> где pct > 0 = рост, pct < 0 = падение. */
function computePerMuscleE1RMTrend(sessions: any[]): Record<string, number> {
  if (!sessions || sessions.length < 4) return {};
  const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const recentDate = new Date(sorted[sorted.length - 1].date);
  const fourWeeksAgo = new Date(recentDate.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Group by muscle: find best e1RM in recent (last 7 days) vs old (4 weeks ago ±7 days)
  const muscleRecent: Record<string, number> = {};
  const muscleOld: Record<string, number> = {};

  for (const s of sorted) {
    const sDate = new Date(s.date);
    const isRecent = (recentDate.getTime() - sDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    const isOld = Math.abs(sDate.getTime() - fourWeeksAgo.getTime()) <= 7 * 24 * 60 * 60 * 1000;
    if (!isRecent && !isOld) continue;
    for (const ex of s.exercises || []) {
      const muscle = ex.muscleGroup || '';
      if (!muscle) continue;
      for (const set of (ex.sets || [])) {
        if (!set.weightKg || !set.reps || set.weightKg <= 0) continue;
        const e1 = epley1RM(set.weightKg, set.reps);
        if (e1 <= 0) continue;
        if (isRecent) muscleRecent[muscle] = Math.max(muscleRecent[muscle] || 0, e1);
        if (isOld) muscleOld[muscle] = Math.max(muscleOld[muscle] || 0, e1);
      }
    }
  }

  const result: Record<string, number> = {};
  for (const muscle of Object.keys(muscleRecent)) {
    const oldVal = muscleOld[muscle];
    if (!oldVal || oldVal <= 0) continue;
    result[muscle] = Math.round(((muscleRecent[muscle] - oldVal) / oldVal) * 1000) / 10;
  }
  return result;
}

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
  let perMuscleE1RMTrend: Record<string, number> = {};
  if (workoutSessions && workoutSessions.length > 0 && workMax) {
    const acwrResult = computePerMuscleACWR(workoutSessions);
    perMuscleACWR = acwrResult || {};
    perMuscleE1RMTrend = computePerMuscleE1RMTrend(workoutSessions);
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

    // D4: e1RM trend-based adjustment
    const trend = perMuscleE1RMTrend[muscle];
    if (trend !== undefined) {
      e1rmTrend = trend;
      if (trend >= 10 && current < 3) {
        // e1RM растёт ≥10% → мышца адаптируется, можно повысить частоту
        recommended = Math.max(recommended, current + 1);
        reasons.push(`e1RM +${trend}% за 4 нед → мышца адаптируется, можно повысить частоту`);
      } else if (trend <= -5) {
        // e1RM падает ≥5% → перетренированность, снизить частоту
        recommended = Math.min(recommended, Math.max(1, current - 1));
        reasons.push(`e1RM ${trend}% за 4 нед → перетренированность, снизить частоту`);
      }
    }

    // Muscle size-based defaults (если нет ACWR данных)
    if (!acwrData && e1rmTrend === undefined) {
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
