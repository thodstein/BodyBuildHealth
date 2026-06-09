import type { MovementPattern, ExerciseSlotRole } from '../core/types';

export interface PatternRequirement {
  pattern: MovementPattern;
  role: ExerciseSlotRole;
  priority: number;
  rationale: string;
}

const SESSION_PATTERN_MAP: Record<string, MovementPattern[]> = {
  squat: ['squat', 'core', 'horizontal_pull', 'horizontal_push'],
  bench: ['horizontal_push', 'horizontal_pull', 'core', 'vertical_push'],
  deadlift: ['hinge', 'core', 'horizontal_pull', 'squat'],
  upper: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'core'],
  lower: ['squat', 'hinge', 'lunge', 'core', 'carry'],
  fullbody: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'core', 'vertical_push'],
  push: ['horizontal_push', 'vertical_push', 'core'],
  pull: ['horizontal_pull', 'vertical_pull', 'core'],
  legs: ['squat', 'hinge', 'lunge', 'core'],
  arms: ['horizontal_push', 'horizontal_pull', 'core'],
  conditioning: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'carry', 'core'],
  rehab: ['core', 'anti_rotation', 'lunge', 'carry'],
  accessory: ['horizontal_push', 'horizontal_pull', 'core', 'carry'],
};

const GOAL_PATTERN_BONUS: Record<string, MovementPattern[]> = {
  strength: ['squat', 'hinge', 'horizontal_push'],
  hypertrophy: ['squat', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'],
  conditioning: ['squat', 'hinge', 'carry', 'rotation'],
  technique: ['squat', 'hinge', 'horizontal_push'],
  rehab: ['core', 'anti_rotation', 'lunge'],
};

export function getRequiredPatterns(
  sessionFocus: string,
  goal: string,
  weakPoints: string[],
  blockedPatterns: MovementPattern[] = []
): PatternRequirement[] {
  const basePatterns = SESSION_PATTERN_MAP[sessionFocus] || SESSION_PATTERN_MAP.fullbody;
  const goalBonus = GOAL_PATTERN_BONUS[goal] || [];
  const patterns = [...new Set([...basePatterns, ...goalBonus])];
  const filtered = patterns.filter(p => !blockedPatterns.includes(p));
  const requirements: PatternRequirement[] = [];
  const weakPointPatterns = getWeakPointPatterns(weakPoints);

  for (const p of filtered) {
    const role = getPatternRole(p, basePatterns, goalBonus);
    const priority = getPatternPriority(p, weakPointPatterns);
    const rationale = getPatternRationale(p, role, priority, weakPointPatterns);
    requirements.push({ pattern: p, role, priority, rationale });
  }

  return requirements.sort((a, b) => b.priority - a.priority);
}

function getPatternRole(
  pattern: MovementPattern,
  basePatterns: MovementPattern[],
  goalBonus: MovementPattern[]
): ExerciseSlotRole {
  if (basePatterns.includes(pattern) && pattern !== 'core') return 'main';
  if (goalBonus.includes(pattern)) return 'secondary';
  return 'accessory';
}

function getWeakPointPatterns(weakPoints: string[]): MovementPattern[] {
  const map: Record<string, MovementPattern> = {
    squat: 'squat', deadlift: 'hinge', bench: 'horizontal_push',
    pullup: 'vertical_pull', row: 'horizontal_pull', press: 'vertical_push',
    quad: 'squat', hamstring: 'hinge', glute: 'hinge', chest: 'horizontal_push',
    back: 'horizontal_pull', shoulder: 'vertical_push', arm: 'horizontal_push',
    core_strength: 'core', stability: 'anti_rotation',
  };
  return weakPoints.map(wp => map[wp]).filter(Boolean) as MovementPattern[];
}

function getPatternPriority(pattern: MovementPattern, weakPointPatterns: MovementPattern[]): number {
  let priority = 10;
  if (['squat', 'hinge', 'horizontal_push', 'horizontal_pull'].includes(pattern)) priority = 50;
  if (pattern === 'core') priority = 30;
  if (weakPointPatterns.includes(pattern)) priority += 30;
  return priority;
}

function getPatternRationale(pattern: MovementPattern, role: ExerciseSlotRole, priority: number, weakPoints: MovementPattern[]): string {
  const roleLabels: Record<string, string> = { main: 'основной', secondary: 'второстепенный', accessory: 'подсобный', rehab: 'реабилитация', warmup: 'разминка' };
  let r = `${pattern} — ${roleLabels[role] || 'подсобный'} паттерн`;
  if (weakPoints.includes(pattern)) r += ' (компенсация слабого места)';
  return r;
}

export function getBlockedPatterns(
  injuries: { joint?: string; severity?: string }[],
  jointLimitations: Record<string, string>
): MovementPattern[] {
  const blocked: MovementPattern[] = [];
  for (const inj of injuries) {
    if (!inj.joint) continue;
    if (inj.joint === 'knee' && inj.severity === 'severe') blocked.push('squat', 'lunge');
    if (inj.joint === 'spine' && inj.severity === 'severe') blocked.push('hinge', 'rotation');
    if (inj.joint === 'shoulder' && inj.severity === 'severe') blocked.push('vertical_push', 'vertical_pull');
  }
  for (const [joint, level] of Object.entries(jointLimitations)) {
    if (level === 'severe') {
      if (joint === 'knee') blocked.push('squat', 'lunge');
      if (joint === 'spine') blocked.push('hinge', 'rotation');
      if (joint === 'shoulder') blocked.push('vertical_push');
    }
  }
  return [...new Set(blocked)];
}
