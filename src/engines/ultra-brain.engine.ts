import type { ReadinessScores, CourseEntry } from '../core/types';
import type { CyclePlan } from './cycle-types.engine';
import type { AutoregulationAdjustment } from './autoregulation.engine';
import type { PipelineOutput, PipelineWeek } from './training-pipeline.engine';
import type { SplitCandidate } from './split-selector.engine';
import { calculatePRI, getPRIThreshold } from './autoregulation.engine';

export interface BrainInput {
  goal: string;
  level: string;
  currentWeek: number;
  weeksInCycle: number;
  cyclePlan?: CyclePlan;
  splitRecommendation?: SplitCandidate[];
  pipelinePlan?: PipelineOutput;
  readiness: ReadinessScores;
  doms: number;
  sleepQuality: number;
  stress: number;
  trainingLoadRatio: number;
  recentPerformance: { rpe: number; volume: number; completed: boolean }[];
  injuryHistory: string[];
  activeDrugs?: CourseEntry[];
  supportCoverage?: Record<string, number>;
  nutritionAdherence?: number;
  weakPoints: string[];
}

export interface CrossDomainRisk {
  domain: string;
  impact: number;
  recommendation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BrainWeekDecision {
  week: number;
  action: 'train_normally' | 'train_conservative' | 'deload' | 'skip' | 'test_max' | 'recovery_focus';
  confidence: number;
  reasoning: string[];
  volumeOverride: number | null;
  intensityOverride: number | null;
  splitOverride: string | null;
  crossDomainRisks: CrossDomainRisk[];
  longTermRecommendations: string[];
}

export interface BrainSummary {
  totalWeeks: number;
  decisions: BrainWeekDecision[];
  overallReadiness: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  keyRecommendations: string[];
}

const RISK_DOMAINS: { domain: string; check: (i: BrainInput) => { impact: number; severity: CrossDomainRisk['severity']; rec: string } | null }[] = [
  {
    domain: 'TrainingLoad',
    check: (i) => {
      if (i.trainingLoadRatio > 1.5) return { impact: 0.3, severity: 'high', rec: 'ACWR > 1.5 — риск перетренированности. Снизьте объём на 20-30%' };
      if (i.trainingLoadRatio > 1.2) return { impact: 0.15, severity: 'medium', rec: 'ACWR повышен. Контролируйте восстановление' };
      return null;
    },
  },
  {
    domain: 'Recovery',
    check: (i) => {
      if (i.readiness.recovery < 30) return { impact: 0.4, severity: 'critical', rec: 'Критическое восстановление — рекомендуется неделя отдыха' };
      if (i.readiness.recovery < 50) return { impact: 0.25, severity: 'high', rec: 'Низкое восстановление — снизьте объём на 30-40%' };
      return null;
    },
  },
  {
    domain: 'Fatigue',
    check: (i) => {
      if (i.readiness.fatigue > 80) return { impact: 0.35, severity: 'critical', rec: 'Критическая усталость — пропустите тренировку' };
      if (i.readiness.fatigue > 65) return { impact: 0.2, severity: 'high', rec: 'Высокая усталость — консервативный режим' };
      return null;
    },
  },
  {
    domain: 'Nutrition',
    check: (i) => {
      if (i.nutritionAdherence !== undefined && i.nutritionAdherence < 40) return { impact: 0.2, severity: 'high', rec: 'Низкая приверженность питанию — скорректируйте цель или рацион' };
      return null;
    },
  },
  {
    domain: 'Injury',
    check: (i) => {
      if (i.injuryHistory.length > 0) return { impact: 0.15 * Math.min(3, i.injuryHistory.length), severity: 'medium', rec: `${i.injuryHistory.length} травм в анамнезе — избегайте упражнений с высоким риском` };
      return null;
    },
  },
  {
    domain: 'Performance',
    check: (i) => {
      const recent = i.recentPerformance;
      if (recent.length >= 3) {
        const last3 = recent.slice(-3);
        const declining = last3.every(s => s.rpe >= 8) && last3.some(s => !s.completed);
        if (declining) return { impact: 0.25, severity: 'high', rec: 'Спад производительности — снизьте интенсивность на 1 RIR' };
      }
      return null;
    },
  },
];

export function evaluateBrain(input: BrainInput): BrainSummary {
  const pri = calculatePRI(input.readiness, input.doms, input.sleepQuality, input.stress);
  const priThreshold = getPRIThreshold(pri);

  const decisions: BrainWeekDecision[] = [];
  const allRisks: CrossDomainRisk[] = [];

  for (const domain of RISK_DOMAINS) {
    const risk = domain.check(input);
    if (risk) allRisks.push({ domain: domain.domain, impact: risk.impact, severity: risk.severity, recommendation: risk.rec });
  }

  const totalWeeks = input.cyclePlan?.totalWeeks || input.weeksInCycle || 12;

  for (let w = 1; w <= totalWeeks; w++) {
    const weekDecision = decideWeek(input, pri, priThreshold.label, w, allRisks);
    decisions.push(weekDecision);
  }

  const maxRisk = allRisks.reduce(
    (max, r) => {
      const levels: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      return levels[r.severity] > levels[max.severity] ? r : max;
    },
    { severity: 'low' as CrossDomainRisk['severity'] }
  ).severity;

  const keyRecs = extractKeyRecommendations(decisions, allRisks);

  return {
    totalWeeks,
    decisions,
    overallReadiness: pri,
    riskLevel: maxRisk,
    keyRecommendations: keyRecs,
  };
}

function decideWeek(
  input: BrainInput,
  pri: number,
  priLabel: string,
  week: number,
  risks: CrossDomainRisk[]
): BrainWeekDecision {
  const reasoning: string[] = [];
  let action: BrainWeekDecision['action'] = 'train_normally';
  let confidence = 0.8;
  let volumeOverride: number | null = null;
  let intensityOverride: number | null = null;
  let splitOverride: string | null = null;

  const criticalRisks = risks.filter(r => r.severity === 'critical');
  const highRisks = risks.filter(r => r.severity === 'high');
  const hasDeloadThisWeek = input.cyclePlan?.weekPlans.find(wp => wp.week === week)?.isDeload || false;

  // Critical risks → skip or deload
  if (criticalRisks.length > 0) {
    action = 'skip';
    confidence = 0.9;
    reasoning.push(...criticalRisks.map(r => r.recommendation));
    if (hasDeloadThisWeek) {
      action = 'recovery_focus';
      reasoning.push('Делоад + критические риски → полный фокус на восстановление');
    }
    return buildDecision(week, action, confidence, reasoning, null, null, null, risks);
  }

  // High risks → conservative or deload
  if (highRisks.length >= 2 || pri < 40) {
    action = hasDeloadThisWeek ? 'deload' : 'train_conservative';
    confidence = 0.75;
    volumeOverride = 0.5;
    intensityOverride = 0.7;
    reasoning.push(...highRisks.map(r => r.recommendation));
    reasoning.push(`PRI ${pri} (${priLabel}) — консервативный режим`);
    return buildDecision(week, action, confidence, reasoning, volumeOverride, intensityOverride, null, risks);
  }

  if (highRisks.length === 1) {
    action = 'train_conservative';
    confidence = 0.7;
    volumeOverride = 0.75;
    reasoning.push(highRisks[0].recommendation);
    reasoning.push(`PRI ${pri} (${priLabel}) — умеренный режим`);
    return buildDecision(week, action, confidence, reasoning, volumeOverride, intensityOverride, null, risks);
  }

  // Performance-based test max suggestion
  if (pri >= 85 && !hasDeloadThisWeek) {
    const recent = input.recentPerformance.slice(-3);
    if (recent.length >= 2 && recent.every(s => s.rpe <= 7 && s.completed)) {
      action = 'test_max';
      confidence = 0.6;
      reasoning.push('PRI отличный, производительность стабильна — возможно тестирование максимумов');
      return buildDecision(week, action, confidence, reasoning, volumeOverride, intensityOverride, null, risks);
    }
  }

  // Phase-based decisions
  if (hasDeloadThisWeek) {
    action = 'deload';
    reasoning.push('Плановая разгрузка');
    return buildDecision(week, action, confidence, reasoning, 0.5, 0.6, null, risks);
  }

  // Normal training
  reasoning.push(`PRI ${pri} (${priLabel}) — нормальный режим тренировок`);
  return buildDecision(week, action, confidence, reasoning, volumeOverride, intensityOverride, null, risks);
}

function buildDecision(
  week: number,
  action: BrainWeekDecision['action'],
  confidence: number,
  reasoning: string[],
  volumeOverride: number | null,
  intensityOverride: number | null,
  splitOverride: string | null,
  risks: CrossDomainRisk[]
): BrainWeekDecision {
  const longTermRecs: string[] = [];
  if (action === 'test_max') longTermRecs.push('Запланируйте делоад после тестирования максимумов');
  if (action === 'skip' || action === 'recovery_focus') longTermRecs.push('После восстановления вернитесь к плану с 80% объёма на первую неделю');

  return {
    week,
    action,
    confidence: Math.round(confidence * 100),
    reasoning,
    volumeOverride,
    intensityOverride,
    splitOverride,
    crossDomainRisks: risks,
    longTermRecommendations: longTermRecs,
  };
}

function extractKeyRecommendations(decisions: BrainWeekDecision[], risks: CrossDomainRisk[]): string[] {
  const recs: string[] = [];
  const skipOrRecovery = decisions.filter(d => d.action === 'skip' || d.action === 'recovery_focus');
  const conservativeWeeks = decisions.filter(d => d.action === 'train_conservative');
  const testMaxWeeks = decisions.filter(d => d.action === 'test_max');

  if (skipOrRecovery.length > 0) {
    recs.push(`${skipOrRecovery.length} недель рекомендуется пропустить или посвятить восстановлению`);
  }

  if (conservativeWeeks.length > decisions.length * 0.5) {
    recs.push('Более 50% недель в консервативном режиме — рассмотрите увеличение восстановления или корректировку целей');
  }

  if (testMaxWeeks.length > 0) {
    recs.push(`${testMaxWeeks.length} недель подходят для тестирования максимумов — хороший знак`);
  }

  for (const r of risks.slice(0, 3)) {
    recs.push(`[${r.domain}] ${r.recommendation}`);
  }

  return recs.slice(0, 5);
}

export function getBrainActionEmoji(action: BrainWeekDecision['action']): string {
  switch (action) {
    case 'skip': return '⛔';
    case 'deload': return '🔄';
    case 'recovery_focus': return '🌿';
    case 'train_conservative': return '⚠️';
    case 'test_max': return '🔥';
    case 'train_normally': return '✅';
  }
}
