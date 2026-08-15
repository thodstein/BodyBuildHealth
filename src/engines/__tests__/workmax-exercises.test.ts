/**
 * workmax-exercises.test.ts — рабочие максимумы по упражнениям.
 */
import { describe, it, expect } from 'vitest';
import {
  WORKMAX_CATEGORIES,
  exerciseToMuscle,
  exerciseNameOf,
  countFilledWorkMaxExercises,
  exerciseWorkMaxToMuscle,
  validateWorkMaxCategories,
} from '../workmax-exercises';

describe('WORKMAX_CATEGORIES — по 5-7 упражнений', () => {
  it('10 категорий = ключи мышц движков', () => {
    expect(WORKMAX_CATEGORIES.map((c) => c.id)).toEqual([
      'chest', 'back', 'quads', 'hamstrings', 'glutes',
      'shoulders', 'biceps', 'triceps', 'calves', 'abs',
    ]);
  });

  it('в каждой категории 5-7 упражнений, имена непустые, без дублей', () => {
    const seen = new Set<string>();
    for (const cat of WORKMAX_CATEGORIES) {
      expect(cat.exercises.length, `${cat.id}: ${cat.exercises.length} упражнений`).toBeGreaterThanOrEqual(5);
      expect(cat.exercises.length, `${cat.id}: ${cat.exercises.length} упражнений`).toBeLessThanOrEqual(7);
      for (const ex of cat.exercises) {
        expect(ex.name.trim().length, `${cat.id}:${ex.id} без имени`).toBeGreaterThan(0);
        expect(seen.has(ex.id), `дубль ${ex.id}`).toBe(false);
        seen.add(ex.id);
      }
    }
  });

  it('validateWorkMaxCategories: ok', () => {
    const res = validateWorkMaxCategories();
    expect(res.ok).toBe(true);
    expect(res.issues).toEqual([]);
  });
});

describe('exerciseToMuscle / exerciseNameOf', () => {
  it('упражнение → мышца (ключ workMax)', () => {
    expect(exerciseToMuscle('bench_bar')).toBe('chest');
    expect(exerciseToMuscle('deadlift')).toBe('back');
    expect(exerciseToMuscle('squat')).toBe('quads');
    expect(exerciseToMuscle('rdl')).toBe('hamstrings');
    expect(exerciseToMuscle('hip_thrust')).toBe('glutes');
    expect(exerciseToMuscle('ohp')).toBe('shoulders');
    expect(exerciseToMuscle('curl_bar')).toBe('biceps');
    expect(exerciseToMuscle('tricep_push')).toBe('triceps');
    expect(exerciseToMuscle('calf_raise')).toBe('calves');
    expect(exerciseToMuscle('plank')).toBe('abs');
    expect(exerciseToMuscle('unknown_id')).toBe('');
  });

  it('exerciseNameOf: имя из каталога, fallback на id', () => {
    expect(exerciseNameOf('bench_bar')).toBe('Жим штанги лёжа');
    expect(exerciseNameOf('nope')).toBe('nope');
  });
});

describe('exerciseWorkMaxToMuscle — конвертация в workMax групп', () => {
  it('берётся МАКСИМАЛЬНЫЙ вес среди упражнений мышцы', () => {
    const byExercise = {
      bench_bar: 100,
      bench_db: 90,
      incline_bar: 80,
    };
    const muscle = exerciseWorkMaxToMuscle(byExercise);
    expect(muscle.chest).toBe(100);
  });

  it('незаполненные мышцы сохраняют прежние значения (prev)', () => {
    const byExercise = { ohp: 70 };
    const muscle = exerciseWorkMaxToMuscle(byExercise, { chest: 100, back: 120, shoulders: 65 });
    expect(muscle.shoulders).toBe(70); // пересчитано из упражнения
    expect(muscle.chest).toBe(100); // сохранено из prev
    expect(muscle.back).toBe(120); // сохранено из prev
  });

  it('веса ≤0 и нечисловые игнорируются', () => {
    const muscle = exerciseWorkMaxToMuscle({ bench_bar: 0, bench_db: -5, incline_bar: NaN, fly_db: 40 } as any);
    expect(muscle.chest).toBe(40);
  });

  it('пустой ввод → пустой результат (без prev)', () => {
    expect(exerciseWorkMaxToMuscle({})).toEqual({});
    expect(exerciseWorkMaxToMuscle(undefined)).toEqual({});
  });
});

describe('countFilledWorkMaxExercises', () => {
  it('считает только заполненные', () => {
    expect(countFilledWorkMaxExercises({ bench_bar: 100, bench_db: 0, incline_db: undefined as any })).toBe(1);
    expect(countFilledWorkMaxExercises({})).toBe(0);
    expect(countFilledWorkMaxExercises(undefined)).toBe(0);
  });
});
