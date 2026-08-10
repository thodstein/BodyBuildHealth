import type { MesocyclePhase } from '../rir-matrix.engine';
import type { SRDaySpec, SRPeriod } from '../../data/lms-cycles/lms-types';

export interface SourceWeekSnapshot {
  week: number;
  volumeSets: number;
  intensityPct: number;
  rir: number;
  phase: MesocyclePhase;
}

export const SOURCE_PHASE_LABEL: Record<MesocyclePhase, string> = {
  base: 'База',
  build: 'Накопление',
  peak: 'Интенсификация / пик',
  deload: 'Разгрузка',
};

export function sourcePhaseForWeek(
  snapshot: Pick<SourceWeekSnapshot, 'volumeSets' | 'intensityPct'>,
  index: number,
  allWeeks: Array<Pick<SourceWeekSnapshot, 'volumeSets' | 'intensityPct'>>,
  period: SRPeriod = 'strength',
): MesocyclePhase {
  const previous = allWeeks[index - 1];
  const maxIntensity = Math.max(...allWeeks.map(week => week.intensityPct), 0.001);
  const maxVolume = Math.max(...allWeeks.map(week => week.volumeSets), 1);

  if (previous && snapshot.volumeSets <= previous.volumeSets * 0.72) return 'deload';
  if (index === allWeeks.length - 1 && snapshot.volumeSets <= maxVolume * 0.65) return 'deload';
  if (period === 'peak' || (allWeeks.length > 1 && snapshot.intensityPct >= maxIntensity * 0.9 && index >= Math.floor(allWeeks.length * 0.45))) return 'peak';
  if (period === 'mass' || period === 'mixed' || (allWeeks.length > 1 && (index >= Math.ceil(allWeeks.length * 0.35) || snapshot.volumeSets >= maxVolume * 0.9))) return 'build';
  return 'base';
}

export function summarizeSourceCycleWeeks(weeks: SRDaySpec[][], period: SRPeriod = 'strength'): SourceWeekSnapshot[] {
  const summaries = weeks.map((week, index) => {
    let volumeSets = 0;
    let intensityNumerator = 0;
    let rirNumerator = 0;
    for (const day of week) {
      for (const exercise of day.exercises) {
        for (const set of exercise.sets) {
          const sets = Math.max(0, Number(set.sets) || 0);
          volumeSets += sets;
          intensityNumerator += (Number(set.pct) || 0) * sets;
          rirNumerator += (Number(set.rir) || 0) * sets;
        }
      }
    }
    return {
      week: index + 1,
      volumeSets,
      intensityPct: volumeSets > 0 ? intensityNumerator / volumeSets : 0,
      rir: volumeSets > 0 ? rirNumerator / volumeSets : 0,
      phase: 'base' as MesocyclePhase,
    };
  });
  return summaries.map((summary, index) => ({
    ...summary,
    phase: sourcePhaseForWeek(summary, index, summaries, period),
  }));
}

export function sourceWeekColor(snapshot: SourceWeekSnapshot, allWeeks: SourceWeekSnapshot[]): string {
  const intensities = allWeeks.map(week => week.intensityPct);
  const volumes = allWeeks.map(week => week.volumeSets);
  const minIntensity = Math.min(...intensities);
  const maxIntensity = Math.max(...intensities);
  const minVolume = Math.min(...volumes);
  const maxVolume = Math.max(...volumes);
  const intensityRatio = (snapshot.intensityPct - minIntensity) / Math.max(0.001, maxIntensity - minIntensity);
  const volumeRatio = (snapshot.volumeSets - minVolume) / Math.max(1, maxVolume - minVolume);
  const loadRatio = Math.max(0, Math.min(1, intensityRatio * 0.7 + volumeRatio * 0.3));
  const hue = Math.round(145 - loadRatio * 145);
  return `hsl(${hue} 72% 48%)`;
}
