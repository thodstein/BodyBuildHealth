/**
 * arm-bridge-payload.engine.ts — сборка payload моста в Арм-конструктор (R1).
 * Вынесено из ArmDiagnosticsHub.applyToConstructor ради тестируемости.
 * Аддитивно к базовым полям: причины, топ-коррекции, спец-блок, мобильность,
 * per-muscle ACWR, bilateral-план, попытки. Конструктор неизвестные поля игнорит.
 */

export interface ArmBridgeCause {
  cause: string;
  confidence: number;
  fix: string;
}

export interface ArmBridgeTop {
  id: string;
  score: number;
}

export interface ArmBridgeSpec {
  weeks: Array<{ week: number; targetSets: Record<string, number> }>;
  dayMap: Record<string, string>;
}

export interface ArmBridgeInput {
  groups: string[];
  technique: string;
  weakPoints: string[];
  biomechCards: unknown[];
  corrections: unknown[];
  scoring: unknown;
  diag: unknown;
  angles: unknown;
  force: unknown;
  vbt: unknown;
  dynamic: unknown;
  bench: unknown;
  tendon: number;
  findings: unknown[];
  humerus: string[];
  balance: string[];
  asymmetry: number | null | undefined;
  info: string[];
  weakCauses: Record<string, ArmBridgeCause>;
  topByPoint: Record<string, ArmBridgeTop[]>;
  spec: ArmBridgeSpec | null;
  mobilityFails: string[];
  acwrDanger: string[];
  bilateral: { weakArm: string | null; weakSets: number; strongSets: number } | null;
  attempts: Array<{ weightKg: number; success: boolean; wrPct: number }>;
}

export function buildArmBridgeData(i: ArmBridgeInput): Record<string, unknown> {
  const preferredExerciseIds: string[] = [];
  const seen = new Set<string>();
  for (const wp of i.weakPoints) {
    for (const t of i.topByPoint[wp] || []) {
      const id = String(t.id).toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        preferredExerciseIds.push(t.id);
      }
    }
  }
  const specTargetSets: Record<string, Record<number, number>> = {};
  if (i.spec) {
    for (const w of i.spec.weeks || []) {
      for (const [wp, sets] of Object.entries(w.targetSets || {})) {
        if (!specTargetSets[wp]) specTargetSets[wp] = {};
        specTargetSets[wp][w.week] = sets;
      }
    }
  }
  return {
    groups: i.groups,
    armTechnique: i.technique,
    armWeakPoints: i.weakPoints,
    armBiomechCards: i.biomechCards,
    armCorrections: i.corrections,
    armScoring: i.scoring,
    armDiag: i.diag,
    armAngles: i.angles,
    armForce: i.force,
    armVbt: i.vbt,
    armDynamic: i.dynamic,
    armBench: i.bench,
    armTendon: i.tendon,
    armFindings: i.findings,
    armHumerus: i.humerus,
    armBalance: i.balance,
    armAsymmetry: i.asymmetry,
    armInfo: i.info,
    // R1: обогащение
    armWeakCauses: i.weakCauses,
    preferredExerciseIds,
    armSpecTargetSets: specTargetSets,
    armSpecDayMap: i.spec?.dayMap || {},
    armMobilityFails: i.mobilityFails,
    armAcwrDanger: i.acwrDanger,
    armBilateral: i.bilateral,
    armAttempts: i.attempts,
  };
}
