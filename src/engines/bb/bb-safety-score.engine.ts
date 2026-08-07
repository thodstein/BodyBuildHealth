/**
 * bb-safety-score.engine.ts — PlanSafetyScore (0-100).
 *
 * Комплексная оценка безопасности плана на основе:
 * - JointStressScore (из bb-injury-prevention.engine.ts)
 * - ACWR (Acute:Chronic Workload Ratio)
 * - Recovery metrics (bodyFat, hrvMs, sleepHours, stressLevel)
 * - Injury count
 * - Volume vs MRV compliance
 *
 * Score < 60 → блокировка сохранения (критические проблемы).
 * Score 60-75 → предупреждение (можно сохранить, но есть риски).
 * Score > 75 → безопасный план.
 */
import type { BBPlan } from './bb-types';
import { analyzePlanStress } from './bb-injury-prevention.engine';
import { analyzeBBBalance } from './bb-balance.engine';

export interface PlanSafetyScore {
  score: number;
  riskLevel: 'safe' | 'caution' | 'dangerous';
  factors: {
    jointStress: number;
    acwrCompliance: number;
    recovery: number;
    injuryRisk: number;
  volumeCompliance: number;
  frequencyCompliance: number;
  balance: number;
  };
  issues: string[];
  recommendations: string[];
}

const SCORE_WEIGHTS = {
  jointStress: 20,
  acwrCompliance: 20,
  recovery: 15,
  injuryRisk: 15,
  volumeCompliance: 15,
  frequencyCompliance: 5,
  balance: 10,
};

export function calculatePlanSafetyScore(
  plan: BBPlan,
  options: {
    acwrRatio?: number;
    bodyFat?: number;
    hrvMs?: number;
    sleepHours?: number;
    stressLevel?: number;
    injuryCount?: number;
  } = {},
): PlanSafetyScore {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 1. Joint Stress Score
  const stressAnalysis = analyzePlanStress(plan);
  const jointStressScore = Math.max(0, Math.min(SCORE_WEIGHTS.jointStress,
    SCORE_WEIGHTS.jointStress - (stressAnalysis.overallRisk === 'high' ? SCORE_WEIGHTS.jointStress :
      stressAnalysis.overallRisk === 'moderate' ? SCORE_WEIGHTS.jointStress / 2 : 0)
  ));
  if (stressAnalysis.overallRisk === 'high') {
    issues.push('Высокий суставной стресс — риск травмы.');
    recommendations.push('Снизьте объём осевых упражнений или замените на изоляцию.');
  }
  issues.push(...stressAnalysis.issues.slice(0, 5));

  // 2. ACWR Compliance
  const acwr = options.acwrRatio || 1.0;
  let acwrScore = SCORE_WEIGHTS.acwrCompliance;
  if (acwr > 1.5) {
    acwrScore = 0;
    issues.push(`ACWR=${acwr.toFixed(2)} — опасная зона (>1.5).`);
    recommendations.push('Принудительная разгрузка: снизить объём на 30-40%.');
  } else if (acwr > 1.3) {
    acwrScore = SCORE_WEIGHTS.acwrCompliance / 2;
    issues.push(`ACWR=${acwr.toFixed(2)} — зона осторожности (1.3-1.5).`);
    recommendations.push('Рассмотрите снижение объёма или дополнительную разгрузочную неделю.');
  }

  // 3. Recovery Metrics
  let recoveryScore = SCORE_WEIGHTS.recovery;
  if (options.bodyFat != null && options.bodyFat > 25) {
    recoveryScore -= 4;
    issues.push(`bodyFat=${options.bodyFat}% — высокое (>25%), восстановление снижено.`);
  }
  if (options.hrvMs != null && options.hrvMs < 50) {
    recoveryScore -= 4;
    issues.push(`HRV=${options.hrvMs}мс — низкая вариабельность (<50мс).`);
  }
  if (options.sleepHours != null && options.sleepHours < 6) {
    recoveryScore -= 4;
    issues.push(`sleepHours=${options.sleepHours}ч — недостаток сна (<6ч).`);
  }
  if (options.stressLevel != null && options.stressLevel > 6) {
    recoveryScore -= 3;
    issues.push(`stressLevel=${options.stressLevel}/10 — высокий стресс (>6).`);
  }
  recoveryScore = Math.max(0, recoveryScore);

  // 4. Injury Risk
  const injuryCount = options.injuryCount || 0;
  let injuryScore = SCORE_WEIGHTS.injuryRisk;
  if (injuryCount > 0) {
    injuryScore = Math.max(0, SCORE_WEIGHTS.injuryRisk - injuryCount * 5);
    issues.push(`${injuryCount} активных травм — план адаптирован.`);
  }

  // 5. Volume Compliance (MRV)
  let volumeViolations = 0;
  for (const w of plan.weeks) {
    if (w.phase === 'deload') continue;
    const muscleSets: Record<string, number> = {};
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        muscleSets[ex.muscle] = (muscleSets[ex.muscle] || 0) + ex.sets;
      }
    }
    // Проверяем превышение MRV (если есть volumeLandmarks)
    if (plan.volumeLandmarks) {
      for (const [muscle, sets] of Object.entries(muscleSets)) {
        const lm = plan.volumeLandmarks.find(l => l.group === muscle);
        if (lm && sets > lm.mrv * 1.1) {
          volumeViolations++;
        }
      }
    }
  }
  let volumeScore = SCORE_WEIGHTS.volumeCompliance;
  if (volumeViolations > 0) {
    volumeScore = Math.max(0, SCORE_WEIGHTS.volumeCompliance - volumeViolations * 3);
    issues.push(`${volumeViolations} превышений MRV — риск перетренированности.`);
  }

  // Frequency is a quality/safety signal: very low frequency concentrates
  // volume into fewer sessions and increases per-session fatigue exposure.
  const frequencyCounts: Record<string, Set<number>> = {};
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      for (const muscle of new Set(session.exercises.map(exercise => exercise.muscle))) {
        (frequencyCounts[muscle] ||= new Set()).add(session.day);
      }
    }
  }
  const frequencyIssues = Object.entries(frequencyCounts).filter(([muscle, days]) => {
    const small = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs']).has(muscle);
    return small ? days.size < 2 : days.size < 1;
  });
  let frequencyScore = SCORE_WEIGHTS.frequencyCompliance;
  if (frequencyIssues.length > 0) {
    frequencyScore = Math.max(0, frequencyScore - Math.min(SCORE_WEIGHTS.frequencyCompliance, frequencyIssues.length));
    issues.push(`Низкая частота для ${frequencyIssues.map(([muscle]) => muscle).join(', ')} — объём сильнее концентрирован по сессиям.`);
    recommendations.push('Рассмотрите распределение объёма малых мышц минимум на 2 сессии в неделю.');
  }

  // 6. Balance
  let balanceScore = SCORE_WEIGHTS.balance;
  try {
    const balance = analyzeBBBalance(plan);
    if (balance.issues.length > 0) {
      balanceScore = Math.max(0, SCORE_WEIGHTS.balance - balance.issues.length * 2);
      issues.push(...balance.issues.slice(0, 3));
    }
  } catch {
    // balance может упасть на пустых планах
  }

  // Total score
  const totalScore = Math.round(
    jointStressScore + acwrScore + recoveryScore + injuryScore + volumeScore + frequencyScore + balanceScore
  );

  const riskLevel: 'safe' | 'caution' | 'dangerous' =
    totalScore < 60 ? 'dangerous' : totalScore < 75 ? 'caution' : 'safe';

  if (totalScore < 60) {
    recommendations.unshift('🚨 КРИТИЧНО: план небезопасен. Исправьте ошибки перед сохранением.');
  } else if (totalScore < 75) {
    recommendations.unshift('⚠ Внимание: план имеет риски. Сохранение возможно, но рекомендуется доработать.');
  } else {
    recommendations.unshift('✅ План безопасен для выполнения.');
  }

  return {
    score: Math.max(0, Math.min(100, totalScore)),
    riskLevel,
    factors: {
      jointStress: jointStressScore,
      acwrCompliance: acwrScore,
      recovery: recoveryScore,
      injuryRisk: injuryScore,
      volumeCompliance: volumeScore,
      frequencyCompliance: frequencyScore,
      balance: balanceScore,
    },
    issues: [...new Set(issues)],
    recommendations,
  };
}
