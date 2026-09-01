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
