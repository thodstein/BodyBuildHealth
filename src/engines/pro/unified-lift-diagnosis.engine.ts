/**
 * unified-lift-diagnosis.engine.ts — ЕДИНЫЙ АГРЕГАТОР ДИАГНОСТИКИ ДВИЖЕНИЯ.
 *
 * Сливает 5 слоёв на одном движении (пилот — жим лёжа, но работает для всех Lift):
 *   1. Слабые мышцы (weak-muscle-detection: e1RM-тренд по дневнику)
 *   2. Слабые точки (weakpoint-pl: фаза → assistance)
 *   3. Мёртвые точки (lift-diagnostics: углы/сустав/биомеханика)
 *   4. Движение штанги (bar-path)
 *   5. VBT (velocity loss → suggestedPhase + e1RM по скорости)
 *   + Лимитирующие факторы геометрии (technique_geometry: хват/локти/мост/кисть/траектория)
 *
 * Чистый движок: без UI, без localStorage. Переиспользует существующие движки 1-в-1
 * (parity: числа идентичны PlDeadpointsBarPathCard / StickingPointAnalysisCard).
 */

import type { Lift, WeakPoint } from '../lms/weakpoint-pl';
import { WEAK_POINTS_BY_LIFT } from '../lms/weakpoint-pl';
import {
  diagnoseMovement,
  barPathAnalysis,
  barPathIssuesForLift,
  type BarPathIssue,
  type MovementDiagnosis,
  type BarPathAnalysis,
  type LiftDiagnosis,
} from './lift-diagnostics.engine';
import { detectWeakMusclesByE1rm, type WeakMuscleSession, type WeakMuscleSignal } from './weak-muscle-detection.engine';
import { diagnoseVelocity, type VelocityDiagnosis, type VelocityLossThreshold } from './vbt.engine';
import {
  LIMITER_CATEGORIES,
  limiterOptionsFor,
  analyzeLimiterOption,
  type LimiterOption,
  type LimiterCategory,
  type LimiterExerciseItem,
} from './limiter-calculator.engine';
import { analyzePhaseAssistance, analyzeStickingCorrections, analyzeBarPathAssistance } from './lift-assistance.engine';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';

// ───────────────────── Типы ─────────────────────

export interface UnifiedWeakMuscleBlock {
  signals: WeakMuscleSignal[];
  groups: string[];
}

export interface UnifiedStickingBlock {
  phases: WeakPoint[];
  effectivePhase: WeakPoint | '';
  movement: MovementDiagnosis | null;
  stickingDiagnosis: LiftDiagnosis | null;
}

export interface UnifiedBarPathBlock {
  applicableIssues: BarPathIssue[];
  selectedIssues: BarPathIssue[];
  analysis: BarPathAnalysis | null;
}

export interface UnifiedVbtBlock {
  best: number | null;
  last: number | null;
  weightKg: number | null;
  threshold: VelocityLossThreshold;
  diagnosis: VelocityDiagnosis | null;
  vbtPhase: WeakPoint | null;
}

export interface UnifiedLimiterBlock {
  categories: typeof LIMITER_CATEGORIES;
  byCategory: Record<LimiterCategory, LimiterOption[]>;
  techniqueGeometry: { option: LimiterOption; items: LimiterExerciseItem[] }[];
  allForLift: LimiterOption[];
}

export interface UnifiedDiaryStickingBlock {
  lift: Lift;
  likelyPhase: WeakPoint | null;
  failureRate: number;
  totalHard: number;
  diagnosis: LiftDiagnosis | null;
}

export interface UnifiedLiftDiagnosis {
  lift: Lift;
  weakMuscles: UnifiedWeakMuscleBlock;
  phases: UnifiedStickingBlock;
  barPath: UnifiedBarPathBlock;
  vbt: UnifiedVbtBlock;
  limiter: UnifiedLimiterBlock;
  /** Короткая подсказка для header мастера. */
  headerHint: string;
}

export interface UnifiedLiftInput {
  lift: Lift;
  /** Выбранная фаза (пустая = берётся первая доступная). */
  phase?: WeakPoint | '';
  /** Выбранные bar-path отклонения. */
  barPathIssues?: BarPathIssue[];
  /** VBT ввод. */
  vbtBest?: string;
  vbtLast?: string;
  vbtWeight?: string;
  vbtThreshold?: VelocityLossThreshold;
  /** Сессии дневника для weak-muscle и diary-sticking. */
  sessions?: WeakMuscleSession[];
  /** Шаблон цикла для подбора ассистентов по раскладке. */
  template?: SRCycleTemplate | null;
}

// ───────────────────── Хелперы ─────────────────────

const LIFT_RU: Record<Lift, string> = {
  bench: 'Жим лёжа', squat: 'Присед', deadlift: 'Становая тяга (классика)',
  ohp: 'Жим стоя', row: 'Тяга в наклоне', pulldown: 'Тяга верхнего блока',
  incline_press: 'Жим на наклонной', sumo: 'Становая тяга (сумо)', biceps: 'Подъём на бицепс',
  triceps: 'Трицепс', calf: 'Икры', shrug: 'Трапеции (шраги)',
};

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function phasesForLift(lift: Lift): WeakPoint[] {
  return (WEAK_POINTS_BY_LIFT[lift] ?? []) as WeakPoint[];
}

function effectivePhaseFor(lift: Lift, phase?: WeakPoint | ''): WeakPoint | '' {
  const all = phasesForLift(lift);
  if (phase && (all as string[]).includes(phase)) return phase;
  // авто-выбор первой фазы с данными (weakPoint.assistance или sticking)
  for (const p of all) {
    const d = diagnoseMovement(lift, p);
    if (d.weakPoint.assistance.length > 0 || d.sticking != null) return p;
  }
  return (all[0] as WeakPoint | undefined) ?? '';
}

// ───────────────────── Главный агрегатор ─────────────────────

/**
 * Единая диагностика движения: слабые мышцы + слабые точки + мёртвые точки +
 * bar-path + VBT + лимитеры геометрии. Числа идентичны существующим карточкам.
 */
export function unifiedLiftDiagnosis(input: UnifiedLiftInput): UnifiedLiftDiagnosis {
  const { lift, barPathIssues = [], sessions = [], template } = input;
  const eff = effectivePhaseFor(lift, input.phase);
  const movement = eff ? diagnoseMovement(lift, eff) : null;

  // 1. Слабые мышцы (e1RM-тренд)
  const signals = detectWeakMusclesByE1rm(sessions);
  const weakMuscles: UnifiedWeakMuscleBlock = { signals, groups: signals.map(s => s.group) };

  // 2+3. Фазы / мёртвые точки
  const phases: UnifiedStickingBlock = {
    phases: phasesForLift(lift),
    effectivePhase: eff,
    movement,
    stickingDiagnosis: movement?.sticking ?? null,
  };

  // 4. Bar-path
  const applicableIssues = barPathIssuesForLift(lift);
  const selectedIssues = barPathIssues.filter(i => applicableIssues.includes(i));
  const barPath: UnifiedBarPathBlock = {
    applicableIssues,
    selectedIssues,
    analysis: selectedIssues.length ? barPathAnalysis(lift, selectedIssues) : null,
  };

  // 5. VBT
  const best = parseNum(input.vbtBest);
  const last = parseNum(input.vbtLast);
  const weightKg = parseNum(input.vbtWeight);
  const threshold: VelocityLossThreshold = input.vbtThreshold ?? 20;
  let diagnosis: VelocityDiagnosis | null = null;
  let vbtPhase: WeakPoint | null = null;
  if (best != null && last != null && best > 0 && last > 0 && last <= best) {
    diagnosis = diagnoseVelocity(lift, best, last, weightKg ?? undefined, threshold);
    vbtPhase = (diagnosis.suggestedPhase ?? eff) as WeakPoint | null;
  } else if (eff) {
    vbtPhase = eff;
  }
  const vbt: UnifiedVbtBlock = { best, last, weightKg, threshold, diagnosis, vbtPhase };

  // 6. Лимитеры
  const byCategory = {} as Record<LimiterCategory, LimiterOption[]>;
  for (const c of LIMITER_CATEGORIES) byCategory[c.id] = limiterOptionsFor(c.id, lift);
  const techniqueGeometry = limiterOptionsFor('technique_geometry', lift).map(analyzeLimiterOption);
  const limiter: UnifiedLimiterBlock = {
    categories: LIMITER_CATEGORIES,
    byCategory,
    techniqueGeometry,
    allForLift: LIMITER_CATEGORIES.flatMap(c => limiterOptionsFor(c.id, lift)),
  };

  // Header hint
  const parts: string[] = [];
  parts.push(LIFT_RU[lift] ?? lift);
  if (eff) parts.push(`фаза: ${eff}`);
  if (signals.length) parts.push(`слабые: ${signals.map(s => s.label).join(', ')}`);
  if (diagnosis) parts.push(`VBT ${diagnosis.lossPct}% ${diagnosis.zone}`);
  if (techniqueGeometry.length) parts.push(`геометрия: ${techniqueGeometry.length} парам.`);
  const headerHint = parts.join(' · ');

  void template;
  return { lift, weakMuscles, phases, barPath, vbt, limiter, headerHint };
}

// ───────────────────── Утилиты для UI ─────────────────────

/** Группы, связанные с фазой (для подсветки «Слабые мышцы → фаза»). */
export function groupsForPhase(lift: Lift, phase: WeakPoint): string[] {
  const mv = diagnoseMovement(lift, phase);
  const set = new Set<string>();
  // из sticking weakMuscles → PL-группа (упрощённо)
  if (mv.sticking) {
    for (const m of mv.sticking.weakMuscles) {
      const l = m.toLowerCase();
      if (/трицеп|бицеп|arm/.test(l)) set.add('arms');
      else if (/дельт|плеч/.test(l)) set.add('shoulders');
      else if (/груд|chest/.test(l)) set.add('chest');
      else if (/спин|широч|трап|lat|back/.test(l)) set.add('back');
      else if (/квадр|ягод|бедр|ног|leg|quad|glute/.test(l)) set.add('legs');
      else if (/кор|core|пресс|ab/.test(l)) set.add('core');
    }
  }
  // fallback по движению
  const FALLBACK: Record<Lift, string[]> = {
    bench: ['chest', 'arms'], squat: ['legs'], deadlift: ['back', 'legs'],
    ohp: ['shoulders', 'arms'], row: ['back', 'arms'], pulldown: ['back', 'arms'],
    incline_press: ['chest', 'arms'], sumo: ['legs', 'back'], biceps: ['arms'],
    triceps: ['arms'], calf: ['legs'], shrug: ['back', 'shoulders'],
  };
  for (const g of (FALLBACK[lift] ?? [])) set.add(g);
  return [...set];
}

/** Анализы для UI (ассистенты по каждому слою) — тонкая обёртка над lift-assistance. */
export function analysesForUnified(input: UnifiedLiftInput) {
  const eff = effectivePhaseFor(input.lift, input.phase);
  const tpl = input.template ?? undefined;
  return {
    effectivePhase: eff,
    phaseAnalysis: eff ? analyzePhaseAssistance(input.lift, eff, tpl) : null,
    stickingAnalysis: eff ? analyzeStickingCorrections(input.lift, eff, tpl) : null,
    barPathAnalyses: Object.fromEntries((input.barPathIssues ?? []).map(i => [i, analyzeBarPathAssistance(input.lift, i, tpl)])),
    techniqueGeometry: limiterOptionsFor('technique_geometry', input.lift).map(analyzeLimiterOption),
  };
}

export const UNIFIED_LIFT_RU = LIFT_RU;
