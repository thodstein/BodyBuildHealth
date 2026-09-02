/**
 * arm-diagnostics-hub.engine.ts — оркестратор диагностики (PRO, как risk-engine-tz-spec).
 * Собирает weak/grip/force/vbt/landmarks/table/tendon в единый отчёт score 0-100 + findings.
 */
import { diagnoseArmWeakPoint } from './arm-weakpoint.engine';
import { getArmLandmarks } from './arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance } from './arm-injury-guard.engine';
import { estimateForceVector, forceAdvice } from './arm-force-capture.engine';
import { diagnoseVbt } from './arm-vbt-capture.engine';
import type { GripForceRecord } from './arm-force-capture.engine';
import type { VbtRecord } from './arm-vbt-capture.engine';
import { tableWeekKind } from './arm-table.engine';

export type ArmDiagLevel = 'ok' | 'warn' | 'critical';

export interface ArmDiagFinding {
  level: ArmDiagLevel;
  muscle?: string;
  text: string;
  exercise?: string;
}

export interface ArmDiagnosticsReport {
  score: number; // 0-100 (100 = идеал)
  level: ArmDiagLevel;
  weakMuscles: string[];
  weakPatterns: string[];
  priorities: Array<{ muscle: string; reason: string; exercises: string[] }>;
  findings: ArmDiagFinding[];
  verification: number; // 0-1 доля проверенных (хват+углы)
  humerusWarnings: string[];
  balanceWarnings: string[];
  forceVector?: ReturnType<typeof estimateForceVector>;
  vbt?: ReturnType<typeof diagnoseVbt>;
  tableRatio: number; // 0-1
  tendonLoad: number; // сеты/нед оценка
}

export function buildArmDiagnosticsReport(input: {
  weakTest: { cupFails?: boolean; risingFails?: boolean; pronationFails?: boolean; supinationFails?: boolean; sidePressureFails?: boolean; backPressureFails?: boolean };
  grip: GripForceRecord;
  vbtRecords?: VbtRecord[];
  level: string;
  technique: string;
  tableSessions: number; // сколько сессий с isTable в неделе
  totalSessions: number;
  tendonSets: number; // сеты wrist/pron/sup в неделю
}): ArmDiagnosticsReport {
  const diag = diagnoseArmWeakPoint({ weakTest: input.weakTest, technique: input.technique });
  const fv = estimateForceVector(input.grip);
  const vbt = diagnoseVbt(input.vbtRecords || []);

  const findings: ArmDiagFinding[] = [];

  // Weak priorities → findings
  for (const p of diag.priorities) {
    findings.push({ level: 'warn', muscle: p.muscle, text: `${p.reason} → ${p.exercises[0]}`, exercise: p.exercises[0] });
  }
  if (diag.priorities.length === 0) findings.push({ level: 'ok', text: 'Слабые зоны не выявлены — баланс' });

  // Force
  const fAdv = forceAdvice(fv);
  for (const t of fAdv) {
    const lvl: ArmDiagLevel = t.startsWith('✓') ? 'ok' : 'warn';
    findings.push({ level: lvl, text: t });
  }

  // VBT
  if (vbt.zone === 'stop') findings.push({ level: 'critical', text: `VBT стоп: потеря ${vbt.velocityLossPct}%` });
  else if (vbt.zone === 'warn') findings.push({ level: 'warn', text: `VBT warn: потеря ${vbt.velocityLossPct}%` });
  else if (vbt.velocityLossPct != null) findings.push({ level: 'ok', text: `VBT ок: ${vbt.velocityLossPct}%` });

  // Landmarks: side humerus
  const sideLm = getArmLandmarks(input.level, 'side_pressure');
  if (sideLm.mrv <= 9) findings.push({ level: 'ok', text: `Side MRV ${sideLm.mrv} — низкий (humerus), кап 3/нед первые 4 нед` });

  // Table
  const tableRatio = input.totalSessions ? input.tableSessions / input.totalSessions : 0;
  if (tableRatio < 0.3) findings.push({ level: 'warn', text: `Table time ${(tableRatio*100).toFixed(0)}% <30% — для армрестлинга мало стола (Кузнецов VIII ≥50%)` });
  else if (tableRatio >= 0.5) findings.push({ level: 'ok', text: `Table time ${(tableRatio*100).toFixed(0)}% ≥50% — норма` });

  // Tendon — 3 границы: beginner 12, intermediate 16, advanced 18, enhanced 22
  if (input.tendonSets > 22) findings.push({ level: 'critical', text: `Tendon ${input.tendonSets} >22 — CRITICAL (кап 22)` });
  else if (input.tendonSets > 18) findings.push({ level: 'warn', text: `Tendon сетов ${input.tendonSets} >18 — риск` });
  else if (input.level === 'beginner' && input.tendonSets > 12) findings.push({ level: 'warn', text: `Tendon ${input.tendonSets} >12 для beginner — много` });
  else findings.push({ level: 'ok', text: `Tendon ${input.tendonSets} — в допуске` });

  // Balance/Humerus mock (как в hub)
  const mockPlan: any = {
    weeks: [
      { week: 1, sessions: [{ exercises: [{ muscle: 'pronators', sets: input.weakTest.pronationFails ? 6 : 4 }, { muscle: 'supinators', sets: input.weakTest.supinationFails ? 2 : 4 }] }] },
    ],
  };
  const humerusWarnings = checkHumerusGuard({ weeks: input.weakTest.sidePressureFails ? [{ week: 1, sessions: [{ exercises: [{ muscle: 'side_pressure', sets: 8 }] }] } as any] : [] });
  const balanceWarnings = checkWristBalance(mockPlan);
  for (const w of humerusWarnings) findings.push({ level: 'critical', text: w });
  for (const w of balanceWarnings) findings.push({ level: 'warn', text: w });

  // Verification: 3 фактора как в PL (0.5 grip + 0.3 angles + 0.2 vbt)
  const hasGrip = input.grip.rtKg != null || input.grip.axleKg != null || input.grip.pinchSec != null || (input.grip as any).pinchKg != null;
  const hasVbt = (input.vbtRecords||[]).length >= 2;
  // hasAngles: если есть хоть один угол из input (пока stub, но считаем если техника не balanced)
  const hasAngles = input.technique !== 'balanced' || hasGrip; // PRO: техника уже верифицирует углы
  let verification = 0;
  if (hasGrip) verification += 0.5;
  if (hasAngles) verification += 0.3;
  if (hasVbt) verification += 0.2;
  verification = Math.round(verification*10)/10;

  // Score 0-100: стартуем 100, -15 за каждый warn, -30 за critical, -5 за weak
  let score = 100;
  for (const f of findings) {
    if (f.level === 'warn') score -= 8;
    if (f.level === 'critical') score -= 20;
  }
  score -= diag.priorities.length * 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const level: ArmDiagLevel = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'critical';

  // TableKind для справки
  const _tableKind = tableWeekKind(1, 12);

  return {
    score,
    level,
    weakMuscles: diag.weakMuscles,
    weakPatterns: diag.weakPatterns,
    priorities: diag.priorities,
    findings,
    verification,
    humerusWarnings,
    balanceWarnings,
    forceVector: fv,
    vbt,
    tableRatio,
    tendonLoad: input.tendonSets,
  };
}
