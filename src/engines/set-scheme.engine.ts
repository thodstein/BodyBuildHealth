import type { SetScheme, SetSchemeType, MovementPattern } from '../core/types';

export interface SetSchemeInput {
  goal: string;
  movementPattern: MovementPattern;
  difficultyLevel: string;
  techniqueIssues: string[];
  riskFlags: Record<string, string>;
  fatigueScore: number;
  repPattern: string;
  isPrimaryLift: boolean;
}

const GOAL_SCHEMES: Record<string, { scheme: SetSchemeType; sets: number; workingSets: number; progression: string }[]> = {
  strength: [
    { scheme: 'top_backoff', sets: 4, workingSets: 3, progression: 'rpe' },
    { scheme: 'wave', sets: 5, workingSets: 3, progression: 'rpe' },
    { scheme: 'cluster', sets: 4, workingSets: 4, progression: 'linear' },
  ],
  hypertrophy: [
    { scheme: 'straight', sets: 4, workingSets: 3, progression: 'double' },
    { scheme: 'reverse_pyramid', sets: 4, workingSets: 3, progression: 'double' },
    { scheme: 'density', sets: 5, workingSets: 4, progression: 'autoregulated' },
    { scheme: 'pyramid', sets: 5, workingSets: 3, progression: 'double' },
  ],
  conditioning: [
    { scheme: 'emom', sets: 8, workingSets: 8, progression: 'linear' },
    { scheme: 'density', sets: 6, workingSets: 6, progression: 'autoregulated' },
  ],
  technique: [
    { scheme: 'straight', sets: 3, workingSets: 3, progression: 'linear' },
    { scheme: 'emom', sets: 4, workingSets: 4, progression: 'linear' },
  ],
  rehab: [
    { scheme: 'straight', sets: 3, workingSets: 2, progression: 'double' },
  ],
};

export function selectSetScheme(input: SetSchemeInput): SetScheme {
  const schemes = GOAL_SCHEMES[input.goal] || GOAL_SCHEMES.hypertrophy;
  const filtered = schemes.filter(s => {
    if (['cluster', 'wave'].includes(s.scheme) && input.techniqueIssues.length > 0) return false;
    if (s.scheme === 'cluster' && Object.values(input.riskFlags).includes('high')) return false;
    if (s.scheme === 'density' && input.fatigueScore > 0.6) return false;
    if (!input.isPrimaryLift && s.scheme === 'top_backoff') return false;
    return true;
  });

  const selected = filtered[0] || { scheme: 'straight' as SetSchemeType, sets: 3, workingSets: 3, progression: 'double' };

  let setCount = selected.sets;
  if (input.fatigueScore > 0.7) setCount = Math.max(2, setCount - 1);
  if (input.fatigueScore < 0.3 && input.goal === 'hypertrophy') setCount = Math.min(6, setCount + 1);

  const progressionModel = selected.progression as SetScheme['progressionModel'];

  return {
    schemeType: selected.scheme,
    totalSets: setCount,
    workingSets: selected.workingSets,
    progressionModel,
    metadata: getSchemeMetadata(selected.scheme, setCount),
  };
}

function getSchemeMetadata(scheme: SetSchemeType, sets: number): Record<string, number> {
  switch (scheme) {
    case 'top_backoff': return { topSets: 1, backoffSets: sets - 1, backoffPct: 90 };
    case 'pyramid': return { peakSet: Math.ceil(sets / 2), incrementPct: 5 };
    case 'reverse_pyramid': return { heaviestSet: 1, decrementPct: 5 };
    case 'wave': return { waves: 2, setsPerWave: Math.floor(sets / 2) };
    case 'cluster': return { repsPerCluster: 1, restBetweenClusters: 15, clusters: sets };
    case 'emom': return { intervalSec: 60, totalMinutes: sets };
    case 'density': return { timeCapMinutes: 15, targetSets: sets };
    case 'myo_rep': return { activationSet: 1, miniSets: sets - 1, miniSetReps: 3 };
    default: return {};
  }
}
