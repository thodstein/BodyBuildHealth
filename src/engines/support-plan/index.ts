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
 *   - substances.ts — buildSubstances, buildScheduleFromPlan, computeWeekScale
 *   - systems.ts    — buildSystems, buildMechanisms, buildCoverageGaps,
 *                     buildUncoveredMechanisms, buildRiskDynamics, buildRiskBreakdown
 *   - display.ts    — buildSynergyComment, buildMonitoring, buildSpecialInstructions,
 *                     buildConflicts, buildLabFindings
 *   - stacks.ts     — recommendStacksLight
 *   - index.ts      — главный вызов runSupportUnified (этот файл)
 *
 *  Источник правды для веществ и риска: `calculateSupportTZ` (engine.ts в этой папке).
 *  Display-данные генерируются из каталога + ALL_INTERACTIONS + evaluateRecommendations.
 *
 *  Кнопки БАЗОВЫЙ/СРЕДНИЙ/МАКСИМУМ/БУСТ → powerLevel → target риск % (65/55/45/30).
 *  Кнопки 🔥Усиление / 🦴Суставы / ♀Репродукт. → флаги boostEnabled/jointMode/reproMode.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { calculateSupportTZ, hydrateState, nutritionDiaryTotalsToday } from './engine';
import { mechanismCoverageOf } from '../risk-engine-tz-spec';
import type { CalculatorState, CalculatorResult, PlanResult } from './types';
import { clamp } from './types';
import { buildSubstances, buildScheduleFromPlan, computeWeekScale } from './substances';
import { canonId } from './shared-constants';
import {
  buildSystems, buildMechanisms, buildCoverageGaps,
  buildUncoveredMechanisms, buildRiskDynamics, buildRiskBreakdown,
} from './systems';
import {
  buildSynergyComment, buildMonitoring, buildSpecialInstructions,
  buildConflicts, buildCautions, buildLabFindings,
  calcStackSynergyScore, suggestSynergyAdditions,
  buildDepletionWarnings, buildCumulativeLoad, buildPillBurden,
} from './display';
import { recommendStacksLight } from './stacks';
import { applyGeneticsToPlanSubs, applyDietAwareToPlanSubs } from '../support-genetics-diet.engine';
import { dietCoverage, annotatePlanSubsByDiet } from '../support-diet-coverage.engine';
import type { DietIntake, NutrientCoverage } from '../support-diet-coverage.engine';

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
  try {
    return runSupportUnifiedInner(state);
  } catch (err: any) {
    console.error('runSupportUnified error:', err);
    return {
      substances: [], dosages: {}, schedule: [], systems: {}, mechanisms: [],
      coveragePercent: 0, synergyComment: '', monitoring: [], specialInstructions: [],
      riskDynamics: [], overallRiskBefore: 50, overallRiskAfter: 50,
      labFindings: [], labFlagOverrides: [], uncoveredMechanisms: [], coverageGaps: [], weekScale: 1,
      stackRecommendations: [], conflicts: [], riskBreakdown: {},
      dietCoverageNotes: [], dietCoverage: [],
      pillBurden: { totalSubstances: 0, estimatedPillsPerDay: 0, morningPills: 0, afternoonPills: 0, eveningPills: 0, feasibility: 'unknown', message: 'Ошибка расчёта' },
      error: 'Ошибка расчёта поддержки: ' + (err?.message || 'неизвестная'),
    };
  }
}

function runSupportUnifiedInner(state: CalculatorState): PlanResult {
  // ── ОДИН вызов движка ──
  const tzRes = calculateSupportTZ(state);

  // ── 1. Substances (deduped, PlanSubstance[]) ──
  const weight = state.profile?.weight || 80;
  const rawSubs = buildSubstances(tzRes.selectedSubstances, tzRes, {
    boostAdded: tzRes.boostAdded,
    jointSubs: tzRes.jointSubs,
    neuroSubs: tzRes.neuroSubs,
  }, weight, tzRes.titrationFactors);

  // ── 1a. Опции подбора (opt-in, карточка «⚙️ Опции подбора»): генетика + учёт принятых ──
  // Опции выключены → байт-в-байт прежний план.
  const optionNotes: string[] = [];
  let substances = rawSubs;
  if (state.options?.geneticsOn) {
    const g = applyGeneticsToPlanSubs(substances, { mthfr: state.genetics?.mthfr, hfe: state.genetics?.hfe });
    substances = g.subs;
    optionNotes.push(...g.notes);
  }
  if (state.options?.dietAware) {
    const d = applyDietAwareToPlanSubs(substances, state.nutrition?.takenSupplements);
    substances = d.subs;
    optionNotes.push(...d.notes);
  }

  // ── 1b. Опция «🍽 рацион покрывает вещество» (opt-in): пометки, НЕ удаление ──
  // intake — только уже существующий агрегат дневника из engine.ts (сегодня).
  // Микронутриенты приходят из totals.micros и только при полноте по всем
  // записям дня; чего в дневнике нет (EPA+DHA) — остаётся undefined, и движок
  // честно вернёт 'unknown', а не выдуманные нули.
  const dietCoverageNotes: string[] = [];
  let dietCoverageRows: NutrientCoverage[] = [];
  if (state.options?.dietCoverage) {
    const totals = nutritionDiaryTotalsToday();
    const micros = totals?.micros || {};
    const intake: DietIntake = {
      fiberG: totals?.fiberG,
      potassiumMg: micros.potassium_mg,
      magnesiumMg: micros.magnesium_mg,
      calciumMg: micros.calcium_mg,
      ironMg: micros.iron_mg,
      // 1 мкг витамина D = 40 МЕ (см. норму в support-diet-coverage.engine.ts).
      vitaminDIu: typeof micros.vitamin_d_mcg === 'number' ? micros.vitamin_d_mcg * 40 : undefined,
    };
    dietCoverageRows = dietCoverage(intake);
    const annotated = annotatePlanSubsByDiet(substances, dietCoverageRows);
    substances = annotated.subs;
    dietCoverageNotes.push(...annotated.notes);
  }

  // ── 1c. Замечания безопасности (DDI блока и второго реестра) ──
  // Позиция НЕ удаляется: снять препарат может пользователь/врач, а не движок.
  // Но карточка и экспорт обязаны сказать «⛔ несовместимо» рядом с дозой.
  if (tzRes.safetyFlags) {
    const flags = tzRes.safetyFlags;
    // p5p — активная форма B6: второй реестр знает её только как VITAMIN_B6.
    const safetyAlias: Record<string, string> = { p5p: 'vitamin_b6' };
    substances = substances.map((s) => {
      const key = canonId(s.id);
      const list = flags[key] || flags[s.id] || flags[safetyAlias[key]];
      if (!list || list.length === 0) return s;
      const merged = [...new Set([...(s.safetyNote ? [s.safetyNote] : []), ...list])].join(' · ');
      return { ...s, safetyNote: merged };
    });
  }

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
  // ВНИМАНИЕ: величина = 100 − остаточный риск, а не доля закрытых механизмов.
  // Подписывать её «покрытием» нельзя — рядом считаем настоящее покрытие.
  const coveragePercent = clamp(100 - tzRes.overallRiskAfter);

  // ── 5a. Реальное покрытие механизмов ──
  // Знаменатель — механизмы, которые ДАЮТ риск в этом курсе (raw > 0), иначе
  // «покрытие» размывалось бы механизмами, к которым курс не относится.
  const mechanismCoverage = mechanismCoverageOf(tzRes.tzSpecResult);

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
  // Строим из готовых `substances`, а не из `DEFAULT_DOSAGES`: иначе расписание
  // расходится с карточкой при вес-зависимых дозах (магний 350 vs 200 мг).
  const schedule = buildScheduleFromPlan(substances);

  // ── 18. Depletion warnings ──
  const depletionWarnings = buildDepletionWarnings(tzRes);

  // ── 19. Cumulative nutrient load ──
  const cumulativeLoad = buildCumulativeLoad(tzRes);

  // ── 20. Pill burden ──
  const pillBurden = buildPillBurden(tzRes);

  return {
    substances,
    dosages,
    schedule,
    systems,
    mechanisms,
    coveragePercent,
    mechanismCoverage,
    synergyComment,
    monitoring,
    specialInstructions,
    riskDynamics,
    overallRiskBefore: Math.round(tzRes.overallRiskBefore),
    overallRiskAfter: Math.round(tzRes.overallRiskAfter),
    labFindings,
    // Флаги, перекрытые анализами (проход 105): анализы главнее анкеты, но оба
    // значения едут в результат, чтобы протокол показал, что именно перекрыто.
    labFlagOverrides: state.labFlagOverrides ?? [],
    uncoveredMechanisms,
    coverageGaps,
    weekScale,
    stackRecommendations,
    conflicts,
    riskBreakdown,
    depletionWarnings: depletionWarnings.length > 0 ? depletionWarnings : undefined,
    // UL по фактическим дозам плана: движок их считает (с учётом веса и UL-капа),
    // но экран поддержки не выводил — «Контроль дозировок» показывал типовые
    // дозы каталога, а не назначенные.
    ulWarnings: tzRes.ulWarnings && tzRes.ulWarnings.length > 0 ? tzRes.ulWarnings : undefined,
    cumulativeLoad: cumulativeLoad.length > 0 ? cumulativeLoad : undefined,
    pillBurden,
    phaseAssignedDrugs: tzRes.phaseAssignedDrugs,
    // Честность риска — тем же контрактом, что CalculatorResult/SupportScreen.
    riskStatus: tzRes.riskStatus,
    unmodeledDrugs: tzRes.unmodeledDrugs && tzRes.unmodeledDrugs.length > 0 ? tzRes.unmodeledDrugs : undefined,
    derivedSupport: tzRes.derivedSupport && tzRes.derivedSupport.length > 0 ? tzRes.derivedSupport : undefined,
    protocolWarnings: optionNotes.length > 0
      ? [...(tzRes.protocolWarnings || []), ...optionNotes]
      : tzRes.protocolWarnings,
    optionNotes: optionNotes.length > 0 ? optionNotes : undefined,
    // 🍽 опция «рацион покрывает вещество»: пустые массивы — опция выключена.
    dietCoverageNotes,
    dietCoverage: dietCoverageRows,
    // Что отбросила обрезка плана — в карточку и шеринг, а не в тишину.
    planTrim: tzRes.planTrim
      ? {
          ...tzRes.planTrim,
          // Опции (генетика/учёт рациона) могут пометить или добавить позиции:
          // показываем фактический список, а не срез до опций.
          shown: substances.length,
          candidates: Math.max(tzRes.planTrim.candidates, substances.length),
        }
      : undefined,
  };
}

/**
 * Возвращает риск по конкретному уровню поддержки (для сравнения База/Текущий).
 * Используется в UI для таблицы сравнения уровней.
 */
export function runSupportForLevel(
  state: CalculatorState,
  level: 'basic' | 'mid' | 'max' | 'boost'
): CalculatorResult {
  return calculateSupportTZ({ ...state, powerLevel: level });
}

// Re-export для обратной совместимости
export { calculateSupportTZ, hydrateState } from './engine';
export { generateSynergyRecommendations } from './engine-helpers';
export { SYNERGY_ID_LABELS, SYNERGY_ID_SUBSTANCES, TITRATION_RULES, SYSTEM_LABELS_RU, SYS_ORDER, clamp, sysName, sysEmoji, catalogEntry, defaultDosage } from './types';
export { canonId, SUB_ALIAS, TZ_AUTO_BLACKLIST, sameClassIds } from './shared-constants';
// Проход 136: какое поле бланка считается текущим — одно правило на все контуры.
export { currentLabSlice } from './lab-slice';
// Проход 141: число из поля бланка — одно правило чтения (граница, полоска, разряды).
// Проход 155: `labFieldEntry` — та же запись вместе со знаком границы (ручной ввод).
export { labFieldNumber, labFieldEntry, labFieldUnreadReason } from './lab-field-number';
export type { LabFieldEntry } from './lab-field-number';
export type { CalculatorState, CalculatorResult, PlanResult, PlanSubstance, PlanMechanism, StackRecommendation, RiskSystemId, PowerLevel, SynergyId, SystemRisk, MechanismDetail, LabDelta, ScheduleItem, TimeBlock, LabSlice, TimelineWeekData, LabPanelData, UserProfileData, NeuroStatusData, PharmaStackData, AASEntry, GoalsData, HepatobiliaryData, UrinaryData, CardiovascularData, ODAData, NutritionData, ContraindicationsData, ExperienceJournal, EpicrisisData, ToxicLoadData, DentalData, GeneticData, GIData, PsychData, InjectionData, Sex, CoursePhase, SynergyRecommendation, LabFlagOverride } from './types';
export { buildSynergyComment, buildMonitoring, buildSpecialInstructions, buildConflicts, buildCautions, buildLabFindings, calcStackSynergyScore, suggestSynergyAdditions, flagLevelRu } from './display';
