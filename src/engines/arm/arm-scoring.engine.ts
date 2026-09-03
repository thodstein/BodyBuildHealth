/**
 * arm-scoring.engine.ts — RSS-скоринг арм-диагностики (PRO оверлей, выкл. по умолчанию).
 * Зеркало strength-sport-scoring.engine.ts (scoreTA) + bb-scoring.
 * Шкала 0-100 (100=идеал), субаддитивно √Σpen².
 * Verification 0-1 (video 0.35 + VBT 0.35 + gripHistory 0.30).
 * Floors: asym≥12, humerus, tendon>22 — cap 49.
 * Используется только для gauge оверлея, основной отчёт остаётся механизм-ориентированным (без score).
 */

export type ScoreLevel = 'ok' | 'warn' | 'critical';
export interface ArmScoringInput {
  weakCount: number; // 0-3 (мёртвые точки)
  asymmetryPct?: number | null;
  sideSetsWeek1?: number;
  tendonSets?: number;
  tendonLimit?: number; // 12/16/18/22 по уровню
  gripLevel?: string; // bench level
  hasVideo?: boolean;
  hasVbt?: boolean;
  hasGripHistory?: boolean;
  level?: string; // beginner etc для tendon floor
}

export interface ArmScoringResult {
  score: number;
  level: ScoreLevel;
  penalties: number[];
  verification: number;
  findings: Array<{ level: ScoreLevel; text: string }>;
  floors: string[];
}

const PENALTY = {
  weak: 12,
  asymmetryWarn: 14,
  asymmetryCrit: 28,
  humerusWarn: 10,
  humerusCrit: 18,
  tendonWarn: 10,
  tendonCrit: 20,
  gripWarn: 8,
};

export function scoreArm(input: ArmScoringInput): ArmScoringResult {
  const penalties: number[] = [];
  const findings: Array<{ level: ScoreLevel; text: string }> = [];
  const floors: string[] = [];

  for (let i = 0; i < input.weakCount; i++) penalties.push(PENALTY.weak);
  if (input.weakCount > 0) findings.push({ level: input.weakCount >= 3 ? 'critical' : 'warn', text: `${input.weakCount} мёртвые точки` });
  else findings.push({ level: 'ok', text: 'Мёртвые точки — баланс' });

  if (input.asymmetryPct != null) {
    if (input.asymmetryPct >= 12) {
      penalties.push(PENALTY.asymmetryCrit);
      findings.push({ level: 'critical', text: `Асимметрия ${input.asymmetryPct}% ≥12%` });
      floors.push('Асимметрия ≥12% — критично (cap 49)');
    } else if (input.asymmetryPct >= 7) {
      penalties.push(PENALTY.asymmetryWarn);
      findings.push({ level: 'warn', text: `Асимметрия ${input.asymmetryPct}% ≥7%` });
    } else {
      findings.push({ level: 'ok', text: `Асимметрия ${input.asymmetryPct}% — норма` });
    }
  }

  if (input.sideSetsWeek1 != null) {
    if (input.sideSetsWeek1 > 9) {
      penalties.push(PENALTY.humerusCrit);
      findings.push({ level: 'critical', text: `Side ${input.sideSetsWeek1} >9 — humerus CRITICAL` });
      floors.push('Side >9 — humerus cap 49');
    } else if (input.sideSetsWeek1 > 6) {
      penalties.push(PENALTY.humerusWarn);
      findings.push({ level: 'warn', text: `Side ${input.sideSetsWeek1} >6 ранние нед` });
    } else if (input.sideSetsWeek1 >= 0) {
      findings.push({ level: 'ok', text: `Side ${input.sideSetsWeek1} — в допуске` });
    }
  }

  if (input.tendonSets != null) {
    const lim = input.tendonLimit ?? 18;
    if (input.tendonSets > 22) {
      penalties.push(PENALTY.tendonCrit);
      findings.push({ level: 'critical', text: `Tendon ${input.tendonSets} >22` });
      floors.push('Tendon >22 — cap 49');
    } else if (input.tendonSets > lim) {
      penalties.push(input.tendonSets > lim + 4 ? PENALTY.tendonCrit : PENALTY.tendonWarn);
      findings.push({ level: input.tendonSets > lim + 4 ? 'critical' : 'warn', text: `Tendon ${input.tendonSets} >${lim}` });
    } else {
      findings.push({ level: 'ok', text: `Tendon ${input.tendonSets} — в допуске` });
    }
    if (input.level === 'beginner' && input.tendonSets > 12) {
      if (!findings.some(f => f.text.includes('Tendon') && f.level !== 'ok')) {
        penalties.push(PENALTY.tendonWarn);
        findings.push({ level: 'warn', text: `Tendon ${input.tendonSets} >12 для beginner` });
      }
    }
  }

  if (input.gripLevel) {
    if (['beginner','intermediate'].includes(input.gripLevel) && input.weakCount >= 2) {
      penalties.push(PENALTY.gripWarn);
      findings.push({ level: 'warn', text: `Bench ${input.gripLevel} + ${input.weakCount} точки` });
    }
  }

  const rss = penalties.length ? Math.sqrt(penalties.reduce((s, p) => s + p * p, 0)) : 0;
  let score = Math.round(100 - rss);
  score = Math.max(0, Math.min(100, score));
  if (floors.length > 0 && score > 49) score = 49;

  const level: ScoreLevel = score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'critical';

  let verification = 0;
  if (input.hasVideo) verification += 0.35;
  if (input.hasVbt) verification += 0.35;
  if (input.hasGripHistory) verification += 0.30;
  verification = Math.round(verification * 100) / 100;

  return { score, level, penalties, verification, findings, floors };
}

export function scoreColor(level: ScoreLevel): string {
  return level === 'ok' ? '#22c55e' : level === 'warn' ? '#f59e0b' : '#ef4444';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Отлично';
  if (score >= 50) return 'Есть лимитер';
  return 'Критично';
}
