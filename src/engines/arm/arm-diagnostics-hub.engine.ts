/**
 * arm-diagnostics-hub.engine.ts — оркестратор диагностики (механизм-ориентированная модель, без общего score).
 * Собирает weak/grip/force/vbt/table/tendon + суставные риски (humerus/tendon/balance/асимметрия) с уровнями.
 * Общий score/verification убраны — только механизм-ориентированные риски по суставам.
 */
import { diagnoseArmWeakPoint } from './arm-weakpoint.engine';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance } from './arm-injury-guard.engine';
import { estimateForceVector, forceAdvice } from './arm-force-capture.engine';
import { diagnoseVbt } from './arm-vbt-capture.engine';
import type { GripForceRecord } from './arm-force-capture.engine';
import type { VbtRecord } from './arm-vbt-capture.engine';

export type ArmDiagLevel = 'ok' | 'warn' | 'critical';

export interface ArmDiagFinding {
  level: ArmDiagLevel;
  muscle?: string;
  text: string;
  exercise?: string;
}

export interface ArmDiagnosticsReport {
  weakMuscles: string[];
  weakPatterns: string[];
  priorities: Array<{ muscle: string; reason: string; exercises: string[] }>;
  findings: ArmDiagFinding[]; // механизм-ориентированные (сустав/сухожилие/баланс/асимметрия)
  humerusWarnings: string[];
  balanceWarnings: string[];
  forceVector?: ReturnType<typeof estimateForceVector>;
  vbt?: ReturnType<typeof diagnoseVbt>;
  tableRatio: number;
  tendonLoad: number;
  asymmetryPct?: number;
  info: string[]; // доп. инфо без уровня
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
  actualPlan?: any;
}): ArmDiagnosticsReport {
  const diag = diagnoseArmWeakPoint({ weakTest: input.weakTest, technique: input.technique });
  const gripWithMeta: any = { ...input.grip };
  if (input.bodyWeightKg != null) gripWithMeta.bodyWeightKg = input.bodyWeightKg;
  if (input.sex) gripWithMeta.sex = input.sex;
  if (input.weightClass) gripWithMeta.weightClass = input.weightClass;
  const fv = estimateForceVector(gripWithMeta);
  const vbt = diagnoseVbt(input.vbtRecords || []);

  const findings: ArmDiagFinding[] = [];
  const info: string[] = [];

  // Weak priorities → findings (механизм)
  for (const p of diag.priorities) {
    findings.push({ level: 'warn', muscle: p.muscle, text: `${p.reason} → ${p.exercises[0]}`, exercise: p.exercises[0] });
  }
  if (diag.priorities.length === 0) findings.push({ level: 'ok', text: 'Слабые зоны не выявлены — баланс' });

  // Force — нейтрально, но оставляем как факт (не риск)
  const fAdv = forceAdvice(fv);
  for (const t of fAdv) {
    const lvl: ArmDiagLevel = t.startsWith('✓') ? 'ok' : 'warn';
    findings.push({ level: lvl, text: t });
  }

  // VBT — сустав/сухожилие риск (механизм)
  const vbtEx = (input.vbtRecords && input.vbtRecords[0]?.exerciseId) || 'wrist_curl_belt';
  if (vbt.zone === 'stop') findings.push({ level: 'critical', text: `VBT стоп: потеря ${vbt.velocityLossPct}%`, exercise: vbtEx });
  else if (vbt.zone === 'warn') findings.push({ level: 'warn', text: `VBT warn: потеря ${vbt.velocityLossPct}%`, exercise: vbtEx });
  else if (vbt.velocityLossPct != null) findings.push({ level: 'ok', text: `VBT ок: ${vbt.velocityLossPct}%`, exercise: vbtEx });

  // Side humerus — сустав
  const sideLm = getArmLandmarks(input.level, 'side_pressure');
  if (sideLm.mrv <= 9) findings.push({ level: 'ok', text: `Side MRV ${sideLm.mrv} — низкий (humerus), кап 3/нед первые 4 нед`, exercise: 'side_press_table' });

  // Table — факт
  const tableRatio = input.totalSessions ? input.tableSessions / input.totalSessions : 0;
  if (tableRatio < 0.3) findings.push({ level: 'warn', text: `Table time ${(tableRatio*100).toFixed(0)}% <30% — для армрестлинга мало стола (Кузнецов VIII ≥50%)`, exercise: 'table_pushdown_iso' });
  else if (tableRatio >= 0.5) findings.push({ level: 'ok', text: `Table time ${(tableRatio*100).toFixed(0)}% ≥50% — норма`, exercise: 'table_pushdown_iso' });

  // Tendon — сустав/сухожилие риск
  if (input.tendonSets > 22) findings.push({ level: 'critical', text: `Tendon ${input.tendonSets} >22 — CRITICAL (кап 22)`, exercise: 'wrist_ext_bb' });
  else if (input.tendonSets > 18) findings.push({ level: 'warn', text: `Tendon сетов ${input.tendonSets} >18 — риск`, exercise: 'pronation_pulses' });
  else if (input.level === 'beginner' && input.tendonSets > 12) findings.push({ level: 'warn', text: `Tendon ${input.tendonSets} >12 для beginner — много`, exercise: 'wrist_ext_bb' });
  else findings.push({ level: 'ok', text: `Tendon ${input.tendonSets} — в допуске`, exercise: 'wrist_ext_bb' });

  // Асимметрия — сустав/механизм
  if (fv.asymmetryPct != null) {
    if (fv.asymmetryPct >= 12) findings.push({ level: 'critical', text: `Асимметрия L/R ${fv.asymmetryPct}% ≥12% — CRITICAL (кап 12.47% элита)`, exercise: 'hammer_curl_thick' });
    else if (fv.asymmetryPct >= 7) findings.push({ level: 'warn', text: `Асимметрия L/R ${fv.asymmetryPct}% ≥7% — добавить слабую сторону (Bezkorovainyi)`, exercise: 'hammer_curl_thick' });
    else findings.push({ level: 'ok', text: `Асимметрия L/R ${fv.asymmetryPct}% — в допуске <7%`, exercise: 'hammer_curl_thick' });
  }

  // Humerus / Balance — суставные риски (механизм-ориентированы)
  let humerusWarnings: string[] = [];
  let balanceWarnings: string[] = [];
  if (input.actualPlan && input.actualPlan.weeks) {
    humerusWarnings = checkHumerusGuard(input.actualPlan);
    balanceWarnings = checkWristBalance(input.actualPlan);
  } else {
    const mockPlan: any = {
      weeks: [
        { week: 1, sessions: [{ exercises: [{ muscle: 'pronators', sets: input.weakTest.pronationFails ? 6 : 4 }, { muscle: 'supinators', sets: input.weakTest.supinationFails ? 2 : 4 }] }] },
      ],
    };
    humerusWarnings = checkHumerusGuard({ weeks: input.weakTest.sidePressureFails ? [{ week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 8 }] }] } as any] : [] });
    balanceWarnings = checkWristBalance(mockPlan);
  }
  for (const w of humerusWarnings) findings.push({ level: 'critical', text: w, exercise: 'side_press_table' });
  for (const w of balanceWarnings) findings.push({ level: 'warn', text: w, exercise: 'pronation_cable' });

  info.push('Механизм-ориентированная модель: сустав/сухожилие/баланс — с уровнями, без общего score');

  return {
    weakMuscles: diag.weakMuscles,
    weakPatterns: diag.weakPatterns,
    priorities: diag.priorities,
    findings,
    humerusWarnings,
    balanceWarnings,
    forceVector: fv,
    vbt,
    tableRatio,
    tendonLoad: input.tendonSets,
    asymmetryPct: fv.asymmetryPct,
    info,
  };
}
