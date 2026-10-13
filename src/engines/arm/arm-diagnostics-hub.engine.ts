/**
 * arm-diagnostics-hub.engine.ts — оркестратор диагностики (механизм-ориентированная модель + detailed 12 точек).
 * Собирает weak/grip/force/vbt/table/tendon + суставные риски + 12 мёртвых точек (ARM_BIOMECH) + коррекции.
 * Общий score опционален (arm-scoring PRO оверлей), основной путь — механизм-уровни.
 */
import { diagnoseArmWeakDetailed } from './arm-weakpoint.engine';
import { getArmLandmarks, tendonWeeklyLimit } from './arm-volume-landmarks.engine';
import { checkHumerusGuard, checkWristBalance } from './arm-injury-guard.engine';
import { estimateForceVector, forceAdvice } from './arm-force-capture.engine';
import { diagnoseVbt } from './arm-vbt-capture.engine';
import type { GripForceRecord } from './arm-force-capture.engine';
import type { VbtRecord } from './arm-vbt-capture.engine';
import { ARM_BIOMECH, type ArmWeakPoint, armAngleValueForWeakPoint } from './arm-biomechanics.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';
import { scoreArm } from './arm-scoring.engine';
import { erIrVerdict, type ErIrInput } from './arm-shoulder-erir.engine';

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
  /** Аудит 2026-10: null — план не подключён (недельная нагрузка сухожилий не оценена). */
  tendonLoad: number | null;
  asymmetryPct?: number;
  info: string[]; // доп. инфо без уровня
  // PRO detailed (12 мёртвых точек)
  weakPoints?: ArmWeakPoint[];
  biomechCards?: Array<{
    weakPoint: ArmWeakPoint;
    label: string;
    angleRangeDeg: [number, number];
    keyJoint: string;
    weakMuscles: string[];
    reason: string;
    corrections: string[];
    intensityPct: number;
    loadCues: string;
    technique: string[];
  }>;
  corrections?: Array<{ weakPoint: ArmWeakPoint; exercises: string[]; intensityPct: number; dayTags: string[] }>;
  scoring?: ReturnType<typeof scoreArm>;
}

export function buildArmDiagnosticsReport(input: {
  weakTest: { cupFails?: boolean; risingFails?: boolean; pronationFails?: boolean; supinationFails?: boolean; sidePressureFails?: boolean; backPressureFails?: boolean };
  grip: GripForceRecord & { bodyWeightKg?: number; sex?: string; weightClass?: string; leftKg?: number; rightKg?: number };
  vbtRecords?: VbtRecord[];
  level: string;
  technique: string;
  tableSessions: number | null;
  totalSessions: number | null;
  tendonSets: number | null;
  sex?: string;
  weightClass?: string;
  bodyWeightKg?: number;
  actualPlan?: any;
  weakPoints?: ArmWeakPoint[];
  angles?: { elbowDeg?: number; wristDeg?: number; forearmDeg?: number };
  hasVideo?: boolean;
  hasVbt?: boolean;
  hasGripHistory?: boolean;
  benchLevel?: string; // уровень бенчмарков (beginner..elite) → grip-ветка scoring
  /** 26.10.2026: баланс ротаторов плеча (Pascoa 2026 — прямо показывает перекос в
   *  внутреннюю ротацию у армрестлеров). Без замеров finding не пишется. */
  erIr?: ErIrInput;
}): ArmDiagnosticsReport {
  const detailed = diagnoseArmWeakDetailed({ weakTest: input.weakTest, weakPoints: input.weakPoints, technique: input.technique });
  const diag = detailed; // detailed расширяет base (weakMuscles/priorities/rationale сохранены)
  const gripWithMeta: any = { ...input.grip };
  if (input.bodyWeightKg != null) gripWithMeta.bodyWeightKg = input.bodyWeightKg;
  if (input.sex) gripWithMeta.sex = input.sex;
  if (input.weightClass) gripWithMeta.weightClass = input.weightClass;
  const fv = estimateForceVector(gripWithMeta);
  // E9 P1: пороги VBT по первой мёртвой точке (иначе legacy exerciseId-маппинг)
  const vbtWp = (detailed.weakPoints || [])[0];
  const vbtRecs = (input.vbtRecords || []).map((r: any) => (r && !r.weakPoint && vbtWp ? { ...r, weakPoint: vbtWp } : r));
  const vbt = diagnoseVbt(vbtRecs);

  const findings: ArmDiagFinding[] = [];
  const info: string[] = [];

  // Weak priorities → findings (механизм)
  for (const p of diag.priorities) {
    findings.push({ level: 'warn', muscle: p.muscle, text: `${p.reason} → ${p.exercises[0]}`, exercise: p.exercises[0] });
  }
  if (diag.priorities.length === 0) findings.push({ level: 'ok', text: 'Слабые зоны не выявлены — баланс' });

  // Force — нейтрально, но оставляем как факт (не риск)
  const fAdv = forceAdvice(fv, gripWithMeta);
  for (const t of fAdv) {
    // Аудит 2026-10: forceAdvice помечает факты ✓, технические подсказки →
    const lvl: ArmDiagLevel = t.startsWith('✓') || t.startsWith('→') ? 'ok' : 'warn';
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

  // Table — факт (аудит 2026-10: без плана хаб выдумывал 2/4 сессий — теперь честный null)
  const tableKnown = input.tableSessions != null && input.totalSessions != null && input.totalSessions > 0;
  const tableRatio = tableKnown ? (input.tableSessions as number) / (input.totalSessions as number) : 0;
  if (!tableKnown) {
    info.push('Стол: план не подключён — доля столовых сессий не оценена (подключи план из Арм-конструктора)');
  } else if (tableRatio < 0.3) findings.push({ level: 'warn', text: `Table sessions ${(tableRatio*100).toFixed(0)}% <30% — для армрестлинга мало стола (Кузнецов VIII ≥50%)`, exercise: 'table_pushdown_iso' });
  else if (tableRatio >= 0.5) findings.push({ level: 'ok', text: `Table sessions ${(tableRatio*100).toFixed(0)}% ≥50% — норма`, exercise: 'table_pushdown_iso' });
  else findings.push({ level: 'ok', text: `Table sessions ${(tableRatio*100).toFixed(0)}% — норма`, exercise: 'table_pushdown_iso' });

  // Аудит 2026-10 было→стало: порог critical >22 был недостижим — хаб клэмпит ввод в 22, т.е. из UI ветка не срабатывала.
  // Новый порог 18 соответствует недельному капу 22/18/12 (checkTendonGuard).
  // Плюс: без подключённого плана недельная нагрузка сухожилий не оценивается (было 8..22 из головы).
  if (input.tendonSets == null) {
    info.push('Сухожилия: план не подключён — недельная нагрузка не оценена (подключи план из Арм-конструктора)');
  } else if (input.tendonSets >= 18) findings.push({ level: 'critical', text: `Tendon ${input.tendonSets} ≥ 18 — CRITICAL (кап 18 для Л/П, выше)`, exercise: 'wrist_ext_bb' });
  else if (input.level === 'beginner' && input.tendonSets > 12) findings.push({ level: 'warn', text: `Tendon ${input.tendonSets} >12 для beginner — много`, exercise: 'wrist_ext_bb' });
  else findings.push({ level: 'ok', text: `Tendon ${input.tendonSets} — в допуске`, exercise: 'wrist_ext_bb' });

  // Асимметрия — сустав/механизм
  if (fv.asymmetryPct != null) {
    if (fv.asymmetryPct >= 12) findings.push({ level: 'critical', text: `Асимметрия L/R ${fv.asymmetryPct}% ≥12% — CRITICAL (кап 12.47% элита)`, exercise: 'hammer_curl_thick' });
    else if (fv.asymmetryPct >= 7) findings.push({ level: 'warn', text: `Асимметрия L/R ${fv.asymmetryPct}% ≥7% — добавить слабую сторону (Bezkorovainyi)`, exercise: 'hammer_curl_thick' });
    else findings.push({ level: 'ok', text: `Асимметрия L/R ${fv.asymmetryPct}% — в допуске <7%`, exercise: 'hammer_curl_thick' });
  }

  // ER:IR ротаторы плеча (26.10.2026, Pascoa 2026): перекос во внутреннюю ротацию —
  // часть механики перелома плеча; показываем только по факту замера.
  const erir = erIrVerdict(input.erIr || {});
  if (erir.warn) {
    findings.push({
      level: erir.zone === 'risk' ? 'critical' : 'warn',
      text: erir.line,
      exercise: 'external_rotation_band',
    });
    if (erir.fix) info.push(`ER:IR — ${erir.fix}`);
  } else if (erir.zone === 'ok') {
    findings.push({ level: 'ok', text: erir.line, exercise: 'external_rotation_band' });
  }

  // Humerus / Balance — суставные риски (механизм-ориентированы)
  let humerusWarnings: string[] = [];
  let balanceWarnings: string[] = [];
  if (input.actualPlan && input.actualPlan.weeks) {
    humerusWarnings = checkHumerusGuard(input.actualPlan);
    balanceWarnings = checkWristBalance(input.actualPlan);
  } else {
    // PRO-3 P2: без плана — честное «нет данных» вместо mock-8-сетов.
    // Side-оценка объёма недоступна; side-точка даёт предупреждение-подсказку (не псевдо-гейт).
    const wpsEarly: ArmWeakPoint[] = detailed.weakPoints || [];
    const hasSideEarly = !!input.weakTest.sidePressureFails || wpsEarly.some(wp => wp === 'side_mid' || wp === 'side_pin');
    const hasAnyPoint = wpsEarly.length > 0 || !!input.weakTest.sidePressureFails || !!input.weakTest.pronationFails || !!input.weakTest.supinationFails;
    if (hasSideEarly) {
      humerusWarnings = ['Side-точка выбрана (side_pressure), но план не подключён — side-объём не оценён, humerus-контроль недоступен (подключи план из Арм-конструктора)'];
    }
    balanceWarnings = [];
    if (hasAnyPoint) {
      info.push('План не подключён — оценка side-объёма и humerus/баланса недоступна (подключи план из Арм-конструктора)');
    }
  }
  for (const w of humerusWarnings) findings.push({ level: 'critical', text: w, exercise: 'side_press_table' });
  for (const w of balanceWarnings) findings.push({ level: 'warn', text: w, exercise: 'pronation_cable' });

  info.push('Механизм-ориентированная модель: сустав/сухожилие/баланс — с уровнями, без общего score');
  // PRO detailed — 12 мёртвых точек + коррекции + scoring оверлей (выкл. по умолчанию, только для gauge)
  const weakPoints = detailed.weakPoints || [];
  const biomechCards = (detailed as any).biomechCards || [];
  const corrections = weakPoints.map((wp: ArmWeakPoint) => {
    const c = ARM_CORRECTIONS[wp];
    return c ? { weakPoint: wp, exercises: c.exercises, intensityPct: c.intensityPct, dayTags: c.dayTags } : null;
  }).filter(Boolean) as Array<{ weakPoint: ArmWeakPoint; exercises: string[]; intensityPct: number; dayTags: string[] }>;
  // detailed findings для каждой точки
  for (const card of biomechCards) {
    findings.push({ level: 'warn', muscle: card.weakMuscles[0], text: `${card.label}: ${card.angleRangeDeg[0]}-${card.angleRangeDeg[1]}° ${card.keyJoint} → ${card.corrections[0]} @${Math.round(card.intensityPct*100)}%`, exercise: card.corrections[0] });
  }
  // scoring оверлей (вычисляем всегда, показываем только если есть видео/VBT/история)
  let scoring: ReturnType<typeof scoreArm> | undefined;
  try {
    const hasVideo = !!input.hasVideo;
    const hasVbt = !!input.hasVbt || (input.vbtRecords && input.vbtRecords.length>0);
    const hasGripHistory = !!input.hasGripHistory;
    if (hasVideo || hasVbt || hasGripHistory || corrections.length>0) {
      // Аудит 2026-10 было→стало: sideSetsWeek1 = 0 без плана давал «Side 0 — в допуске»
      // (непокрытая проверка выглядела пройденной). Теперь null = «план не подключён».
      const w0 = input.actualPlan?.weeks?.[0];
      const sideSets = w0
        ? (w0.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).filter((e: any)=> e.muscle==='side_pressure').reduce((aa:number,e:any)=>aa+(Number(e.sets)||0),0),0)
        : null;
      scoring = scoreArm({
        weakCount: weakPoints.length,
        asymmetryPct: fv.asymmetryPct ?? null,
        sideSetsWeek1: sideSets,
        tendonSets: input.tendonSets,
        tendonLimit: tendonWeeklyLimit(input.level),
        gripLevel: input.benchLevel,
        hasVideo, hasVbt, hasGripHistory,
        level: input.level,
      });
    }
  } catch {}
  // angle validation для detailed.
  // Аудит 2026-10 было→стало: здесь была ВТОРАЯ копия строковой эвристики сустава, и
  // `rising_top` (radial deviation) не матчил ни одну ветку — точка молча пропускалась.
  // Теперь единый канон `armAngleValueForWeakPoint` (как в `autoValidateArmAngles`).
  if (input.angles) {
    const allBio = Object.values(ARM_BIOMECH);
    for (const card of biomechCards) {
      const bio = allBio.find((v) => v.weakPoint === card.weakPoint);
      if (!bio) continue;
      const av = armAngleValueForWeakPoint(card.weakPoint, {
        wrist: input.angles.wristDeg, elbow: input.angles.elbowDeg, forearm: input.angles.forearmDeg,
      });
      if (av == null) continue;
      if (av < bio.angleRangeDeg[0] || av > bio.angleRangeDeg[1]) {
        findings.push({ level: 'warn', text: `${bio.label}: твой ${av}° вне ${bio.angleRangeDeg[0]}-${bio.angleRangeDeg[1]}° → ${bio.loadCues}`, exercise: bio.corrections[0] });
      }
    }
  }

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
    weakPoints,
    biomechCards,
    corrections,
    scoring,
  };
}

export function buildArmDiagnosticsDetailedReport(input: Parameters<typeof buildArmDiagnosticsReport>[0]): ReturnType<typeof buildArmDiagnosticsReport> {
  return buildArmDiagnosticsReport(input);
}
