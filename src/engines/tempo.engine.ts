import type { TempoProfile } from '../core/types';

const GOAL_TEMPO_MAP: Record<string, TempoProfile> = {
  strength: { eccentricSec: 2, pauseBottomSec: 0, concentricSec: 1, pauseTopSec: 0, label: '2-0-1-0' },
  hypertrophy: { eccentricSec: 3, pauseBottomSec: 1, concentricSec: 1, pauseTopSec: 0, label: '3-1-1-0' },
  hypertrophy_slow: { eccentricSec: 4, pauseBottomSec: 1, concentricSec: 2, pauseTopSec: 0, label: '4-1-2-0' },
  conditioning: { eccentricSec: 1, pauseBottomSec: 0, concentricSec: 1, pauseTopSec: 0, label: '1-0-1-0' },
  technique: { eccentricSec: 4, pauseBottomSec: 2, concentricSec: 2, pauseTopSec: 1, label: '4-2-2-1' },
  rehab: { eccentricSec: 5, pauseBottomSec: 2, concentricSec: 2, pauseTopSec: 1, label: '5-2-2-1' },
};

export function selectTempo(
  goal: string,
  techniqueIssues: string[],
  riskFlags: Record<string, string>,
  isCompound: boolean
): TempoProfile {
  if (Object.values(riskFlags).includes('high') || techniqueIssues.length > 0) {
    return GOAL_TEMPO_MAP.technique;
  }

  if (goal === 'hypertrophy') {
    return isCompound ? GOAL_TEMPO_MAP.hypertrophy : GOAL_TEMPO_MAP.hypertrophy_slow;
  }

  return GOAL_TEMPO_MAP[goal] || GOAL_TEMPO_MAP.hypertrophy;
}

export function formatTempo(tempo: TempoProfile): string {
  return tempo.label;
}
