/**
 * bb-injury-prevention.engine.ts — система профилактики травм.
 *
 * Helms 2022, Schoenfeld 2021: управление суставной нагрузкой критично для
 * долгосрочного прогресса. Высокий jointStress на одной мышце/суставе
 * в течение недели — риск перетренированности и травмы.
 *
 * Функции:
 * 1. Расчёт JointStressScore для каждой сессии и недели.
 * 2. Предупреждение конфликтов (плечи + жим лёжа + жим стоя в одну неделю).
 * 3. Рекомендации по замене упражнений при высоком стрессе.
 */
import type { BBPlan, BBSession, BBExercise } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { trueMuscleOf } from '../movement-pattern';

export interface JointStressReport {
  sessionStress: number;
  weeklyStress: number;
  byJoint: Record<string, number>;
  issues: string[];
  riskLevel: 'low' | 'moderate' | 'high';
}

const JOINT_MUSCLE_MAP: Record<string, string[]> = {
  shoulder: ['shoulders', 'chest', 'delt_front', 'delt_mid', 'delt_rear', 'triceps'],
  knee: ['quads', 'hamstrings', 'glutes', 'calves'],
  lower_back: ['back', 'hamstrings', 'glutes', 'lower_back'],
  elbow: ['biceps', 'triceps', 'forearms'],
  wrist: ['forearms', 'biceps'],
  hip: ['glutes', 'hamstrings', 'quads'],
  ankle: ['calves'],
  neck: ['traps', 'back'],
};

const STRESS_THRESHOLDS = {
  low: 15,
  moderate: 25,
  high: 40,
};

function getJointStress(exercise: BBExercise): number {
  const catalog = EXERCISE_CATALOG.find(e => e.name === exercise.name || e.id === exercise.exerciseName);
  if (!catalog) return 5;
  const stressMap: Record<string, number> = { low: 3, med: 6, high: 10 };
  const base = stressMap[catalog.jointStress || 'med'] || 6;
  const rawRir = exercise.rir ?? 2;
  const rir = Number.isFinite(rawRir) ? Math.max(0, Math.min(5, rawRir)) : 2;
  const proximityMultiplier = 1 + Math.max(0, 2 - rir) * 0.15;
  // Весовой фактор: суставная нагрузка растёт с рабочим весом (не только с
  // числом сетов). <60 кг — база; 200+ кг — ×1.5 (тяжёлые compound-нагрузки).
  const rawW = exercise.workSets?.[0]?.weight;
  const weight = Number.isFinite(Number(rawW)) ? Number(rawW) : 0;
  const intensityMultiplier = weight > 0 ? 1 + Math.min(0.5, Math.max(0, (weight - 60) / 200)) : 1;
  return base * exercise.sets * proximityMultiplier * intensityMultiplier;
}

function getJointsForMuscle(muscle: string): string[] {
  const joints: string[] = [];
  for (const [joint, muscles] of Object.entries(JOINT_MUSCLE_MAP)) {
    if (muscles.includes(muscle)) joints.push(joint);
  }
  return joints;
}

/**
 * Рассчитать суставной стресс для сессии.
 */
export function calculateSessionStress(session: BBSession): JointStressReport {
  const byJoint: Record<string, number> = {};
  let total = 0;

  for (const ex of session.exercises) {
    const stress = getJointStress(ex);
    total += stress;
    const trueMuscle = trueMuscleOf({ name: ex.name, group: ex.muscle, movementPattern: ex.exerciseName }) || ex.muscle;
    const joints = getJointsForMuscle(trueMuscle);
    for (const joint of joints) {
      byJoint[joint] = (byJoint[joint] || 0) + stress;
    }
  }

  const issues: string[] = [];
  for (const [joint, stress] of Object.entries(byJoint)) {
    if (stress > STRESS_THRESHOLDS.high) {
      issues.push(`⚠ ${joint}: высокий суставной стресс (${stress}) — рассмотрите замену упражнений.`);
    }
  }

  return {
    sessionStress: total,
    weeklyStress: total,
    byJoint,
    issues,
    riskLevel: total > STRESS_THRESHOLDS.high ? 'high' : total > STRESS_THRESHOLDS.moderate ? 'moderate' : 'low',
  };
}

/**
 * Рассчитать суставной стресс для недели.
 */
export function calculateWeeklyStress(week: { sessions: BBSession[] }): JointStressReport {
  const byJoint: Record<string, number> = {};
  let total = 0;
  const allIssues: string[] = [];

  for (const session of week.sessions) {
    const sessionReport = calculateSessionStress(session);
    total += sessionReport.sessionStress;
    for (const [joint, stress] of Object.entries(sessionReport.byJoint)) {
      byJoint[joint] = (byJoint[joint] || 0) + stress;
    }
    allIssues.push(...sessionReport.issues);
  }

  // Проверка конфликтов: плечи + жим лёжа + жим стоя в одну неделю
  const shoulderStress = byJoint['shoulder'] || 0;
  if (shoulderStress > STRESS_THRESHOLDS.high) {
    const hasBenchPress = week.sessions.some(s =>
      s.exercises.some(ex => /жим.*лёж|bench.*press/i.test(ex.name))
    );
    const hasOverheadPress = week.sessions.some(s =>
      s.exercises.some(ex => /жим.*стоя|жим.*сидя|overhead|ohp|армей/i.test(ex.name))
    );
    if (hasBenchPress && hasOverheadPress) {
      allIssues.push('⚠ Конфликт плечевого сустава: жим лёжа + жим стоя в одну неделю — высокий риск травмы плеча.');
    }
  }

  // Дедуплицируем issues
  const uniqueIssues = [...new Set(allIssues)];

  return {
    sessionStress: total,
    weeklyStress: total,
    byJoint,
    issues: uniqueIssues,
    riskLevel: total > STRESS_THRESHOLDS.high * 3 ? 'high' : total > STRESS_THRESHOLDS.moderate * 3 ? 'moderate' : 'low',
  };
}

/**
 * Анализировать весь план на суставной стресс.
 */
export function analyzePlanStress(plan: BBPlan): {
  weeklyReports: JointStressReport[];
  totalStress: number;
  avgWeeklyStress: number;
  peakWeek: number;
  issues: string[];
  overallRisk: 'low' | 'moderate' | 'high';
} {
  const weeklyReports: JointStressReport[] = [];
  const allIssues: string[] = [];
  let totalStress = 0;
  let peakStress = 0;
  let peakWeek = 0;

  for (const w of plan.weeks) {
    if (w.phase === 'deload') continue; // skip deload weeks
    const report = calculateWeeklyStress(w);
    weeklyReports.push(report);
    totalStress += report.weeklyStress;
    if (report.weeklyStress > peakStress) {
      peakStress = report.weeklyStress;
      peakWeek = w.week;
    }
    allIssues.push(...report.issues);
  }

  const validWeeks = weeklyReports.length || 1;
  const avgWeeklyStress = totalStress / validWeeks;

  // PED-интенсификация: дозы повышают MRV → объём и рабочие веса выше,
  // а сухожилия/связки адаптируются медленнее мышечной ткани (Schoenfeld 2021,
  // Helms 2022). При совокупном множителе ≥1.3 предупреждаем явно.
  const ped = (plan as any).pedAdaptation as
    | { combinedMrvMultiplier?: number; combinedRecoveryMultiplier?: number; activePEDs?: string[]; pedDoses?: Record<string, number> }
    | undefined;
  if (ped && (ped.combinedMrvMultiplier ?? 1) >= 1.3) {
    const rawAas = ped.pedDoses?.AAS as any;
    const aasDose = typeof rawAas === 'string' ? parseFloat(String(rawAas).replace(',', '.').replace(/[^0-9.\-eE]/g, '')) : Number(rawAas) || 0;
    const dryJoints = aasDose >= 750 ? ' Высокие дозы ААС + эстрадиол-супрессия → сухость суставов; рассмотрите дозированный AI и добавки (коллаген/Омега-3/UC-II).' : '';
    allIssues.push(`⚠ PED-интенсификация объёма ×${(ped.combinedMrvMultiplier ?? 1).toFixed(2)}: сухожилия/связки не успевают за мышечным ростом — контролируйте боли в суставах, при появлении — снижайте объём/веса (особенно на френч/жимах узким/тягах).${dryJoints}`);
  }

  // Overall risk: high if any week is high, moderate if avg > moderate
  const hasHigh = weeklyReports.some(r => r.riskLevel === 'high');
  const overallRisk = hasHigh ? 'high' : avgWeeklyStress > STRESS_THRESHOLDS.moderate * 2 ? 'moderate' : 'low';

  return {
    weeklyReports,
    totalStress,
    avgWeeklyStress,
    peakWeek,
    issues: [...new Set(allIssues)],
    overallRisk,
  };
}
