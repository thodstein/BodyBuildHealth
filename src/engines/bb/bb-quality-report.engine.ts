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
  /** Сколько инстансов свернуто в эту строку (1 = одиночное). */
  count?: number;
  /** Недели инстансов (отсортированы, для детализации). */
  weeks?: number[];
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

/** Штраф за УНИКАЛЬНЫЙ код замечания (не за инстанс — валидатор спамит сотни копий). */
export const BB_QUALITY_ERR_CODE_PENALTY = 8;
export const BB_QUALITY_ERR_CODE_CAP = 16;
export const BB_QUALITY_WARN_CODE_PENALTY = 3;
export const BB_QUALITY_WARN_CODE_CAP = 15;

/** Штраф по множествам уникальных кодов (чистая функция, тестируется отдельно). */
export function penaltyForUniqueCodes(errCodes: string[], warnCodes: string[]): number {
  const err = Math.min(BB_QUALITY_ERR_CODE_CAP, new Set(errCodes).size * BB_QUALITY_ERR_CODE_PENALTY);
  const warn = Math.min(BB_QUALITY_WARN_CODE_CAP, new Set(warnCodes).size * BB_QUALITY_WARN_CODE_PENALTY);
  return err + warn;
}

const LEVEL_RANK: Record<BBQualityLevel, number> = { error: 0, warning: 1, info: 2 };

/** Свернуть список замечаний по коду: одна строка на вид + счётчик инстансов и недели. */
export function consolidateQualityIssues(list: BBQualityIssue[]): BBQualityIssue[] {
  const byCode = new Map<string, BBQualityIssue[]>();
  for (const i of list) {
    if (!byCode.has(i.code)) byCode.set(i.code, []);
    byCode.get(i.code)!.push(i);
  }
  const out: BBQualityIssue[] = [];
  for (const [code, items] of byCode) {
    const worst = items.slice().sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])[0];
    const weeks = Array.from(new Set(items.map(i => i.week).filter((w): w is number => typeof w === 'number'))).sort((a, b) => a - b);
    // Репрезентативное сообщение — самое короткое (компактно), плюс счётчик.
    const rep = items.slice().sort((a, b) => a.message.length - b.message.length)[0].message;
    out.push({
      source: items.some(i => i.source === 'validation') ? 'validation' : worst.source,
      level: worst.level,
      code,
      message: items.length > 1 ? `${rep} (×${items.length})` : rep,
      week: weeks.length ? weeks[0] : worst.week,
      weeks,
      count: items.length,
    });
  }
  // Ошибки первыми (по числу инстансов), затем предупреждения (по числу), затем info.
  out.sort((a, b) =>
    (LEVEL_RANK[a.level] - LEVEL_RANK[b.level]) || ((b.count ?? 0) - (a.count ?? 0)),
  );
  return out;
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

  const raw: BBQualityIssue[] = [];
  const push = (i: BBQualityIssue | null) => {
    if (i) raw.push(i);
  };

  for (const item of plan.validation?.issues ?? []) push(toIssue('validation', item));
  for (const item of plan.balanceReport?.issues ?? []) push(toIssue('balance', item));
  for (const item of plan.rotationReport?.issues ?? []) push(toIssue('rotation', item));
  for (const item of safety.issues ?? []) push(toIssue('safety', item));

  // Читаемый список: одна строка на вид замечания (со счётчиком ×N).
  const issues = consolidateQualityIssues(raw);

  // Единый скор: база — safety.score; штраф ТОЛЬКО за уникальные коды validation
  // (safety-внутренности — суставы/MRV/частота/баланс — уже учтены в safety.score,
  // повторный штраф был бы двойным учётом и давал 0 на обычных планах).
  const errCodes = raw.filter(i => i.source === 'validation' && i.level === 'error').map(i => i.code);
  const warnCodes = raw.filter(i => i.source === 'validation' && i.level === 'warning').map(i => i.code);
  const score = Math.max(0, Math.min(100, Math.round(safety.score - penaltyForUniqueCodes(errCodes, warnCodes))));
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
  // По одному представителю на уникальный код ошибки (не каждый инстанс).
  const seenErrCodes = new Set<string>();
  for (const i of raw) {
    if (i.source === 'validation' && i.level === 'error' && !seenErrCodes.has(i.code)) {
      seenErrCodes.add(i.code);
      recommendations.push(i.message);
    }
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
