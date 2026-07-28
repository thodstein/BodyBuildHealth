/**
 * manual-templates.engine.ts — muscle-aware set-templates.
 * F4.2: вынесено из manual-constructor.engine.ts.
 */
import type { UserSet } from '../user-program/user-program.types';

/** Грудь → 4×8-10, ноги → 4×6-10, плечи → 3×12-15, руки → 3×10-15, кор → 3×15-20. */
export function muscleAwareSets(muscle: string, level: string): Array<{ reps: number | string; rir: number; restSec: number }> {
  const m = (muscle || '').toLowerCase();
  const isAdvanced = level === 'advanced' || level === 'enhanced';
  if (['chest', 'back'].includes(m)) {
    return [{ reps: isAdvanced ? 8 : '8-10', rir: isAdvanced ? 1 : 2, restSec: 150 }];
  }
  if (m === 'legs' || m === 'quads' || m === 'hamstrings') {
    return [{ reps: isAdvanced ? 6 : '8-10', rir: isAdvanced ? 1 : 2, restSec: 180 }];
  }
  if (m === 'shoulders') {
    return [{ reps: '10-15', rir: 2, restSec: 90 }];
  }
  if (m === 'arms' || m === 'biceps' || m === 'triceps') {
    return [{ reps: '10-12', rir: 2, restSec: 90 }];
  }
  if (m === 'core' || m === 'abs' || m === 'calves') {
    return [{ reps: '12-20', rir: 3, restSec: 60 }];
  }
  return [{ reps: 10, rir: 2, restSec: 90 }];
}

/** Сборка UserSet[] по template (мульти-сеты). */
export function makeSetsFromTemplate(
  templates: Array<{ reps: number | string; rir: number; restSec: number }>,
  weight: number,
): UserSet[] {
  return templates.map((t) => ({ reps: t.reps, rir: t.rir, weight, restSec: t.restSec }));
}
