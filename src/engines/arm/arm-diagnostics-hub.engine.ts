/**
 * arm-diagnostics-hub.engine.ts — оркестратор диагностики (чистая диагностика, без рисков).
 * Собирает weak/force/vbt/table/tendon + динамику в единый отчёт без score/верификации.
 * Риски убраны по требованию — только факты и рекомендации по технике.
 */
import { diagnoseArmWeakPoint } from './arm-weakpoint.engine';
import { estimateForceVector, forceAdvice } from './arm-force-capture.engine';
import { diagnoseVbt } from './arm-vbt-capture.engine';
import type { GripForceRecord } from './arm-force-capture.engine';
import type { VbtRecord } from './arm-vbt-capture.engine';

export interface ArmDiagDetail {
  muscle?: string;
  text: string;
  exercise?: string;
}

export interface ArmDiagnosticsReport {
  weakMuscles: string[];
  weakPatterns: string[];
  priorities: Array<{ muscle: string; reason: string; exercises: string[] }>;
  details: ArmDiagDetail[]; // факты без уровней риска
  forceVector?: ReturnType<typeof estimateForceVector>;
  vbt?: ReturnType<typeof diagnoseVbt>;
  tableRatio: number; // 0-1 факт
  tendonLoad: number; // сеты/нед факт
  asymmetryPct?: number;
  info: string[]; // доп. инфо (техника, баланс) без уровня
}

export function buildArmDiagnosticsReport(input: {
  weakTest: { cupFails?: boolean; risingFails?: boolean; pronationFails?: boolean; supinationFails?: boolean; sidePressureFails?: boolean; backPressureFails?: boolean };
  grip: GripForceRecord & { bodyWeightKg?: number; sex?: string; weightClass?: string; leftKg?: number; rightKg?: number };
  vbtRecords?: VbtRecord[];
  level: string;
  technique: string;
  tableSessions: number;
  totalSessions: number;
  tendonSets: number;
  sex?: string;
  weightClass?: string;
  bodyWeightKg?: number;
}): ArmDiagnosticsReport {
  const diag = diagnoseArmWeakPoint({ weakTest: input.weakTest, technique: input.technique });
  const gripWithMeta: any = { ...input.grip };
  if (input.bodyWeightKg != null) gripWithMeta.bodyWeightKg = input.bodyWeightKg;
  if (input.sex) gripWithMeta.sex = input.sex;
  if (input.weightClass) gripWithMeta.weightClass = input.weightClass;
  const fv = estimateForceVector(gripWithMeta);
  const vbt = diagnoseVbt(input.vbtRecords || []);

  const details: ArmDiagDetail[] = [];
  const info: string[] = [];

  // Weak priorities → details (факты)
  for (const p of diag.priorities) {
    details.push({ muscle: p.muscle, text: `${p.reason} → ${p.exercises[0]}`, exercise: p.exercises[0] });
  }
  if (diag.priorities.length === 0) details.push({ text: 'Слабые зоны не выявлены — баланс' });

  // Force — нейтральные советы по технике, без градации риска
  const fAdv = forceAdvice(fv);
  for (const t of fAdv) {
    details.push({ text: t });
  }

  // VBT — факт
  if (vbt.velocityLossPct != null) {
    details.push({ text: `VBT: потеря ${vbt.velocityLossPct}% — ${vbt.advice}` });
  } else {
    details.push({ text: vbt.advice });
  }

  // Table — факт, без warn/critical
  const tableRatio = input.totalSessions ? input.tableSessions / input.totalSessions : 0;
  details.push({ text: `Table time ${(tableRatio * 100).toFixed(0)}% — стол` });
  if (tableRatio < 0.5) info.push('Кузнецов VIII: ≥50% объёма — стол');

  // Tendon — факт
  details.push({ text: `Tendon ${input.tendonSets} сетов/нед` });
  info.push(`Лимит tendon: beginner 12 / intermediate 16 / advanced 18 / enhanced 22`);

  // Асимметрия — факт
  if (fv.asymmetryPct != null) {
    details.push({ text: `Асимметрия L/R ${fv.asymmetryPct}%` });
    info.push('Bezkorovainyi: квалиф 7.16% / элита 12.47% — ориентир для анализа');
  }

  // Баланс — инфо без уровня
  if (input.weakTest.pronationFails && !input.weakTest.supinationFails) info.push('Pronation без supination — добавить антагонист');
  if (!input.weakTest.pronationFails && input.weakTest.supinationFails) info.push('Supination без pronation — добавить антагонист');
  if (input.weakTest.sidePressureFails) info.push('Side pressure — контроль техники, RIR≥2');

  return {
    weakMuscles: diag.weakMuscles,
    weakPatterns: diag.weakPatterns,
    priorities: diag.priorities,
    details,
    forceVector: fv,
    vbt,
    tableRatio,
    tendonLoad: input.tendonSets,
    asymmetryPct: fv.asymmetryPct,
    info,
  };
}
