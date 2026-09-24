import { describe, expect, it } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';
import { mobilityBlockReason } from '../arm-injury-guard.engine';

const base = {
  discipline: 'armwrestling' as const,
  patternId: 'arm_3_full',
  level: 'intermediate',
  goal: 'strength' as const,
  technique: 'balanced' as const,
  weeks: 2,
};

describe('arm PRO-6 P0 safety boundary', () => {
  it('не возвращает чужое упражнение вместо запрещённого', () => {
    const plan = buildArmPlan({ ...base, mobilityRestrictions: ['wrist'] });
    for (const week of plan.weeks) {
      for (const session of week.sessions) {
        for (const exercise of session.exercises) {
          expect(mobilityBlockReason(exercise, ['wrist'])).toBeNull();
        }
      }
    }
  });

  it('исключение травмы не возвращает упражнение этой мышцы', () => {
    const plan = buildArmPlan({ ...base, injuries: [{ muscle: 'pronators', exclude: true }] });
    const exercises = plan.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises));
    expect(exercises.some((exercise) => exercise.muscle === 'pronators')).toBe(false);
    expect(plan.safetyWarnings?.some((line) => line.includes('pronators') && line.includes('исключено'))).toBe(true);
  });

  it('ограничения травмы уменьшают объём, вес и повторы', () => {
    const normal = buildArmPlan(base);
    const limited = buildArmPlan({
      ...base,
      injuries: [{ muscle: 'pronators', volumePct: 50, weightPct: 80, repsCap: 6 }],
    });
    const normalPron = normal.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises.filter((exercise) => exercise.muscle === 'pronators')));
    const limitedPron = limited.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises.filter((exercise) => exercise.muscle === 'pronators')));
    expect(limitedPron.length).toBeGreaterThan(0);
    expect(limitedPron.reduce((sum, exercise) => sum + exercise.sets, 0)).toBeLessThan(normalPron.reduce((sum, exercise) => sum + exercise.sets, 0));
    for (const exercise of limitedPron) {
      expect(exercise.repsRange[1]).toBeLessThanOrEqual(6);
      expect(exercise.workSets.every((set) => set.weight <= 30)).toBe(true);
    }
  });

  it('финализатор снимает synthetic-упражнения, запрещённые мобильностью', () => {
    const plan = finalizeArmPlan(buildArmPlan({
      ...base,
      focusGroup: 'grip_support',
      specialization: true,
      mobilityRestrictions: ['wrist'],
    }));
    const exercises = plan.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises));
    expect(exercises.some((exercise) => exercise.muscle === 'grip_support')).toBe(false);
  });

  it('валидатор помечает unsafe-упражнение как blocked', () => {
    const plan: any = buildArmPlan(base);
    plan.inputSnapshot = { ...(plan.inputSnapshot || {}), injuries: [{ muscle: 'pronators', exclude: true }] };
    plan.weeks[0].sessions[0].exercises.push({
      muscle: 'pronators', name: 'Unsafe pronation', role: 'accessory', character: 'памп', sets: 2, repsRange: [8, 10], rir: 2,
      workSets: [{ reps: 8, rir: 2, weight: 10 }], exerciseId: 'pronation_cable', substitutionGroup: 'pronation',
    });
    const validation = validateArmPlan(plan, plan.level);
    expect(validation.blocked?.some((line) => line.includes('закрыто травмой'))).toBe(true);
  });

  it('неизвестный PED не получает MRV boost', () => {
    const natural = buildArmPlan(base);
    const unknown = buildArmPlan({ ...base, pedDoses: { mystery_xyz: 100 }, courseIntensity: 'moderate' });
    expect(unknown.mrvByMuscle.wrist_flexors).toBe(natural.mrvByMuscle.wrist_flexors);
    expect(unknown.rationale.some((line) => line.includes('mystery_xyz'))).toBe(true);
    expect(unknown.rationale.some((line) => line.includes('неизвестный PED'))).toBe(true);
  });

  it('без workMax вес остаётся невыдуманным нулём', () => {
    const plan = buildArmPlan(base);
    const exercises = plan.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises));
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((exercise) => exercise.workSets.every((set) => set.weight === 0))).toBe(true);
    expect(exercises.every((exercise) => (exercise.comment || '').includes('вес ориентир'))).toBe(true);
  });

  it('ограничение equipment не подменяет упражнение другой группы', () => {
    const plan = buildArmPlan({
      ...base,
      discipline: 'armlifting',
      patternId: 'grip_3_support',
      focusGroup: 'grip_crush',
      specialization: true,
      equipment: ['barbell'],
    });
    const exercises = plan.weeks.flatMap((week) => week.sessions.flatMap((session) => session.exercises));
    expect(exercises.some((exercise) => exercise.muscle === 'grip_crush')).toBe(false);
    expect(plan.rationale.some((line) => line.includes('grip_crush') && line.includes('нет безопасного упражнения'))).toBe(true);
    const validation = validateArmPlan(plan, plan.level);
    expect(validation.warnings.some((line) => line.includes('grip_crush') && line.includes('нет безопасного упражнения'))).toBe(true);
    expect(validation.status).toBe('warning');
  });
});
