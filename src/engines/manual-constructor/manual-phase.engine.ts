/**
 * manual-phase.engine.ts — применение фазовой периодизации к неделям UserProgram.
 * F4.2: вынесено из manual-constructor.engine.ts.
 */
import type { UserWeek } from '../user-program/user-program.types';
import { distributePhases, PHASE_CONFIGS, getRirForWeek, getDupReps } from '../periodization';

export function applyPhaseModulation(
  weeks: UserWeek[],
  opts: { goal: string; level: string; deloadFreq?: number; weeksTotal: number },
): UserWeek[] {
  const { goal, deloadFreq, weeksTotal } = opts;
  const actualWeeks = Math.max(1, weeksTotal);
  const deloadEvery = deloadFreq ?? (actualWeeks >= 8 ? 4 : actualWeeks >= 6 ? 3 : 0);
  const dist = distributePhases(actualWeeks, deloadEvery, goal);
  const phaseWeekMap: Record<string, number> = {};
  const phaseTotals: Record<string, number> = { accumulation: 0, intensification: 0, deload: 0, peaking: 0 };
  for (const pd of dist) { phaseTotals[pd.phase] = (phaseTotals[pd.phase] || 0) + (pd.weeks?.length || 0); }

  return weeks.map((w) => {
    const weekNum = w.week;
    const pd = dist.find((d) => d.weeks && d.weeks.includes(weekNum));
    if (!pd) return w;
    phaseWeekMap[pd.phase] = (phaseWeekMap[pd.phase] || 0) + 1;
    const phaseWeek = phaseWeekMap[pd.phase];
    const cfg = PHASE_CONFIGS[pd.phase];
    if (!cfg) return w;
    const rir = getRirForWeek(weekNum, actualWeeks, 'default', pd.phase, phaseWeek);
    const reps = getDupReps(cfg, phaseWeek, phaseTotals[pd.phase] || 1);
    const tempo = cfg.tempo;
    const deloadFlag = pd.phase === 'deload';

    const sessions = (w.sessions ?? []).map((s) => {
      const blocks = (s.blocks ?? []).map((b) => {
        const isCompound = b.type === 'compound';
        const rirAdj = Math.max(0, Math.min(5, rir));
        const sets = (b.sets ?? []).map((st) => ({
          ...st,
          rir: rirAdj,
          tempo: tempo || st.tempo,
          reps: reps,
          restSec: isCompound ? Math.max(90, st.restSec ?? 120) : st.restSec,
        }));
        return {
          ...b,
          repsRange: [parseInt(reps.split('-')[0]) || 8, parseInt(reps.split('-')[1] || reps.split('-')[0]) || 12] as [number, number],
          tempoSpec: tempo,
          sets,
        };
      });
      return { ...s, blocks };
    });

    return {
      ...w,
      phase: pd.phase as 'accumulation' | 'intensification' | 'deload' | 'peaking',
      deload: deloadFlag,
      sessions,
    };
  });
}
