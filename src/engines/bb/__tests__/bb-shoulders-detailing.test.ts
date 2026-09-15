import { describe, it, expect } from 'vitest';
import {
  ANGLE_CLASSES,
  STRICT_EXERCISE_GROUPS,
  strictGroupForExercise,
  strictGroupMembersOf,
  selectDiverseExercises,
} from '../bb-exercise-selection.engine';
import { auditPlanExercises } from '../bb-plan-exercise-audit.engine';
import { simulateCorrection } from '../bb-exercise-simulator.engine';
import { calcExerciseEffect } from '../bb-exercise-effect.engine';

/** Плечи: углы + строгие группы. Сечка: missingShortened-флаг + резолв симулятором. */
describe('bb-shoulders-detailing', () => {
  it('угловые классы плеч покрывают жим/махи/заднюю/тягу', () => {
    expect(ANGLE_CLASSES.shoulders.length).toBeGreaterThanOrEqual(4);
    const cls = (id: string, name: string) =>
      calcExerciseEffect({ id, name } as any, { muscle: 'shoulders' } as any).angleClass;
    expect(cls('ohp', 'Жим стоя')).toBe('overhead_press');
    expect(cls('lateral_raise', 'Махи гантелей в стороны')).toBe('lateral_raise');
    expect(cls('rear_delt_fly', 'Махи в наклоне на заднюю дельту')).toBe('rear_delt');
    expect(cls('upright_row', 'Тяга штанги к подбородку')).toBe('upright_row');
  });
  it('selectDiverseExercises раскладывает плечи по разным углам', () => {
    const pool = [
      { id: 'ohp', name: 'Жим стоя' },
      { id: 'lateral_raise', name: 'Махи гантелей в стороны' },
      { id: 'rear_delt_fly', name: 'Махи в наклоне на заднюю дельту' },
    ] as any;
    const picked = selectDiverseExercises(pool, 'shoulders', 3, new Set(), new Set(), 1, 1);
    expect(picked.length).toBe(3);
  });
  it('строгие группы плеч: жим/махи/задняя, кросс-своп запрещён', () => {
    expect(STRICT_EXERCISE_GROUPS.shoulders.length).toBe(3);
    expect(strictGroupForExercise({ id: 'ohp', name: 'Жим стоя' }, 'shoulders')?.key).toBe('shoulder_press');
    expect(strictGroupForExercise({ id: 'lateral_raise', name: 'Махи гантелей в стороны' }, 'shoulders')?.key).toBe('shoulder_lateral');
    expect(strictGroupForExercise({ id: 'rear_delt_fly', name: 'Махи в наклоне' }, 'shoulders')?.key).toBe('shoulder_rear');
    const members = strictGroupMembersOf({ id: 'lateral_raise', name: 'Махи гантелей в стороны' }, 'shoulders').map((c: any) => c.id);
    expect(members).not.toContain('ohp');
    expect(members).not.toContain('rear_delt_fly');
  });
  const chestPlan = () => ({
    weeks: [{ sessions: [{ exercises: [{ exerciseName: 'bench_bar', name: 'Жим штанги лёжа', muscle: 'chest', sets: 6, rir: 2 }] }] }],
  });
  it('аудит: грудь 6 сетов без пиковой → missingShortened (сечка)', () => {
    const a = auditPlanExercises(chestPlan() as any);
    expect(a).not.toBeNull();
    expect(a!.flags.some((f) => f === 'missingShortened:chest')).toBe(true);
  });
  it('аудит: с кроссовером пиковая есть → флага нет', () => {
    const plan = chestPlan() as any;
    plan.weeks[0].sessions[0].exercises.push({ exerciseName: 'crossover_cable', name: 'Кроссовер', muscle: 'chest', sets: 3, rir: 2 });
    const a = auditPlanExercises(plan);
    expect(a!.flags.some((f) => f === 'missingShortened:chest')).toBe(false);
  });
  it('симулятор: добавление пиковой закрывает сечку', () => {
    const d = simulateCorrection(chestPlan() as any, { type: 'add', targetId: 'crossover_cable', targetName: 'Кроссовер', reason: 'сечка' } as any, null);
    expect(d).not.toBeNull();
    expect(d!.issuesResolved).toContain('shortened');
  });
});
