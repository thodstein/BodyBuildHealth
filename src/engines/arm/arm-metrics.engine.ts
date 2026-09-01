/**
 * arm-metrics.engine.ts — метрики арм-плана (как bb-metrics).
 */
import type { ArmPlan, ArmMetrics } from './arm-types';

export function calcArmMetrics(plan: ArmPlan): ArmMetrics {
  const totalSetsPerWeek: Record<number, number> = {};
  let totalSets = 0, totalRir = 0, cnt = 0, tableSets = 0, tendonSets = 0, sideSets = 0;
  for (const wk of plan.weeks) {
    let wkSets = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      wkSets += ex.sets;
      totalSets += ex.sets;
      totalRir += ex.rir * ex.sets;
      cnt += ex.sets;
      if (ex.isTable) tableSets += ex.sets;
      if (['wrist_flexors','pronators','supinators','wrist_extensors','risers'].includes(ex.muscle)) tendonSets += ex.sets;
      if (ex.muscle === 'side_pressure') sideSets += ex.sets;
    }
    totalSetsPerWeek[wk.week] = wkSets;
  }
  const avgIntensity = cnt > 0 ? (10 - totalRir / cnt) : 7; // RPE avg
  const tableTimePct = totalSets > 0 ? tableSets / totalSets : 0;
  const tendonLoad = tendonSets;
  const sidePressureLoad = sideSets;
  return { totalSetsPerWeek, avgIntensity, tableTimePct, tendonLoad, sidePressureLoad };
}

export function armMetricsSummary(m: ArmMetrics): string[] {
  return [
    `Всего сетов/нед: ${Object.entries(m.totalSetsPerWeek).map(([w,s])=>`Н${w}:${s}`).join(' ')}`,
    `Ср. интенсивность: RPE ${m.avgIntensity.toFixed(1)}`,
    `Table time: ${(m.tableTimePct*100).toFixed(0)}%`,
    `Tendon load: ${m.tendonLoad} сетов`,
    `Side pressure: ${m.sidePressureLoad} сетов`,
  ];
}
