/**
 * combat-scoring.engine.ts — P7 скоринг хаба (RSS по шаблону scoreTA/scoreSM/scoreArm).
 * score = 100 − √(Σpen²); floors: redflag/neck-fail/asym≥12 → cap 49.
 * verification: видео 0.35 + трекер 0.30 + мобильность 0.35 (факт наличия данных).
 */
import type { CombatStrikeLevel } from './combat-strike-biomech.engine';
import type { CombatTakedownLevel } from './combat-takedown.engine';
import type { CombatStrikePathVerdict } from './combat-strike-path.engine';

export interface CombatScoreInput {
  worstStrike: CombatStrikeLevel | null;
  worstTakedown: CombatTakedownLevel | null;
  path: CombatStrikePathVerdict | null;
  asymPct: number | null;
  trackerPresent: boolean;
  videoPresent: boolean;
  mobilityPresent: boolean;
  safetyBlocked: boolean;
  neckWeak: boolean;
}

export interface CombatScore {
  score: number;
  level: string;
  verification: number;
  penalties: Record<string, number>;
  capped: boolean;
  text: string;
}

const PEN: Record<string, number> = {
  strikeWarn: 12, strikeCritical: 20,
  takedownWarn: 10, takedownCritical: 16,
  pathLoop: 14,
  asymWatch: 14, asymFix: 28,
  tracker: 6, mobilityMissing: 8,
};

export function scoreCombat(inp: CombatScoreInput): CombatScore {
  const penalties: Record<string, number> = {};
  if (inp.worstStrike === 'warn') penalties.strike = PEN.strikeWarn;
  if (inp.worstStrike === 'critical') penalties.strike = PEN.strikeCritical;
  if (inp.worstTakedown === 'warn') penalties.takedown = PEN.takedownWarn;
  if (inp.worstTakedown === 'critical') penalties.takedown = PEN.takedownCritical;
  if (inp.path === 'loop') penalties.bar = PEN.pathLoop;
  if (inp.asymPct != null && inp.asymPct >= 12) penalties.asym = PEN.asymFix;
  else if (inp.asymPct != null && inp.asymPct >= 7) penalties.asym = PEN.asymWatch;
  if (inp.trackerPresent) penalties.tracker = 0;
  if (!inp.mobilityPresent) penalties.mobility = PEN.mobilityMissing;
  const rss = Math.sqrt(Object.values(penalties).reduce((a, b) => a + b * b, 0));
  let score = Math.max(0, Math.round(100 - rss));
  let capped = false;
  if (inp.safetyBlocked || inp.neckWeak || (inp.asymPct != null && inp.asymPct >= 12)) {
    if (score > 49) { score = 49; capped = true; }
  }
  const verification = Math.round(
    ((inp.videoPresent ? 0.35 : 0) + (inp.trackerPresent ? 0.3 : 0) + (inp.mobilityPresent ? 0.35 : 0)) * 100,
  ) / 100;
  const level = score >= 85 ? 'элита' : score >= 65 ? 'уверенно' : score >= 45 ? 'середняк' : 'разбирать базу';
  const text = `Скор ${score} (${level}), верификация ${(verification * 100).toFixed(0)}%${capped ? ', срезан гейтом ≤49' : ''}`;
  return { score, level, verification, penalties, capped, text };
}
