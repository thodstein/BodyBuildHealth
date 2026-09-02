/**
 * strength-sport-scoring.engine.ts — RSS-СКОРИНГ ТА (как arm-diagnostics + tz-spec)
 *
 * Шкала 0-100 (100=идеал), субаддитивная агрегация penalties через евклидову норму.
 * Verification 0-1 по факту измерений.
 * Якорные floors для критических дефицитов.
 */

export type ScoreLevel = 'ok' | 'warn' | 'critical';
export interface ScoringInput {
  weakCount: number;
  asymmetryPct?: number | null;
  barPathDeviation?: string | null;
  vbtLossPct?: number | null;
  mobilityFails?: number; // 0-6
  imtpRatio?: number | null; // ISPP/IMTP
}

export interface ScoringResult {
  score: number;
  level: ScoreLevel;
  penalties: number[];
  verification: number; // 0-1
  findings: Array<{ level: ScoreLevel; text: string }>;
  floors: string[];
}

const PENALTY = {
  weak: 12,
  asymmetryWarn: 14, // 7% like arm
  asymmetryCrit: 28, // 12%
  barWarn: 10,
  barCrit: 18,
  vbtWarn: 10, // TA: 10% power
  vbtCrit: 20,
  mobility: 8, // per segment fail
  imtp: 15,
};

/**
 * RSS-скоринг + floors.
 * verification: видео 0.35 + VBT 0.35 + мобильность 0.30 (аналог arm 0.4+0.3+0.3)
 */
export function scoreTA(input: ScoringInput & { hasVideo?: boolean; hasVbt?: boolean; hasMobility?: boolean }): ScoringResult {
  const penalties: number[] = [];
  const findings: Array<{ level: ScoreLevel; text: string }> = [];
  const floors: string[] = [];

  // weakPoints
  for (let i = 0; i < input.weakCount; i++) penalties.push(PENALTY.weak);
  if (input.weakCount > 0) findings.push({ level: input.weakCount >= 3 ? 'critical' : 'warn', text: `${input.weakCount} слабые фазы` });
  else findings.push({ level: 'ok', text: 'Слабые фазы — баланс' });

  // asymmetry (Bezkorovainyi 7.16/12.47 → округляем 7/12)
  if (input.asymmetryPct != null) {
    if (input.asymmetryPct >= 12) {
      penalties.push(PENALTY.asymmetryCrit);
      findings.push({ level: 'critical', text: `Асимметрия ${input.asymmetryPct}% ≥12%` });
      floors.push('Асимметрия ≥12% — критично');
    } else if (input.asymmetryPct >= 7) {
      penalties.push(PENALTY.asymmetryWarn);
      findings.push({ level: 'warn', text: `Асимметрия ${input.asymmetryPct}% ≥7%` });
    } else {
      findings.push({ level: 'ok', text: `Асимметрия ${input.asymmetryPct}% — норма` });
    }
  }

  // bar path
  if (input.barPathDeviation) {
    // петля — критично, остальное warn
    const isCrit = input.barPathDeviation === 'loop';
    penalties.push(isCrit ? PENALTY.barCrit : PENALTY.barWarn);
    findings.push({ level: isCrit ? 'critical' : 'warn', text: `Bar path: ${input.barPathDeviation}` });
  } else {
    findings.push({ level: 'ok', text: 'Траектория в допуске' });
  }

  // VBT loss (TA порог 10% power)
  if (input.vbtLossPct != null) {
    if (input.vbtLossPct >= 20) {
      penalties.push(PENALTY.vbtCrit);
      findings.push({ level: 'critical', text: `VBT потеря ${input.vbtLossPct}% ≥20%` });
      floors.push('VBT ≥20% — стоп');
    } else if (input.vbtLossPct >= 10) {
      penalties.push(PENALTY.vbtWarn);
      findings.push({ level: 'warn', text: `VBT ${input.vbtLossPct}% ≥10%` });
    } else {
      findings.push({ level: 'ok', text: `VBT ${input.vbtLossPct}% — норма` });
    }
  }

  // mobility
  if (input.mobilityFails != null && input.mobilityFails > 0) {
    for (let i = 0; i < input.mobilityFails; i++) penalties.push(PENALTY.mobility);
    findings.push({ level: input.mobilityFails >= 3 ? 'critical' : 'warn', text: `OHS: ${input.mobilityFails}/6` });
  } else if (input.mobilityFails === 0) {
    findings.push({ level: 'ok', text: 'OHS — норма' });
  }

  // IMTP/ISPP
  if (input.imtpRatio != null) {
    if (input.imtpRatio < 0.85) {
      penalties.push(PENALTY.imtp);
      findings.push({ level: 'warn', text: `ISPP/IMTP ${(input.imtpRatio * 100).toFixed(0)}% — слабый отрыв` });
      floors.push('ISPP <85% IMTP — приоритет отрыв');
    }
  }

  const rss = penalties.length ? Math.sqrt(penalties.reduce((s, p) => s + p * p, 0)) : 0;
  let score = Math.round(100 - rss);
  score = Math.max(0, Math.min(100, score));
  // floor: если критичный floor, score не выше 49
  if (floors.length > 0 && score > 49) score = 49;

  const level: ScoreLevel = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'critical';

  // verification: видео 0.35 + VBT 0.35 + мобильность 0.30
  let verification = 0;
  if (input.hasVideo) verification += 0.35;
  if (input.hasVbt) verification += 0.35;
  if (input.hasMobility) verification += 0.30;
  verification = Math.round(verification * 100) / 100;

  return { score, level, penalties, verification, findings, floors };
}

export function scoreColor(level: ScoreLevel): string {
  return level === 'ok' ? '#22c55e' : level === 'warn' ? '#f59e0b' : '#ef4444';
}
