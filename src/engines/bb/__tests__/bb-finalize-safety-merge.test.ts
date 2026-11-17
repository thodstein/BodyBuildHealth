import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

describe('BB finalizer safety merge', () => {
  it('reuses persisted restrictions when options are omitted', () => {
    const plan: any = {
      pattern: {},
      safetyConstraints: { equipment: ['machine'], avoidAxialLoad: true },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [{
        muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2,
        repsRange: [6, 8], rir: 2,
        workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
      }] }] }],
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: false, level: 'intermediate' });
    // P2-3 (аудит 2026-11): safety-ремонт больше не привязан к `reorder`, поэтому план не
    // остаётся невалидным — ограничения из `safetyConstraints` реально применяются
    // (раньше тест проверял обратное: «нарушение осталось в плане», то есть дефект).
    const exs = result.weeks[0].sessions[0].exercises;
    expect(exs.filter(e => /штанг|barbell|гриф/i.test(String(e.name)))).toHaveLength(0);
    expect(exs.some(e => /Safety repair/.test(String(e.comment || '')))).toBe(true);
    expect(result.validation?.issues.some(issue => issue.code === 'equipment_restriction_violation')).toBe(false);
    expect(result.safetyConstraints).toEqual(plan.safetyConstraints);
  });
});
