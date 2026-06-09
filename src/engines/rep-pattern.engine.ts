import type { RepPatternType, RepPatternConfig, MovementPattern } from '../core/types';

const GOAL_PATTERN_MAP: Record<string, { pattern: RepPatternType; minReps: number; maxReps: number }[]> = {
  strength: [
    { pattern: 'normal', minReps: 1, maxReps: 6 },
    { pattern: 'pause', minReps: 1, maxReps: 5 },
    { pattern: 'cluster', minReps: 1, maxReps: 3 },
  ],
  hypertrophy: [
    { pattern: 'normal', minReps: 6, maxReps: 20 },
    { pattern: 'tempo', minReps: 6, maxReps: 15 },
    { pattern: 'rest_pause', minReps: 6, maxReps: 10 },
    { pattern: 'slow', minReps: 6, maxReps: 12 },
  ],
  conditioning: [
    { pattern: 'normal', minReps: 10, maxReps: 25 },
    { pattern: 'explosive', minReps: 5, maxReps: 15 },
  ],
  technique: [
    { pattern: 'slow', minReps: 3, maxReps: 8 },
    { pattern: 'tempo', minReps: 3, maxReps: 8 },
  ],
  rehab: [
    { pattern: 'slow', minReps: 8, maxReps: 15 },
    { pattern: 'partial', minReps: 5, maxReps: 12 },
    { pattern: 'tempo', minReps: 6, maxReps: 12 },
  ],
};

const DIFFICULTY_RESTRICTIONS: Record<string, RepPatternType[]> = {
  low: ['normal', 'tempo', 'slow'],
  medium: ['normal', 'pause', 'tempo', 'slow', 'explosive'],
  high: ['normal', 'pause', 'cluster', 'rest_pause', 'explosive', 'tempo', 'slow'],
};

export function selectRepPattern(
  goal: string,
  movementPattern: MovementPattern,
  difficultyLevel: string,
  techniqueIssues: string[],
  riskFlags: Record<string, string>
): RepPatternConfig {
  const goalPatterns = GOAL_PATTERN_MAP[goal] || GOAL_PATTERN_MAP.hypertrophy;
  const allowedTypes = DIFFICULTY_RESTRICTIONS[difficultyLevel] || DIFFICULTY_RESTRICTIONS.medium;

  const candidates = goalPatterns
    .filter(p => allowedTypes.includes(p.pattern))
    .filter(p => !(techniqueIssues.length > 0 && p.pattern === 'explosive'))
    .filter(p => !(Object.values(riskFlags).includes('high') && (p.pattern === 'explosive' || p.pattern === 'cluster')));

  if (candidates.length === 0) {
    return { pattern: 'normal', minReps: 8, maxReps: 12 };
  }

  const selected = candidates[0];
  return {
    pattern: selected.pattern,
    minReps: selected.minReps,
    maxReps: selected.maxReps,
    restBetweenRepsSec: getRestForPattern(selected.pattern),
    pausePosition: getPausePosition(selected.pattern, movementPattern),
    pauseSec: getPauseSec(selected.pattern),
  };
}

function getRestForPattern(pattern: RepPatternType): number | undefined {
  const map: Record<string, number> = { cluster: 15, rest_pause: 20, myo_rep: 15 };
  return map[pattern];
}

function getPausePosition(pattern: RepPatternType, movement: MovementPattern): 'bottom' | 'top' | 'mid' | undefined {
  if (pattern === 'pause') {
    if (['squat', 'hinge', 'horizontal_push'].includes(movement)) return 'bottom';
    return 'bottom';
  }
  return undefined;
}

function getPauseSec(pattern: RepPatternType): number | undefined {
  if (pattern === 'pause') return 2;
  if (pattern === 'slow') return 1;
  if (pattern === 'tempo') return 1;
  return undefined;
}
