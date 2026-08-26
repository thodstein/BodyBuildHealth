import { describe, expect, it } from 'vitest';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';

const WORK_MAX = {
  chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140,
  hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80,
  forearms: 40,
};

describe('BB generic generation integration', () => {
  for (const pattern of SPLIT_PATTERNS) {
    it(`generates a structurally valid ${pattern.id} plan`, () => {
      const plan = buildBBPlan({
        patternId: pattern.id,
        level: 'intermediate',
        goal: 'mass',
        weeks: 4,
        workMax: WORK_MAX,
        volumeGoal: 'mav',
        trainingFocus: 'hypertrophy',
      });
      const validation = validateBBPlan(plan);
      const errors = validation.issues.filter(issue => issue.level === 'error');
      expect(errors, errors.map(issue => issue.message).join('\n')).toHaveLength(0);
      expect(plan.weeks).toHaveLength(4);
      for (const week of plan.weeks) {
        for (const session of week.sessions) {
          // Разминочные упражнения (warmupActivator) и optional-добивки
          // («при наличии сил» ⚡) не входят в лимит рабочих упражнений.
          const working = session.exercises.filter((ex: any) => !ex.warmupActivator && !ex.optional);
          expect(working.length).toBeLessThanOrEqual(10);
          for (const exercise of session.exercises) {
            expect(exercise.sets).toBeGreaterThanOrEqual(1);
            expect(exercise.workSets).toHaveLength(exercise.sets);
          }
        }
      }
    }, 30000);
  }
});
