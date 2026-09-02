/**
 * strength-sport-sm-scoring.engine.ts — RSS-СКОРИНГ СТРОНГМЕНА (как TA scoreTA)
 *
 * Шкала 0-100, RSS √Σpen², floors для критических.
 * Strongman-specific: weak 12, asymmetry 14/28, carrySway 10/18, vbt 10/20,
 * mobility 8, axial 15, conditioning 10, grip 12.
 * Verification: видео 0.30 + VBT 0.30 + OHS 0.20 + grip 0.20
 */

export type SMScoreLevel = 'ok' | 'warn' | 'critical';
export interface SMScoringInput {
  weakCount: number;
  asymmetryPct?: number | null;
  carrySwayCm?: number | null; // lateral sway carry (из видео)
  swayDeviation?: string | null; // forward/loop etc
  vbtLossPct?: number | null;
  mobilityFails?: number | null; // 0-6 OHS
  gripFails?: number | null; // 0-3 tri-modal
  axialOverload?: boolean | null; // axialSets≥12 + carry>300
  conditioningFail?: boolean | null;
}
export interface SMScoringResult {
  score: number;
  level: SMScoreLevel;
  penalties: number[];
  verification: number;
  findings: Array<{ level: SMScoreLevel; text: string }>;
  floors: string[];
}

const PENALTY_SM = {
  weak: 12,
  asymmetryWarn: 14,
  asymmetryCrit: 28,
  swayWarn: 10,
  swayCrit: 18,
  vbtWarn: 10, // carry 15% threshold, stone 15%
  vbtCrit: 20,
  mobility: 8,
  grip: 12,
  axial: 15,
  conditioning: 10,
};

export function scoreSM(
  input: SMScoringInput & { hasVideo?: boolean; hasVbt?: boolean; hasMobility?: boolean; hasGrip?: boolean },
): SMScoringResult {
  const penalties: number[] = [];
  const findings: Array<{ level: SMScoreLevel; text: string }> = [];
  const floors: string[] = [];

  for (let i = 0; i < input.weakCount; i++) penalties.push(PENALTY_SM.weak);
  if (input.weakCount > 0) findings.push({ level: input.weakCount >= 3 ? 'critical' : 'warn', text: `${input.weakCount} слабые фазы` });
  else findings.push({ level: 'ok', text: 'Слабые фазы — баланс' });

  if (input.asymmetryPct != null) {
    if (input.asymmetryPct >= 12) {
      penalties.push(PENALTY_SM.asymmetryCrit);
      findings.push({ level: 'critical', text: `Асимметрия ${input.asymmetryPct}% ≥12%` });
      floors.push('Асимметрия ≥12% — критично (бицепс риск)');
    } else if (input.asymmetryPct >= 7) {
      penalties.push(PENALTY_SM.asymmetryWarn);
      findings.push({ level: 'warn', text: `Асимметрия ${input.asymmetryPct}% ≥7%` });
    } else findings.push({ level: 'ok', text: `Асимметрия ${input.asymmetryPct}% — норма` });
  }

  if (input.carrySwayCm != null) {
    if (input.carrySwayCm > 5) {
      penalties.push(PENALTY_SM.swayCrit);
      findings.push({ level: 'critical', text: `Carry sway ${input.carrySwayCm}см >5см` });
      floors.push('Sway >5см — техника');
    } else if (input.carrySwayCm > 3) {
      penalties.push(PENALTY_SM.swayWarn);
      findings.push({ level: 'warn', text: `Sway ${input.carrySwayCm}см >3см` });
    } else findings.push({ level: 'ok', text: `Sway ${input.carrySwayCm}см — норма` });
  } else if (input.swayDeviation) {
    const isCrit = input.swayDeviation === 'loop';
    penalties.push(isCrit ? PENALTY_SM.swayCrit : PENALTY_SM.swayWarn);
    findings.push({ level: isCrit ? 'critical' : 'warn', text: `Carry path: ${input.swayDeviation}` });
  }

  if (input.vbtLossPct != null) {
    if (input.vbtLossPct >= 25) {
      penalties.push(PENALTY_SM.vbtCrit);
      findings.push({ level: 'critical', text: `VBT потеря ${input.vbtLossPct}% ≥25%` });
      floors.push('VBT ≥25% — стоп (carry)');
    } else if (input.vbtLossPct >= 15) {
      penalties.push(PENALTY_SM.vbtWarn);
      findings.push({ level: 'warn', text: `VBT ${input.vbtLossPct}% ≥15%` });
    } else findings.push({ level: 'ok', text: `VBT ${input.vbtLossPct}% — норма` });
  }

  if (input.mobilityFails != null && input.mobilityFails > 0) {
    for (let i = 0; i < input.mobilityFails; i++) penalties.push(PENALTY_SM.mobility);
    findings.push({ level: input.mobilityFails >= 3 ? 'critical' : 'warn', text: `OHS: ${input.mobilityFails}/6` });
  } else if (input.mobilityFails === 0) findings.push({ level: 'ok', text: 'OHS — норма' });

  if (input.gripFails != null && input.gripFails > 0) {
    for (let i = 0; i < input.gripFails; i++) penalties.push(PENALTY_SM.grip);
    findings.push({ level: input.gripFails >= 2 ? 'critical' : 'warn', text: `Grip: ${input.gripFails}/3 fail` });
    if (input.gripFails >= 2) floors.push('Grip ≥2/3 — prehab');
  } else if (input.gripFails === 0) findings.push({ level: 'ok', text: 'Grip — норма' });

  if (input.axialOverload) {
    penalties.push(PENALTY_SM.axial);
    findings.push({ level: 'warn', text: 'Axial overload ≥12 сетов + 300м' });
  }

  if (input.conditioningFail) {
    penalties.push(PENALTY_SM.conditioning);
    findings.push({ level: 'warn', text: 'Кондиция — провал medley' });
  }

  const rss = penalties.length ? Math.sqrt(penalties.reduce((s, p) => s + p * p, 0)) : 0;
  let score = Math.round(100 - rss);
  score = Math.max(0, Math.min(100, score));
  if (floors.length > 0 && score > 49) score = 49;
  const level: SMScoreLevel = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'critical';
  let verification = 0;
  if (input.hasVideo) verification += 0.30;
  if (input.hasVbt) verification += 0.30;
  if (input.hasMobility) verification += 0.20;
  if (input.hasGrip) verification += 0.20;
  verification = Math.round(verification * 100) / 100;
  return { score, level, penalties, verification, findings, floors };
}

export function smScoreColor(level: SMScoreLevel): string {
  return level === 'ok' ? '#22c55e' : level === 'warn' ? '#f59e0b' : '#ef4444';
}
