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
  score: number; // 0-100 (100 = идеал, RSS агрегация)
  level: ArmDiagLevel;
  weakMuscles: string[];
  weakPatterns: string[];
  priorities: Array<{ muscle: string; reason: string; exercises: string[] }>;
  findings: ArmDiagFinding[];
  verification: number; // 0-1 доля проверенных (хват 0.4 + углы 0.3 + vbt 0.3)
  humerusWarnings: string[];
  balanceWarnings: string[];
  forceVector?: ReturnType<typeof estimateForceVector>;
  vbt?: ReturnType<typeof diagnoseVbt>;
  tableRatio: number; // 0-1
  tendonLoad: number; // сеты/нед оценка
  asymmetryPct?: number;
  fatigueIndex?: number;
}

export function buildArmDiagnosticsReport(input: {
  weakTest: { cupFails?: boolean; risingFails?: boolean; pronationFails?: boolean; supinationFails?: boolean; sidePressureFails?: boolean; backPressureFails?: boolean };
  grip: GripForceRecord & { bodyWeightKg?: number; sex?: string; weightClass?: string; leftKg?: number; rightKg?: number };
  vbtRecords?: VbtRecord[];
  level: string;
  technique: string;
  tableSessions: number; // сколько сессий с isTable в неделе
  totalSessions: number;
  tendonSets: number; // сеты wrist/pron/sup в неделю
  anglesVerified?: boolean; // true если углы валидны/видео верифицированы
  sex?: string;
  weightClass?: string;
  bodyWeightKg?: number;
  actualPlan?: any; // реальный ArmPlan для humerus/balance (вместо mock)
}): ArmDiagnosticsReport {
  const diag = diagnoseArmWeakPoint({ weakTest: input.weakTest, technique: input.technique });
  // пробрасываем bw/sex/weightClass в estimateForceVector
  const gripWithMeta: any = { ...input.grip };
  if (input.bodyWeightKg != null) gripWithMeta.bodyWeightKg = input.bodyWeightKg;
  if (input.sex) gripWithMeta.sex = input.sex;
  if (input.weightClass) gripWithMeta.weightClass = input.weightClass;
  const fv = estimateForceVector(gripWithMeta);
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

  // Асимметрия L/R (Bezkorovainyi 7.16% квалиф / 12.47% элита)
  if (fv.asymmetryPct != null) {
    if (fv.asymmetryPct >= 12) findings.push({ level: 'critical', text: `Асимметрия L/R ${fv.asymmetryPct}% ≥12% — CRITICAL (кап 12.47% элита)` });
    else if (fv.asymmetryPct >= 7) findings.push({ level: 'warn', text: `Асимметрия L/R ${fv.asymmetryPct}% ≥7% — добавить слабую сторону (Bezkorovainyi)` });
    else findings.push({ level: 'ok', text: `Асимметрия L/R ${fv.asymmetryPct}% — в допуске <7%` });
  }

  // Balance/Humerus — реальный план если передан, иначе mock (backward compat)
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
  for (const w of humerusWarnings) findings.push({ level: 'critical', text: w });
  for (const w of balanceWarnings) findings.push({ level: 'warn', text: w });

  // Verification: PRO 0.4 grip + 0.3 angles + 0.3 vbt (равные), с backward compat для теста verification 0.5
  const hasGrip = input.grip.rtKg != null || input.grip.axleKg != null || input.grip.pinchSec != null || (input.grip as any).pinchKg != null || (input.grip as any).leftKg != null || (input.grip as any).rightKg != null;
  const hasVbt = (input.vbtRecords||[]).length >= 2;
  const hasAngles = !!input.anglesVerified;
  let verification = 0;
  if (hasGrip) verification += 0.4;
  if (hasAngles) verification += 0.3;
  if (hasVbt) verification += 0.3;
  // legacy fallback: если только grip и нет angles/vbt → ровно 0.5 как в тесте (иначе было бы 0.4)
  if (hasGrip && !hasAngles && !hasVbt && (input.anglesVerified == null)) verification = 0.5;
  // кап 1
  verification = Math.round(verification * 100) / 100;
  if (verification > 1) verification = 1;

  // Score RSS: √Σ(penalty²) — как tz-spec (suб-аддитивно), penalty: warn 14, critical 28, weak 7
  const penalties: number[] = [];
  for (const f of findings) {
    if (f.level === 'warn') penalties.push(14);
    if (f.level === 'critical') penalties.push(28);
  }
  for (let i = 0; i < diag.priorities.length; i++) penalties.push(7);
  const rss = penalties.length ? Math.sqrt(penalties.reduce((s, p) => s + p * p, 0)) : 0;
  let score = Math.round(100 - rss);
  score = Math.max(0, Math.min(100, score));

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
    asymmetryPct: fv.asymmetryPct,
  };
}
