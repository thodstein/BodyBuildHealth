import { describe, expect, it } from 'vitest';
import { buildExerciseInstructions, formatExerciseInstructions } from '../bb-exercise-instructions.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

describe('BB exercise instructions from Exercise Lab', () => {
  it('builds a professional profile for a catalog exercise', () => {
    const profile = buildExerciseInstructions({
      exerciseId: 'pull_down_wide',
      exerciseName: 'Тяга верхнего блока широким хватом',
      muscle: 'back',
      role: 'primary',
      trainingFocus: 'hypertrophy',
      orderIndex: 0,
      restSeconds: 120,
    });

    expect(profile.source).toBe('exercise-lab');
    expect(profile.cues.length).toBeGreaterThan(0);
    expect(profile.order).toContain('первое');
    expect(profile.restSeconds).toBe(120);
  });

  it('formats pattern, cues, tempo and progression', () => {
    const text = formatExerciseInstructions({
      exerciseId: 'pull_down_wide',
      exerciseName: 'Тяга верхнего блока широким хватом',
      muscle: 'back',
      role: 'primary',
      trainingFocus: 'hypertrophy',
      tempo: '2-1-1-1',
      restSeconds: 120,
    });

    expect(text).toContain('Паттерн:');
    expect(text).toContain('Техника:');
    expect(text).toContain('Темп: 2-1-1-1');
    expect(text).toContain('Прогрессия:');
  });

  it('uses target-muscle MMC/stretch/peak data when available', () => {
    const profile = buildExerciseInstructions({
      exerciseId: 'incline_bench',
      exerciseName: 'Жим гантелей на наклонной скамье',
      muscle: 'chest',
      role: 'accessory',
      trainingFocus: 'hypertrophy',
    });

    expect(profile.cues.length).toBeGreaterThan(0);
    expect(profile.stretch || profile.peak || profile.mmc).toBeTruthy();
  });

  it('changes default tempo by training focus', () => {
    const strength = buildExerciseInstructions({ exerciseName: 'Неизвестное упражнение', trainingFocus: 'strength' });
    const endurance = buildExerciseInstructions({ exerciseName: 'Неизвестное упражнение', trainingFocus: 'endurance' });
    expect(strength.tempo).not.toBe(endurance.tempo);
  });

  it('adds intensity technique and accessory order', () => {
    const text = formatExerciseInstructions({
      exerciseName: 'Разгибание рук на блоке',
      muscle: 'triceps',
      role: 'accessory',
      intensityTechnique: 'dropset',
    });
    expect(text).toContain('добивочное');
    expect(text).toContain('dropset');
  });

  it('injects professional instructions into generated BB plan comments', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 8,
      workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
      equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
      volumeGoal: 'mav',
    });
    const comments = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .map(e => e.comment || '');
    expect(comments.some(c => c.includes('Паттерн:'))).toBe(true);
    expect(comments.some(c => c.includes('Техника:'))).toBe(true);
    expect(comments.some(c => c.includes('Порядок:'))).toBe(true);
    expect(comments.some(c => c.includes('Прогрессия:'))).toBe(true);
    const exercise = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).find((e: any) => !e.warmupActivator)!;
    expect(exercise.executionProfile?.pattern).toBeTruthy();
    expect(exercise.executionProfile?.order).toBeTruthy();
    expect(exercise.executionProfile?.progression).toBeTruthy();
    expect(exercise.executionProfile?.order).toContain('упражнение');
  });

  it('provides non-empty execution guidance for every catalog exercise', () => {
    const failures = EXERCISE_CATALOG
      .map(ex => ({ ex, profile: buildExerciseInstructions({ exerciseId: ex.id, exerciseName: ex.name, muscle: ex.group }) }))
      .filter(({ profile }) => !profile.pattern || !profile.order || !profile.tempo || !profile.progression);

    expect(failures.map(({ ex }) => ex.id)).toEqual([]);
  });

  it('catalog fallback includes the exercise-specific technique field', () => {
    const catalogExercise = EXERCISE_CATALOG.find(ex => ex.id === 'bench_closegrip');
    expect(catalogExercise).toBeDefined();
    const text = formatExerciseInstructions({
      exerciseId: catalogExercise!.id,
      exerciseName: catalogExercise!.name,
      muscle: catalogExercise!.group,
    });
    expect(text).toContain(catalogExercise!.technique);
  });
});
