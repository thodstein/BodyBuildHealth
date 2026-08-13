import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { annotateArmExercise, armQualityIssues, classifyArmExercise } from '../bb-back-quality.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('Arm head coverage (Этап 2/4)', () => {
  it('classifyArmExercise распознаёт головки', () => {
    expect(classifyArmExercise('Сгибания на наклонной скамье').pattern).toBe('biceps_lengthened');
    expect(classifyArmExercise('Сгибания Зоттмана').pattern).toBe('forearm');
    expect(classifyArmExercise('Подъём штанги на бицепс стоя').pattern).toBe('biceps_shortened');
    expect(classifyArmExercise('Французский жим лёжа').pattern).toBe('triceps_overhead');
    expect(classifyArmExercise('Разгибания на трицепс в верхнем блоке').pattern).toBe('triceps_pushdown');
    expect(classifyArmExercise('Жим узким хватом').pattern).toBe('triceps_compound');
    expect(classifyArmExercise('Молотки с гантелями').pattern).toBe('biceps_hammer');
  });

  it('annotateArmExercise проставляет паттерн только для рук', () => {
    const b = annotateArmExercise({ muscle: 'biceps', name: 'Французский жим', role: 'accessory', character: 'памп', sets: 3, repsRange: [10, 15], rir: 2, workSets: [] } as any);
    expect(b.movementPattern).toBe('triceps_overhead');
    const c = annotateArmExercise({ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 4, repsRange: [6, 8], rir: 2, workSets: [] } as any);
    expect(c.movementPattern).toBeUndefined();
  });

  it('enhanced-план покрывает длинные головки рук (замена изоляций)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const biceps = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => e.muscle === 'biceps' && !(e as any).warmupActivator));
    const triceps = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises.filter(e => e.muscle === 'triceps' && !(e as any).warmupActivator));
    expect(biceps.length).toBeGreaterThan(0);
    expect(triceps.length).toBeGreaterThan(0);
    expect(biceps.some(e => classifyArmExercise(e.name).pattern === 'biceps_lengthened')).toBe(true);
    expect(triceps.some(e => classifyArmExercise(e.name).pattern === 'triceps_overhead')).toBe(true);
    expect(armQualityIssues(plan.weeks)).toHaveLength(0);
  });

  it('rationale содержит сводку «Руки по паттернам»', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const line = plan.rationale.find(r => r.includes('Руки по паттернам'));
    expect(line).toBeDefined();
    expect(line!).toContain('biceps_lengthened');
  });

  it('armQualityIssues флагает сессию с бицепсом без растянутой позиции', () => {
    const mkEx = (name: string, muscle: string) => ({ muscle, name, role: 'accessory' as const, character: 'памп' as const, sets: 3, repsRange: [10, 15] as [number, number], rir: 2, workSets: [] });
    const week = { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'памп' as const, sessionTag: 'Pull', exercises: [mkEx('Подъём штанги на бицепс стоя', 'biceps')] }] };
    const issues = armQualityIssues([week] as any);
    expect(issues.some(i => i.includes('бицепс без растянутой позиции'))).toBe(true);
  });
});
