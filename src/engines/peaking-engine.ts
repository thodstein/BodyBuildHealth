/**
 * Peaking Engine — BB peak week output types.
 *
 * Фаза 5.30: из этого движка удалены все deprecated генераторы.
 * - PL-часть (generatePLPeaking / PLPeakingInput / PLPeakWeek / PLPeakingOutput) удалена
 *   (не была подключена ни к одному UI; канон ПЛ-тапера/пика: lms-taper.engine +
 *   lms-macro-taper.engine + pro/taper.engine).
 * - BB-часть (generateBBPeaking / BBPeakingInput) удалена — TaperPlannerTab уже
 *   строит пик-неделю из канона `bb-contest-prep.engine` (buildBBContestPrep) и
 *   использует только тип `BBPeakingOutput` для совместимости рендера.
 * - Мёртвые обёртки peakForPLMeet/peakForBBShow удалены из training-integration.
 *
 * @module peaking-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// BB Peaking Output (совместимость с TaperPlannerTab; источник — bb-contest-prep)
// ═══════════════════════════════════════════════════════════════════════════

export interface BBPeakingOutput {
  weekPlan: {
    day: number;
    training: string;
    carbs: string;
    water: string;
    sodium: string;
    posing: string;
  }[];
  recommendations: string[];
}
