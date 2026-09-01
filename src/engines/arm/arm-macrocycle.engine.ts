/**
 * arm-macrocycle.engine.ts — годовой макро для арм-блока (как bb-macrocycle).
 * 4 фазы: hypertrophy → strength → peaking → transition.
 */
export type ArmMacroPhase = 'hypertrophy' | 'strength' | 'peaking' | 'transition';

export interface ArmMacroBlock {
  phase: ArmMacroPhase;
  weeks: number;
  weekOffset: number;
  description?: string;
  competitionId?: string;
}

export interface ArmMacrocycle {
  type: 'arm';
  blocks: ArmMacroBlock[];
  totalWeeks: number;
  rationale: string[];
}

export function buildArmMacrocycle(input: {
  totalWeeks: number;
  goal?: string;
  level?: string;
  competitions?: Array<{ week: number; id: string }>;
}): ArmMacrocycle {
  const total = Math.max(4, Math.min(52, Math.round(input.totalWeeks || 12)));
  const blocks: ArmMacroBlock[] = [];
  const goal = (input.goal || 'strength').toLowerCase();
  let offset = 0;

  // Распределение: hypertrophy 40% → strength 35% → peaking 15% → transition 10%
  // Для peaking цели — peaking больше; для hypertrophy — hypertrophy больше
  let hPct = 0.4, sPct = 0.35, pPct = 0.15, tPct = 0.1;
  if (goal === 'hypertrophy') { hPct = 0.5; sPct = 0.3; pPct = 0.1; tPct = 0.1; }
  if (goal === 'peaking') { hPct = 0.3; sPct = 0.3; pPct = 0.3; tPct = 0.1; }

  const hW = Math.max(2, Math.round(total * hPct));
  const sW = Math.max(2, Math.round(total * sPct));
  const pW = Math.max(1, Math.round(total * pPct));
  const tW = Math.max(1, total - hW - sW - pW);

  const phases: Array<{ phase: ArmMacroPhase; weeks: number }> = [
    { phase: 'hypertrophy', weeks: hW },
    { phase: 'strength', weeks: sW },
    { phase: 'peaking', weeks: pW },
    { phase: 'transition', weeks: tW },
  ];

  for (const ph of phases) {
    if (ph.weeks <= 0) continue;
    blocks.push({ phase: ph.phase, weeks: ph.weeks, weekOffset: offset, description: `${ph.phase} ${ph.weeks} нед` });
    offset += ph.weeks;
  }

  // Привязка competition → peaking
  if (input.competitions && input.competitions.length > 0) {
    for (const comp of input.competitions) {
      const blk = blocks.find(b => comp.week >= b.weekOffset + 1 && comp.week <= b.weekOffset + b.weeks);
      if (blk) blk.competitionId = comp.id;
    }
  }

  return {
    type: 'arm' as const,
    blocks,
    totalWeeks: total,
    rationale: [`Арм-макро ${total} нед: ${blocks.map(b => `${b.phase} ${b.weeks}н`).join(' → ')}`],
  };
}

export function armMacroPhaseForWeek(macro: ArmMacrocycle, week: number): ArmMacroPhase | null {
  for (const b of macro.blocks) {
    if (week >= b.weekOffset + 1 && week <= b.weekOffset + b.weeks) return b.phase;
  }
  return null;
}
