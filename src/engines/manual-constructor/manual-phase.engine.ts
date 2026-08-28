/**
 * manual-phase.engine.ts — применение фазовой периодизации к неделям UserProgram.
 * F4.2: вынесено из manual-constructor.engine.ts.
 * Фаза 1 PRO: trainingFocus-aware RIR drift, phaseRepShift, per-exercise tempo override, warmup пирамида.
 */
import type { UserWeek } from '../user-program/user-program.types';
import { distributePhases, PHASE_CONFIGS, getRirForWeek, getDupReps } from '../periodization';
import { exerciseTempoOverride } from '../bb/bb-tempo-rest';
import { rirDriftForPhaseWeek, phaseRepShift, warmupPyramidFor } from './manual-volume.engine';

export function applyPhaseModulation(
  weeks: UserWeek[],
  opts: { goal: string; level: string; deloadFreq?: number; weeksTotal: number; trainingFocus?: 'strength'|'hypertrophy'|'endurance' },
): UserWeek[] {
  const { goal, deloadFreq, weeksTotal, trainingFocus } = opts;
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
    // trainingFocus-aware RIR (strength/hypertrophy/endurance) + drift каждые 2 недели
    const focus = trainingFocus || 'hypertrophy';
    const baseRir = getRirForWeek(weekNum, actualWeeks, focus as any, pd.phase, phaseWeek);
    const drift = rirDriftForPhaseWeek(phaseWeek);
    const rir = Math.max(0, baseRir - (pd.phase === 'deload' ? 0 : drift));
    const rawReps = getDupReps(cfg, phaseWeek, phaseTotals[pd.phase] || 1);
    const shift = phaseRepShift(pd.phase as any, phaseWeek, pd.phase === 'deload');
    // rawReps может быть "8-12" или число — применяем shift
    const repsWithShift = (() => {
      if (typeof rawReps === 'string' && rawReps.includes('-')) {
        const [a,b] = rawReps.split('-').map(n => parseInt(n,10));
        const na = Math.max(1, a + shift);
        const nb = Math.max(na, b + shift);
        return `${na}-${nb}`;
      }
      if (typeof rawReps === 'number') return Math.max(1, rawReps + shift);
      return rawReps;
    })();
    const baseTempo = cfg.tempo;
    const deloadFlag = pd.phase === 'deload';

    const sessions = (w.sessions ?? []).map((s) => {
      // session phaseOverride (DUP внутри недели) — если задано, переопределяет rir/tempo для этой сессии
      const sessPhase = (s as any).phaseOverride || pd.phase;
      const sessCfg = sessPhase !== pd.phase ? ((PHASE_CONFIGS as any)[sessPhase] || cfg) : cfg;
      const sessTempoBase = sessCfg.tempo || baseTempo;
      const blocks = (s.blocks ?? []).map((b) => {
        const isCompound = b.type === 'compound';
        const rirAdj = Math.max(0, Math.min(5, sessPhase !== pd.phase ? getRirForWeek(weekNum, actualWeeks, focus as any, sessPhase as any, phaseWeek) : rir));
        // per-exercise tempo override (из bb-tempo-rest)
        const exTempo = exerciseTempoOverride(b.exerciseName) || sessTempoBase || baseTempo;
        // warmup пирамида для compound тяж
        const warmupSets = (isCompound && b.character === 'тяж' && b.sets?.[0]?.weight) ? warmupPyramidFor(b.sets[0].weight as number) : b.warmupSets;
        const sets = (b.sets ?? []).map((st) => {
          const useNumericReps = typeof st.reps === 'number' && st.reps > 0;
          // reps с учётом shift (если статический numeric — не трогаем, если из фазы — берём repsWithShift)
          const nextReps = useNumericReps ? st.reps : repsWithShift;
          return {
            ...st,
            rir: rirAdj,
            tempo: exTempo || st.tempo || baseTempo,
            reps: nextReps,
            restSec: isCompound
              ? Math.max(90, st.restSec ?? (b.character === 'тяж' ? 180 : b.character === 'памп' ? 60 : 120))
              : (st.restSec ?? 90),
          };
        });
        const firstReps = sets[0]?.reps;
        const repsRange: [number, number] = (typeof firstReps === 'number' && firstReps > 0)
          ? [firstReps, firstReps]
          : (typeof firstReps === 'string' && (firstReps as string).includes('-')
            ? [parseInt((firstReps as string).split('-')[0]) || 8, parseInt((firstReps as string).split('-')[1] || (firstReps as string).split('-')[0]) || 12]
            : [parseInt(String(repsWithShift).split('-')[0]) || 8, parseInt(String(repsWithShift).split('-')[1] || String(repsWithShift).split('-')[0]) || 12]);
        return {
          ...b,
          repsRange,
          tempoSpec: exTempo || baseTempo,
          warmupSets,
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
