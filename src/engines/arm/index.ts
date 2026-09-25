/**
 * arm/index.ts — баррель арм-движка.
 */
export * from './arm-types';
export * from './arm-day-types';
export * from './arm-split-patterns';
export * from './arm-volume-landmarks.engine';
export * from './arm-volume.engine';
export { rankArmSplits, selectBestArmSplit } from './arm-selector.engine';
export * from './arm-builder.engine';
export * from './arm-finalize.engine';
export * from './arm-specialization.engine';
export { normalizeArmTradeoff, applyArmTradeoffToPlan } from './arm-tradeoff.engine';
export * from './arm-weakpoint.engine';
export { GRIP_IMPLEMENTS, getGripSpec, gripVolumeFor, gripProgression, estimateGripMax } from './arm-grip.engine';
export * from './arm-taper.engine';
export * from './arm-injury-guard.engine';
export * from './arm-table.engine';
export * from './arm-macrocycle.engine';
export * from './arm-progression.engine';
export * from './arm-validator.engine';
export * from './arm-metrics.engine';
export * from './arm-report.engine';
export * from './arm-export.engine';
export * from './arm-annual';
export * from './manual-draft-arm.engine';
export * from './arm-waf.engine';
export * from './arm-pro7.engine';
export {
  ARM_RULEBOOK_REGISTRY,
  ARMLIFTING_USA_2026_SNAPSHOT,
  WAF_2025_SNAPSHOT,
  createRulebookRegistry,
  getImplementProtocol,
  getImplementProtocolFor,
  getRulebookSnapshot,
  getRulebookSnapshotFor,
} from './arm-rulebook';
export type {
  ArmliftingAttemptMode,
  ArmliftingAttemptPolicy,
  ArmliftingMissConsequence,
  ArmliftingUsaImplement,
  ArmliftingUsaRuleset,
  ArmliftingWeightOrder,
  ArmSex,
  ArmSide,
  ImplementProtocol,
  RulebookAuthority,
  RulebookRegistry,
  RulebookRules,
  RulebookSchemaVersion,
  RulebookScope,
  RulebookSnapshot,
  RulebookSource,
  WafAgeRule,
  WafBracketRules,
  WafCategoryAgeBand,
  WafCategoryRule,
  WafParaStyle,
  WafRuleset,
  WafWeighInRules,
  WafWeightClass,
} from './arm-rulebook';
export type { WafAgeGroup as RulebookWafAgeGroup, WafParaClass as RulebookWafParaClass } from './arm-rulebook';
export * from './arm-rulebook-eligibility.engine';
export * from './arm-rulebook-simulation.engine';
export * from './arm-rulebook-registry.storage';
export * from './arm-bilateral.engine';
export * from './arm-supermatch.engine';
export * from './arm-start-strap.engine';
export * from './arm-sparring.engine';
export * from './arm-load-quant.engine';
export * from './arm-diary-autoreg.engine';
export * from './arm-competition-prep.engine';
export * from './arm-video-analysis.engine';
export * from './arm-platform.engine';
export * from './arm-pro-integration.engine';
export * from './arm-matchup.engine';
export * from './arm-rfd.engine';
export * from './arm-grip-rpe.engine';
export * from './arm-implement-ladder.engine';
export * from './arm-contest-sim.engine';
export * from './arm-longevity.engine';
export * from './arm-rehab.engine';
export * from './arm-tendon-fuel.engine';
export * from './arm-warmup.engine';
export * from './arm-cns-guard.engine';
export * from './arm-lr-split.engine';
export * from './arm-table-iq.engine';
export * from './arm-calendar.engine';
export * from './arm-sim-apply.engine';
export * from './arm-table-inject.engine';
export * from './arm-grip-protocol.engine';
export * from './arm-cycle-library.engine';
export * from './arm-cycle-selector.engine';
export * from './arm-coc-ladder.engine';
export * from './arm-flat-pyramid.engine';
export * from './arm-regimen.engine';
export * from './arm-humerus-axis.engine';
export * from './arm-antagonist.engine';
export * from './arm-medley.engine';
export * from './arm-for.engine';
