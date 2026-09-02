/**
 * bb-quality-report.engine.ts — ЕДИНЫЙ отчёт качества ББ-плана (Epic F, план BB-AUTO-PROFESSIONAL-AUDIT).
 *
 * Агрегирует разрозненные источники «качества» (validation / balance / rotation / fatigue /
 * safetyScore / weeklyVolume) в ОДИН объект с дедуплицированным списком замечаний и единым
 * скором 0-100. Устраняет проблему «3-4 разных качества, не соответствующие друг другу».
 *
 * Источники НЕ пересчитываются заново здесь — читаются из уже заполненных полей BBPlan
 * (plan.validation / balanceReport / rotationReport / weeklyVolume / expandedSummary);
 * safetyScore вычисляется calculatePlanSafetyScore с ПЕРЕДАННЫМ balanceReport (не дублирует analyzeBBBalance).
 *
 * Капы не меняются — это только отчётность.
 */

import { calculatePlanSafetyScore } from './bb-safety-score.engine';

export type BBQualitySource = 'validation' | 'balance' | 'rotation' | 'fatigue' | 'safety';
export type BBQualityLevel = 'error' | 'warning' | 'info';

export interface BBQualityIssue {
  source: BBQualitySource;
  level: BBQualityLevel;
  code: string;
  message: string;
  week?: number;
  muscle?: string;
}

export interface BBQualityReport {
  /** Единый скор 0-100 (safety-база − штрафы за validation-замечания). */
  score: number;
  riskLevel: 'danger' | 'caution' | 'ok';
  safetyScore: number;
  issues: BBQualityIssue[];
  recommendations: string[];
  totalWorkingSets: number;
  peakWeek: number;
  /** Скор по неделям (для справки). */
  perWeek: { week: number; plannedSets: number }[];
  validationValid: boolean;
}

interface AnyIssueLike {
  level?: string;
  code?: string;
  message?: string;
  text?: string;
  week?: number;
  exercise?: string | number;
  muscle?: string;
}

function normLevel(level?: string): BBQualityLevel {
  return level === 'error' ? 'error' : level === 'info' ? 'info' : 'warning';
}

/** Нормализовать issue любого источника (строка или объект). */
function toIssue(source: BBQualitySource, raw: AnyIssueLike | string): BBQualityIssue | null {
  if (typeof raw === 'string') {
    if (!raw.trim()) return null;
    return { source, level: source === 'safety' ? 'warning' : 'warning', code: `${source}_issue`, message: raw };
  }
  if (!raw) return null;
  const message = raw.message || raw.text;
  if (!message) return null;
  const week = typeof raw.week === 'number' ? raw.week : undefined;
  const muscle = typeof raw.muscle === 'string' ? raw.muscle : (typeof raw.exercise === 'string' ? raw.exercise : undefined);
  return {
    source,
    level: normLevel(raw.level),
    code: raw.code || `${source}_issue`,
    message,
    week,
    muscle,
  };
}

/** Сигнатура для дедупа (code|week|muscle|message). */
function issueKey(i: BBQualityIssue): string {
  return `${i.code}|${i.week ?? ''}|${i.muscle ?? ''}|${i.message}`;
}

interface QualityPlanLike {
  weeks?: Array<{ week: number; sessions: unknown[] }>;
  validation?: { issues?: Array<AnyIssueLike | string>; valid?: boolean } | null;
  balanceReport?: { issues?: string[] } | null;
  rotationReport?: { issues?: Array<AnyIssueLike | string> } | null;
  fatigueReport?: unknown;
  weeklyVolume?: Record<number, Record<string, unknown>>;
  expandedSummary?: { totalWorkingSets?: number } | null;
  inputSnapshot?: Record<string, unknown>;
  safetyConstraints?: Record<string, unknown>;
  volumeTargets?: Record<string, unknown>;
}

/**
 * Построить единый отчёт качества. План с реквизитами; опционально данные восстановления
 * (ACWR/сон/HRV/стресс/травмы) для safety-скора.
 */
export function buildBBQualityReport(plan: QualityPlanLike, opts: {
  acwrRatio?: number;
  bodyFat?: number;
  hrvMs?: number;
  sleepHours?: number;
  stressLevel?: number;
  injuries?: Array<{ muscle: string; exclude?: boolean; weightPct?: number; volumePct?: number }>;
  mobilityRestrictions?: string[];
} = {}): BBQualityReport {
  const safety = calculatePlanSafetyScore(plan as never, {
    ...opts,
    balanceReport: (plan.balanceReport as unknown as import('./bb-balance.engine').BBBalanceReport) ?? null,
  });

  const issues: BBQualityIssue[] = [];
  const seen = new Set<string>();

  const push = (i: BBQualityIssue | null) => {
    if (!i) return;
    const k = issueKey(i);
    if (seen.has(k)) return;
    seen.add(k);
    issues.push(i);
  };

  for (const raw of plan.validation?.issues ?? []) push(toIssue('validation', raw));
  for (const raw of plan.balanceReport?.issues ?? []) push(toIssue('balance', raw));
  for (const raw of plan.rotationReport?.issues ?? []) push(toIssue('rotation', raw));
  for (const raw of safety.issues ?? []) push(toIssue('safety', raw));

  // Единый скор: база — safety.score (0-100), штрафы за validation error/warning.
  let score = safety.score;
  for (const raw of plan.validation?.issues ?? []) {
    const i = toIssue('validation', raw);
    if (!i) continue;
    score -= i.level === 'error' ? 10 : 3;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const riskLevel: BBQualityReport['riskLevel'] = score < 60 ? 'danger' : score < 75 ? 'caution' : 'ok';

  const totalWorkingSets = typeof plan.expandedSummary?.totalWorkingSets === 'number'
    ? plan.expandedSummary.totalWorkingSets
    : 0;

  const perWeek: BBQualityReport['perWeek'] = [];
  if (plan.weeklyVolume) {
    for (const [wk, byMuscle] of Object.entries(plan.weeklyVolume)) {
      let sets = 0;
      for (const v of Object.values(byMuscle as Record<string, { directSets?: number }>)) {
        sets += Number((v as { directSets?: number }).directSets) || 0;
      }
      perWeek.push({ week: Number(wk), plannedSets: sets });
    }
    perWeek.sort((a, b) => a.week - b.week);
  }
  const peakWeek = perWeek.length ? perWeek.reduce((a, b) => (b.plannedSets > a.plannedSets ? b : a)).week : 0;

  const recommendations: string[] = [...(safety.recommendations ?? [])];
  for (const raw of plan.validation?.issues ?? []) {
    const i = toIssue('validation', raw);
    if (i && i.level === 'error') recommendations.push(i.message);
  }

  return {
    score,
    riskLevel,
    safetyScore: safety.score,
    issues,
    recommendations,
    totalWorkingSets,
    peakWeek,
    perWeek,
    validationValid: plan.validation?.valid !== false,
  };
}

/** RU-строка сводки единого качества для UI. */
export function bbQualityReportSummary(r: BBQualityReport): string {
  const err = r.issues.filter(i => i.level === 'error').length;
  const warn = r.issues.filter(i => i.level === 'warning').length;
  return `Качество ${r.score}/100 (${r.riskLevel === 'ok' ? 'хорошо' : r.riskLevel === 'caution' ? 'осторожно' : 'риск'}) · ${err} ошибок, ${warn} предупреждений · рабочих сетов ${r.totalWorkingSets}`;
}

/** Бейдж риска для UI. */
export function bbQualityBadge(riskLevel: 'danger' | 'caution' | 'ok'): { label: string; color: string } {
  if (riskLevel === 'danger') return { label: '🔴 риск', color: '#f87171' };
  if (riskLevel === 'caution') return { label: '🟠 осторожно', color: '#fbbf24' };
  return { label: '🟢 хорошо', color: '#00e68a' };
}
