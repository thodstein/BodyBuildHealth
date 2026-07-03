/**
 * ──────────────────────────────────────────────────────────────────────────
 *  ЕДИНЫЙ ДВИЖОК ПОДДЕРЖКИ — support-plan/index.ts
 * ──────────────────────────────────────────────────────────────────────────
 *  ОДИН вызов `runSupportUnified(state)` → PlanResult.
 *  Заменяет связку «calculateSupportPlan + calculateSupportTZ + ручной merge»,
 *  которая порождала дубли веществ, разные цифры риска и «непонятные препараты».
 *
 *  Структура папки support-plan/:
 *   - types.ts      — константы, утилиты (SYSTEM_LABELS_RU, clamp, catalogEntry)
 *   - substances.ts — buildSubstances, buildSchedule, computeWeekScale
 *   - systems.ts    — buildSystems, buildMechanisms, buildCoverageGaps,
 *                     buildUncoveredMechanisms, buildRiskDynamics, buildRiskBreakdown
 *   - display.ts    — buildSynergyComment, buildMonitoring, buildSpecialInstructions,
 *                     buildConflicts, buildLabFindings
 *   - stacks.ts     — recommendStacksLight
 *   - index.ts      — главный вызов runSupportUnified (этот файл)
 *
 *  Источник правды для веществ и риска: `calculateSupportTZ` (support-calculator.engine).
 *  Display-данные генерируются из каталога + ALL_INTERACTIONS + evaluateRecommendations.
 *
 *  Кнопки БАЗОВЫЙ/СРЕДНИЙ/МАКСИМУМ/БУСТ → powerLevel → target риск % (65/55/45/30).
 *  Кнопки 🔥Усиление / 🦴Суставы / ♀Репродукт. → флаги boostEnabled/jointMode/reproMode.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { calculateSupportTZ } from '../support-calculator.engine';
import type { CalculatorState } from '../support-calculator.types';
import type { PlanResult } from '../support-plan-engine';
import { clamp } from './types';
import { buildSubstances, buildSchedule, computeWeekScale } from './substances';
import {
  buildSystems, buildMechanisms, buildCoverageGaps,
  buildUncoveredMechanisms, buildRiskDynamics, buildRiskBreakdown,
} from './systems';
import {
  buildSynergyComment, buildMonitoring, buildSpecialInstructions,
  buildConflicts, buildLabFindings,
} from './display';
import { recommendStacksLight } from './stacks';

/**
 * ЕДИНЫЙ расчёт поддержки: вещества + риски + display-данные.
 * Один вызов — один результат. Без двойных движков и дублирования.
 *
 * Логика:
 *  1. calculateSupportTZ(state) → вещества (mandatory + lab-recommended + breadth + targeted)
 *     + риск до/после (TZ spec engine: 28 механизмов × 6 систем).
 *  2. Display-данные генерируются здесь из каталога + ALL_INTERACTIONS + evaluateRecommendations.
 */
export function runSupportUnified(state: CalculatorState): PlanResult {
  // ── ОДИН вызов движка ──
  const tzRes = calculateSupportTZ(state);

  // ── 1. Substances (deduped, PlanSubstance[]) ──
  const substances = buildSubstances(tzRes.selectedSubstances, tzRes);

  // ── 2. Dosages ──
  const dosages: Record<string, { mg: number; timing: string }> = {};
  for (const s of substances) {
    dosages[s.id] = { mg: s.doseMg, timing: s.timing };
  }

  // ── 3. Systems ──
  const systems = buildSystems(tzRes);

  // ── 4. Mechanisms ──
  const mechanisms = buildMechanisms(tzRes);

  // ── 5. Coverage percent (clamped ≤100, BUG 14) ──
  const coveragePercent = clamp(100 - tzRes.overallRiskAfter);

  // ── 6. Synergy comment ──
  const synergyComment = buildSynergyComment(tzRes.selectedSubstances);

  // ── 7. Monitoring ──
  const monitoring = buildMonitoring(tzRes.selectedSubstances);

  // ── 8. Special instructions ──
  const specialInstructions = buildSpecialInstructions(tzRes.selectedSubstances);

  // ── 9. Risk dynamics ──
  const riskDynamics = buildRiskDynamics(tzRes);

  // ── 10. Lab findings ──
  const labFindings = buildLabFindings(state, tzRes);

  // ── 11. Uncovered mechanisms ──
  const uncoveredMechanisms = buildUncoveredMechanisms(tzRes);

  // ── 12. Coverage gaps ──
  const coverageGaps = buildCoverageGaps(tzRes);

  // ── 13. Week scale ──
  const weekScale = computeWeekScale(state.courseWeek);

  // ── 14. Stack recommendations ──
  const stackRecommendations = recommendStacksLight(state, tzRes);

  // ── 15. Conflicts ──
  const conflicts = buildConflicts(tzRes.selectedSubstances);

  // ── 16. Risk breakdown ──
  const riskBreakdown = buildRiskBreakdown(state, tzRes);

  // ── 17. Schedule ──
  const schedule = buildSchedule(tzRes.selectedSubstances);

  return {
    substances,
    dosages,
    schedule,
    systems,
    mechanisms,
    coveragePercent,
    synergyComment,
    monitoring,
    specialInstructions,
    riskDynamics,
    overallRiskBefore: Math.round(tzRes.overallRiskBefore),
    overallRiskAfter: Math.round(tzRes.overallRiskAfter),
    labFindings,
    uncoveredMechanisms,
    coverageGaps,
    weekScale,
    stackRecommendations,
    conflicts,
    riskBreakdown,
  };
}

/**
 * Возвращает риск по конкретному уровню поддержки (для сравнения База/Текущий).
 * Используется в UI для таблицы сравнения уровней.
 */
export function runSupportForLevel(
  state: CalculatorState,
  level: 'basic' | 'mid' | 'max' | 'boost'
): PlanResult {
  return runSupportUnified({ ...state, powerLevel: level });
}
