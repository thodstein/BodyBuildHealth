/**
 * bb-safety-score.engine.ts — PlanSafetyScore (0-100).
 *
 * Комплексная оценка безопасности плана на основе:
 * - JointStressScore (из bb-injury-prevention.engine.ts)
 * - ACWR (Acute:Chronic Workload Ratio)
 * - Recovery metrics (bodyFat, hrvMs, sleepHours, stressLevel)
 * - Injury count
 * - Volume vs MRV compliance
 * - Frequency & Balance
 * + ОРТОПЕДИЧЕСКИЙ СЛОЙ (интеллект тренировки):
 * - orthopedic-load-engines (computeOrthopedicConstraints, distributeWeeklyLoad)
 * - joint-load-master (JOINTS, jointLoadDiagnosis)
 * - bb-injury-prevention per-joint breakdown
 *
 * Score < 60 → блокировка сохранения (критические проблемы).
 * Score 60-75 → предупреждение (можно сохранить, но есть риски).
 * Score > 75 → безопасный план.
 */
import type { BBPlan } from './bb-types';
import { analyzePlanStress } from './bb-injury-prevention.engine';
import { analyzeBBBalance, type BBBalanceReport } from './bb-balance.engine';
import { aggregateBBVolume } from './bb-volume.engine';
import { BB_MRV_TOLERANCE } from './bb-validator.engine';
import { computeOrthopedicConstraints, distributeWeeklyLoad, type OrthopedicConstraints, type LoadDistributionOutput } from '../orthopedic-load-engines';
import { JOINTS, JOINT_OPTIONS, jointLoadDiagnosis, type JointLoadDiagnosis, type JointId } from '../pro/joint-load-master.engine';

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
  /** Расширенные детали с расчётами — для информативного Шага 5 */
  details?: SafetyDetails;
}

export interface SafetyDetails {
  /** Детализация суставной нагрузки */
  jointStressDetails: {
    overallRisk: 'low' | 'moderate' | 'high';
    avgWeeklyStress: number;
    peakWeek: number;
    weeklyReports: ReturnType<typeof analyzePlanStress>['weeklyReports'];
    byJointPeak: Record<string, number>;
    byJointAvg: Record<string, number>;
    thresholds: { low: number; moderate: number; high: number };
    perJointCalculation: string;
    mostLoadedJoint?: { joint: string; stress: number };
  };
  /** Ортопедические ограничения (интеллект) */
  orthopedic: OrthopedicConstraints | null;
  /** Распределение недельной нагрузки */
  loadDistribution: LoadDistributionOutput | null;
  /** Диагностика суставов (joint-load-master) — только проблемные/топ */
  jointDiagnoses: JointLoadDiagnosis[];
  /** Нарушения MRV по мышцам */
  volumeDetails: Array<{ muscle: string; effectiveSets: number; cap: number; tolerance: number; allowed: number; over: number; violation: boolean }>;
  /** Частота по мышцам */
  frequencyDetails: Array<{ muscle: string; days: number; required: number; violation: boolean }>;
  /** Баланс */
  balanceDetails: BBBalanceReport | null;
  /** Расчёт факторов с формулами */
  factorBreakdown: Array<{ key: string; label: string; weight: number; score: number; max: number; calculation: string; status: 'ok'|'warn'|'bad' }>;
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

const STRESS_THRESHOLDS = { low: 15, moderate: 25, high: 40 };

// ——— helpers for orthopedic mapping ———
const MUSCLE_TO_JOINT_ALIASES: Record<string, string> = {
  shoulders: 'shoulder', delt_front: 'shoulder', delt_mid: 'shoulder', delt_rear: 'shoulder', chest: 'shoulder', back: 'spine',
  quads: 'knee', hamstrings: 'hip', glutes: 'hip', calves: 'ankle', legs: 'knee', lower_back: 'spine', spine: 'spine', lumbar: 'spine',
  biceps: 'elbow', triceps: 'elbow', forearms: 'wrist', wrist: 'wrist', elbow: 'elbow', hip: 'hip', knee: 'knee', ankle: 'ankle', traps: 'shoulder', neck: 'spine', abs: 'spine', core: 'spine',
};

function muscleToJointKey(muscle: string): string {
  const k = (muscle || '').trim().toLowerCase();
  return MUSCLE_TO_JOINT_ALIASES[k] || k;
}

function buildJointLimitations(
  injuries: Array<{ muscle: string; exclude?: boolean; weightPct?: number }> = [],
  mobilityRestrictions: string[] = [],
): Record<string, 'none' | 'mild' | 'moderate' | 'severe'> {
  const out: Record<string, 'none' | 'mild' | 'moderate' | 'severe'> = {};
  for (const inj of injuries) {
    const joint = muscleToJointKey(inj.muscle);
    const isSevere = inj.exclude === true || (inj.weightPct != null && inj.weightPct <= 0.5);
    const isModerate = !isSevere && (inj.exclude === false || inj.weightPct != null);
    if (isSevere) out[joint] = 'severe';
    else if (isModerate) out[joint] = out[joint] === 'severe' ? 'severe' : 'moderate';
    else out[joint] = out[joint] || 'mild';
  }
  for (const mr of mobilityRestrictions) {
    const joint = muscleToJointKey(mr);
    if (!out[joint] || out[joint] === 'none') out[joint] = 'moderate';
    // не понижаем severe
  }
  return out;
}

function injuriesToHistory(injuries: Array<{ muscle: string }> = []): string[] {
  return injuries.map(i => muscleToJointKey(i.muscle));
}

export function calculatePlanSafetyScore(
  plan: BBPlan,
  options: {
    acwrRatio?: number;
    bodyFat?: number;
    hrvMs?: number;
    sleepHours?: number;
    stressLevel?: number;
    injuryCount?: number;
    injuries?: Array<{ muscle: string; exclude?: boolean; weightPct?: number; volumePct?: number }>;
    mobilityRestrictions?: string[];
    currentPain?: string[];
    balanceReport?: BBBalanceReport | null;
    stressAnalysis?: ReturnType<typeof analyzePlanStress> | null;
    weeklySessions?: number;
    goal?: string;
    volumeCapacity?: number;
    intensityCapacity?: number;
    priScore?: number;
  } = {},
): PlanSafetyScore {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 1. Joint Stress Score — reuse if passed (убираем дубль analyzePlanStress)
  const stressAnalysis = options.stressAnalysis ?? analyzePlanStress(plan);
  const jointStressScore = Math.max(0, Math.min(SCORE_WEIGHTS.jointStress,
    SCORE_WEIGHTS.jointStress - (stressAnalysis.overallRisk === 'high' ? SCORE_WEIGHTS.jointStress :
      stressAnalysis.overallRisk === 'moderate' ? SCORE_WEIGHTS.jointStress / 2 : 0)
  ));
  if (stressAnalysis.overallRisk === 'high') {
    issues.push('Высокий суставной стресс — риск травмы.');
    recommendations.push('Снизьте объём осевых упражнений или замените на изоляцию.');
  }
  issues.push(...stressAnalysis.issues.slice(0, 5));

  // 2. ACWR Compliance — если ACWR не передан, считаем осторожность (не маскируем 1.0)
  const hasAcwr = Number.isFinite(options.acwrRatio);
  const acwr = hasAcwr ? (options.acwrRatio as number) : 1.0;
  let acwrScore = SCORE_WEIGHTS.acwrCompliance;
  if (!hasAcwr) {
    acwrScore = Math.round(SCORE_WEIGHTS.acwrCompliance * 0.75);
    issues.push('ACWR не рассчитан — нет данных sRPE, осторожность.');
  } else if (acwr > 1.5) {
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
  const injuryCount = options.injuryCount ?? options.injuries?.length ?? 0;
  let injuryScore = SCORE_WEIGHTS.injuryRisk;
  if (injuryCount > 0) {
    injuryScore = Math.max(0, SCORE_WEIGHTS.injuryRisk - injuryCount * 5);
    issues.push(`${injuryCount} активных травм — план адаптирован.`);
  }

  // 5. Volume Compliance (MRV) — единый источник: aggregateBBVolume(effective) + BB_MRV_TOLERANCE 1.15
  const volumeDetails: SafetyDetails['volumeDetails'] = [];
  const violatingMuscles = new Set<string>();
  for (const w of plan.weeks) {
    if ((w as any).phase === 'deload') continue;
    const volume = aggregateBBVolume(w.sessions);
    for (const [muscle, values] of Object.entries(volume)) {
      const cap = (plan as any).mrvByMuscle?.[muscle] ?? plan.volumeLandmarks?.find(l => l.group === muscle)?.mrv;
      const allowed = cap ? cap * BB_MRV_TOLERANCE : Infinity;
      const over = cap ? Math.max(0, values.effectiveSets - allowed) : 0;
      const violation = !!cap && values.effectiveSets > allowed;
      if (violation) violatingMuscles.add(muscle);
      // collect for details (dedupe per muscle across weeks: keep max effective)
      const existing = volumeDetails.find(v => v.muscle === muscle);
      const cur = { muscle, effectiveSets: values.effectiveSets, cap: cap ?? 0, tolerance: BB_MRV_TOLERANCE, allowed: Number.isFinite(allowed) ? Math.round(allowed) : 0, over: Math.round(over*10)/10, violation };
      if (!existing) volumeDetails.push(cur);
      else if (cur.effectiveSets > existing.effectiveSets) Object.assign(existing, cur);
    }
  }
  const volumeViolations = violatingMuscles.size;
  let volumeScore = SCORE_WEIGHTS.volumeCompliance;
  if (volumeViolations > 0) {
    volumeScore = Math.max(0, SCORE_WEIGHTS.volumeCompliance - volumeViolations * 3);
    issues.push(`${volumeViolations} превышений MRV — риск перетренированности.`);
  }

  // Frequency
  const frequencyCounts: Record<string, Set<number>> = {};
  for (const week of plan.weeks) {
    for (const session of week.sessions) {
      for (const muscle of new Set(session.exercises.map(exercise => exercise.muscle))) {
        (frequencyCounts[muscle] ||= new Set()).add(session.day);
      }
    }
  }
  const frequencyDetails: SafetyDetails['frequencyDetails'] = Object.entries(frequencyCounts).map(([muscle, days]) => {
    const small = new Set(['biceps', 'triceps', 'forearms', 'calves', 'abs']).has(muscle);
    const required = small ? 2 : 1;
    return { muscle, days: days.size, required, violation: days.size < required };
  });
  const frequencyIssues = frequencyDetails.filter(f => f.violation);
  let frequencyScore = SCORE_WEIGHTS.frequencyCompliance;
  if (frequencyIssues.length > 0) {
    frequencyScore = Math.max(0, frequencyScore - Math.min(SCORE_WEIGHTS.frequencyCompliance, frequencyIssues.length));
    issues.push(`Низкая частота для ${frequencyIssues.map(f=>f.muscle).join(', ')} — объём сильнее концентрирован по сессиям.`);
    recommendations.push('Рассмотрите распределение объёма малых мышц минимум на 2 сессии в неделю.');
  }

  // 6. Balance — единый источник: reuse balanceReport если передан
  let balanceScore = SCORE_WEIGHTS.balance;
  let balanceDetails: BBBalanceReport | null = null;
  try {
    const balance = options.balanceReport !== undefined ? options.balanceReport : analyzeBBBalance(plan);
    balanceDetails = balance as any;
    if (balance && balance.issues.length > 0) {
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

  // ——— расширенные детали с расчётами (ортопедия) ———
  let details: SafetyDetails | undefined;
  try {
    // JointStressDetails
    const weeklyReports = stressAnalysis.weeklyReports || [];
    const byJointPeak: Record<string, number> = {};
    const byJointSum: Record<string, number> = {};
    for (const wr of weeklyReports) {
      for (const [joint, val] of Object.entries(wr.byJoint as Record<string, number>)) {
        byJointPeak[joint] = Math.max(byJointPeak[joint] || 0, val);
        byJointSum[joint] = (byJointSum[joint] || 0) + val;
      }
    }
    const byJointAvg: Record<string, number> = {};
    const denom = Math.max(1, weeklyReports.length);
    for (const [j, sum] of Object.entries(byJointSum)) byJointAvg[j] = Math.round((sum/denom)*10)/10;
    let mostLoadedJoint: { joint: string; stress: number } | undefined;
    for (const [j, v] of Object.entries(byJointPeak)) if (!mostLoadedJoint || v > mostLoadedJoint.stress) mostLoadedJoint = { joint: j, stress: v };

    // Orthopedic
    let orthopedic: OrthopedicConstraints | null = null;
    try {
      const injHist = injuriesToHistory(options.injuries || []);
      const jointLims = buildJointLimitations(options.injuries as any, options.mobilityRestrictions || []);
      orthopedic = computeOrthopedicConstraints({
        injuryHistory: injHist,
        jointLimitations: jointLims as any,
        techniqueIssues: [],
        currentPain: (options.currentPain || []).map(muscleToJointKey),
      });
    } catch { orthopedic = null; }

    // Load distribution
    let loadDistribution: LoadDistributionOutput | null = null;
    try {
      const weeklySessions = options.weeklySessions ?? (plan.weeks[0]?.sessions.length || 4);
      const goal = options.goal || (plan as any).goal || 'hypertrophy';
      const riskLevelForLoad = orthopedic?.phase === 'acute' ? 'high' : stressAnalysis.overallRisk === 'high' ? 'high' : stressAnalysis.overallRisk === 'moderate' ? 'medium' : 'low';
      loadDistribution = distributeWeeklyLoad({
        weeklySessions,
        goal,
        volumeCapacity: options.volumeCapacity ?? 1,
        intensityCapacity: options.intensityCapacity ?? 1,
        priScore: options.priScore ?? 70,
        riskLevel: riskLevelForLoad,
      });
    } catch { loadDistribution = null; }

    // Joint diagnoses — все нагруженные суставы детально как таз/колено (плечо и остальные наравне)
    let jointDiagnoses: JointLoadDiagnosis[] = [];
    try {
      const sortedJoints = (Object.keys(byJointPeak) as JointId[]).sort((a,b)=> (byJointPeak[b]||0)-(byJointPeak[a]||0));
      // Включаем ВСЕ суставы с любой нагрузкой >0, а не только >=15 — чтобы плечо/локоть/запястье не пропадали
      let jointsToDiagnose: JointId[] = sortedJoints.filter(j => (byJointPeak[j]||0) > 0);
      // Если план без стресса (например только делод) — показываем топ-3 по пику
      if (jointsToDiagnose.length === 0 && sortedJoints.length > 0) {
        jointsToDiagnose = sortedJoints.slice(0, Math.min(4, sortedJoints.length)) as any;
      }
      // Гарантируем что ключевые суставы (плечо, поясница, колено, таз) присутствуют если у них есть хоть минимальный стресс в плане
      const mustHave: JointId[] = ['shoulder','spine','knee','hip'] as JointId[];
      for (const must of mustHave) {
        if ((byJointPeak[must]||0) > 0 && !jointsToDiagnose.includes(must)) {
          jointsToDiagnose.push(must);
        }
      }
      // Если всё ещё мало — дополняем до 5 из fallback (чтобы плечо не терялось)
      if (jointsToDiagnose.length < 4) {
        const fallback: JointId[] = ['shoulder','spine','knee','hip','elbow','wrist','ankle'] as JointId[];
        for (const fb of fallback) {
          if (!jointsToDiagnose.includes(fb)) jointsToDiagnose.push(fb);
          if (jointsToDiagnose.length >= 5) break;
        }
      }
      // Сортируем снова по нагрузке чтобы самые нагруженные были первыми, но гарантируем плечо в топе если нагружено
      jointsToDiagnose = jointsToDiagnose.sort((a,b)=> (byJointPeak[b]||0)-(byJointPeak[a]||0));
      if (jointsToDiagnose.length > 7) jointsToDiagnose = jointsToDiagnose.slice(0,7) as any;
      // Финальный fallback если всё пусто
      if (jointsToDiagnose.length === 0) {
        jointsToDiagnose = (orthopedic?.blockedPatterns.length ? (['spine','shoulder','knee','hip','elbow','wrist','ankle'] as JointId[]) : ['spine','shoulder','knee','hip','elbow'] as JointId[]) as any;
      }
      jointDiagnoses = jointsToDiagnose.slice(0,7).map((jid: JointId) => {
        try { return jointLoadDiagnosis({ joint: jid, injuries: injuriesToHistory(options.injuries as any), mobilityRestrictions: options.mobilityRestrictions || [], currentPain: options.currentPain || [], jointLimitations: buildJointLimitations(options.injuries as any, options.mobilityRestrictions||[]) as any }); } catch { return null as any; }
      }).filter(Boolean);
      if (jointDiagnoses.length===0) {
        try { jointDiagnoses = [jointLoadDiagnosis({ joint: 'spine', injuries: [], mobilityRestrictions: options.mobilityRestrictions||[], currentPain: [] } as any)]; } catch {}
      }
    } catch { jointDiagnoses = []; }

    // Factor breakdown with calculations
    const factorBreakdown: SafetyDetails['factorBreakdown'] = [
      { key:'jointStress', label:'Суставной стресс', weight: SCORE_WEIGHTS.jointStress, score: jointStressScore, max: SCORE_WEIGHTS.jointStress, calculation: `20 - ${stressAnalysis.overallRisk==='high'?'20':stressAnalysis.overallRisk==='moderate'?'10':'0'} (overallRisk=${stressAnalysis.overallRisk}, peakWeek=${(stressAnalysis as any).peakWeek||'—'}, avg=${Math.round((stressAnalysis as any).avgWeeklyStress||0)})`, status: jointStressScore===20?'ok': jointStressScore>=10?'warn':'bad' },
      { key:'acwrCompliance', label:'ACWR', weight: SCORE_WEIGHTS.acwrCompliance, score: acwrScore, max: SCORE_WEIGHTS.acwrCompliance, calculation: hasAcwr ? `ACWR ${acwr.toFixed(2)} → ${acwr>1.5?'0':acwr>1.3?'10':'20'} (зоны: <1.3 ok, 1.3-1.5 warn, >1.5 bad)` : `нет данных → ${acwrScore} (75% от макс, осторожность)`, status: acwrScore===20?'ok': acwrScore>=10?'warn':'bad' },
      { key:'recovery', label:'Восстановление', weight: SCORE_WEIGHTS.recovery, score: recoveryScore, max: SCORE_WEIGHTS.recovery, calculation: `15 ${options.bodyFat!=null && options.bodyFat>25?'-4(bodyFat)':''} ${options.hrvMs!=null && options.hrvMs<50?'-4(HRV)':''} ${options.sleepHours!=null && options.sleepHours<6?'-4(sleep)':''} ${options.stressLevel!=null && options.stressLevel>6?'-3(stress)':''} = ${recoveryScore}`, status: recoveryScore>=12?'ok': recoveryScore>=8?'warn':'bad' },
      { key:'injuryRisk', label:'Травмы', weight: SCORE_WEIGHTS.injuryRisk, score: injuryScore, max: SCORE_WEIGHTS.injuryRisk, calculation: injuryCount>0 ? `15 - ${injuryCount}*5 = ${injuryScore}` : `15 (нет активных травм)`, status: injuryScore===15?'ok': injuryScore>=10?'warn':'bad' },
      { key:'volumeCompliance', label:'MRV', weight: SCORE_WEIGHTS.volumeCompliance, score: volumeScore, max: SCORE_WEIGHTS.volumeCompliance, calculation: volumeViolations>0 ? `15 - ${volumeViolations}*3 = ${volumeScore} (${volumeViolations} превышений effective > cap*${BB_MRV_TOLERANCE})` : `15 (нет превышений, допуск ×${BB_MRV_TOLERANCE})`, status: volumeScore===15?'ok': volumeScore>=9?'warn':'bad' },
      { key:'frequencyCompliance', label:'Частота', weight: SCORE_WEIGHTS.frequencyCompliance, score: frequencyScore, max: SCORE_WEIGHTS.frequencyCompliance, calculation: frequencyIssues.length ? `5 - min(5,${frequencyIssues.length}) = ${frequencyScore} (малые мышцы <2×/нед)` : `5 (частота в норме)`, status: frequencyScore===5?'ok':'warn' },
      { key:'balance', label:'Баланс', weight: SCORE_WEIGHTS.balance, score: balanceScore, max: SCORE_WEIGHTS.balance, calculation: balanceDetails ? `${10} - ${balanceDetails.issues.length}*2 = ${balanceScore} (${balanceDetails.issues.length} issues)` : `10`, status: balanceScore>=8?'ok': balanceScore>=6?'warn':'bad' },
    ];

    details = {
      jointStressDetails: {
        overallRisk: stressAnalysis.overallRisk as any,
        avgWeeklyStress: (stressAnalysis as any).avgWeeklyStress || 0,
        peakWeek: (stressAnalysis as any).peakWeek || 0,
        weeklyReports,
        byJointPeak,
        byJointAvg,
        thresholds: STRESS_THRESHOLDS as any,
        perJointCalculation: 'stress = base(jointStress low=3/med=6/high=10) × sets × proximity(1+max(0,2-RIR)*0.15) × intensity(1+min(0.5,(weight-60)/200)) → сумма по упражнениям → byJoint. Пороги сессии: low<15 moderate<25 high<40; неделя ×3.',
        mostLoadedJoint,
      },
      orthopedic,
      loadDistribution,
      jointDiagnoses,
      volumeDetails,
      frequencyDetails,
      balanceDetails: balanceDetails as any,
      factorBreakdown,
    };
  } catch {
    // details опциональны — не ломаем скоринг
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
    details,
  };
}
