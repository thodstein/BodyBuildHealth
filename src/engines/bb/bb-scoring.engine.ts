/**
 * bb-scoring.engine.ts — RSS-скоринг ББ-диагностики (7 пенальти, как TA и risk-engine).
 * Евклидова норма субаддитивна: 7+7+7 → 12, не 21.
 */
export type BBScoreLevel = 'ok' | 'warn' | 'critical';

export interface BBScoreInput {
  weakCount: number;
  volumeIssues: number; // кол-во мышц exceeding/approaching/below
  volumeExceeding: number; // exceeding_mrv
  symmetryAsymPct: number | null; // макс L/R %
  symmetryIssues: number;
  stimulusPenalty: number; // 0-30 из bb-stimulus
  acwrDanger: number; // кол-во мышц dangerous
  acwrCaution: number;
  mobilityFails: number; // 0-6
  vbtLossPct: number | null;
  hasDiary: boolean;
  hasCircumf: boolean;
  hasVbt: boolean;
}

export interface BBScoreResult {
  score: number; // 0-100
  level: BBScoreLevel;
  floors: string[];
  verification: number; // 0-1
  penalties: Record<string, number>;
  raw: number;
}

export function scoreBB(input: BBScoreInput): BBScoreResult {
  const penWeak = input.weakCount >= 2 ? 28 : input.weakCount === 1 ? 14 : 0;
  const penVolume = input.volumeExceeding >= 2 ? 22 : (input.volumeIssues >= 2 ? 12 : input.volumeIssues >= 1 ? 6 : 0);
  // symmetry: L/R asymmetry drives
  let penSym = 0;
  if (input.symmetryAsymPct != null) {
    if (input.symmetryAsymPct >= 12) penSym = 24;
    else if (input.symmetryAsymPct >= 7) penSym = 12;
    else penSym = Math.min(10, input.symmetryIssues * 4);
  } else {
    penSym = Math.min(10, input.symmetryIssues * 4);
  }
  const penStimulus = Math.min(20, input.stimulusPenalty || 0);
  const penACWR = input.acwrDanger >= 1 ? 18 : input.acwrCaution >= 2 ? 10 : input.acwrCaution >= 1 ? 6 : 0;
  const penMobility = input.mobilityFails >= 3 ? 14 : input.mobilityFails >= 2 ? 8 : input.mobilityFails >= 1 ? 4 : 0;
  const penVBT = input.vbtLossPct != null ? (input.vbtLossPct > 40 ? 20 : input.vbtLossPct > 25 ? 10 : 0) : 0;

  const penalties: Record<string, number> = {
    weak: penWeak,
    volume: penVolume,
    symmetry: penSym,
    stimulus: penStimulus,
    acwr: penACWR,
    mobility: penMobility,
    vbt: penVBT,
  };
  const raw = Math.sqrt(Object.values(penalties).reduce((s, v) => s + v * v, 0));
  let score = Math.max(0, Math.min(100, Math.round(100 - raw)));
  const floors: string[] = [];
  if (input.symmetryAsymPct != null && input.symmetryAsymPct >= 12) {
    if (score > 49) { score = 49; floors.push('асимметрия ≥12% → ≤49'); }
  }
  if (input.volumeExceeding >= 2) {
    if (score > 59) { score = 59; floors.push('перегруз ≥2 мышц → ≤59'); }
  }
  if (input.acwrDanger >= 1) {
    if (score > 59) { score = 59; floors.push('ACWR danger ≥1 → ≤59'); }
  }
  if (input.vbtLossPct != null && input.vbtLossPct > 40) {
    if (score > 69) { score = 69; floors.push('VBT >40% → ≤69'); }
  }

  let level: BBScoreLevel = 'ok';
  if (score < 50) level = 'critical';
  else if (score < 75) level = 'warn';

  const verification = Math.min(1, Math.round((0.35 * (input.hasDiary ? 1 : 0) + 0.35 * (input.hasCircumf ? 1 : 0) + 0.30 * (input.hasVbt ? 1 : 0)) * 100) / 100);

  return { score, level, floors, verification, penalties, raw: Math.round(raw * 10) / 10 };
}

export function scoreColor(level: BBScoreLevel): string {
  if (level === 'critical') return '#ef4444';
  if (level === 'warn') return '#f59e0b';
  return '#22c55e';
}

export function levelLabel(level: BBScoreLevel): string {
  if (level === 'critical') return 'CRITICAL';
  if (level === 'warn') return 'WARN';
  return 'OK';
}
