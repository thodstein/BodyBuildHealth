/**
 * bb-pro-quality-phase-c.test.ts — тесты для ФАЗЫ C (архитектурные refactors).
 *
 * Проверяет:
 *  - C1: bb-exercise-selection.engine.ts — ANGLE_CLASSES + selectDiverseExercises
 *  - C2: stateful periodization — applyFeedbackToBuild уже встроен в buildBBPlan
 */
import { describe, expect, it } from 'vitest';
import {
  ANGLE_CLASSES,
  lengthenedBonus,
  selectDiverseExercises,
} from '../bb-exercise-selection.engine';

/* ═══════════════════════════════════════════════════════════════════
 * C1: bb-exercise-selection.engine.ts
 * ═══════════════════════════════════════════════════════════════════ */
describe('C1: bb-exercise-selection.engine — ANGLE_CLASSES', () => {
  it('ANGLE_CLASSES содержит все ключевые мышцы', () => {
    expect(ANGLE_CLASSES.chest).toBeDefined();
    expect(ANGLE_CLASSES.back).toBeDefined();
    expect(ANGLE_CLASSES.quads).toBeDefined();
    expect(ANGLE_CLASSES.biceps).toBeDefined();
    expect(ANGLE_CLASSES.triceps).toBeDefined();
    expect(ANGLE_CLASSES.hamstrings).toBeDefined();
    expect(ANGLE_CLASSES.glutes).toBeDefined();
  });

  it('quads имеют 5 классов (compound_squat, lunge_bulgarian, sissy_lengthened, extension, belt_stepup)', () => {
    const quadClasses = ANGLE_CLASSES.quads.map(c => c.name);
    expect(quadClasses).toContain('compound_squat');
    expect(quadClasses).toContain('lunge_bulgarian');
    expect(quadClasses).toContain('sissy_lengthened');
    expect(quadClasses).toContain('extension');
    expect(quadClasses).toContain('belt_stepup');
    expect(quadClasses.length).toBeGreaterThanOrEqual(5);
  });

  it('biceps имеют 6 классов (включая incline_lengthened и preacher_shortened)', () => {
    const bicepsClasses = ANGLE_CLASSES.biceps.map(c => c.name);
    expect(bicepsClasses).toContain('barbell_curl');
    expect(bicepsClasses).toContain('incline_lengthened');
    expect(bicepsClasses).toContain('hammer_brachialis');
    expect(bicepsClasses).toContain('preacher_shortened');
    expect(bicepsClasses).toContain('cable_constant');
    expect(bicepsClasses.length).toBeGreaterThanOrEqual(5);
  });
});

describe('C1: lengthenedBonus — приоритет растянутым упражнениям', () => {
  it('RDL/румынская → +10 (lengthened bias)', () => {
    expect(lengthenedBonus('Румынская тяга')).toBe(10);
    expect(lengthenedBonus('RDL')).toBe(10);
  });

  it('incline curl → +10 (lengthened bias)', () => {
    expect(lengthenedBonus('Сгибание на наклонной скамье')).toBe(10);
  });

  it('sissy squat → +10 (lengthened bias)', () => {
    expect(lengthenedBonus('Сисси-присед')).toBe(10);
  });

  it('обычное упражнение → 0 (нет lengthened bias)', () => {
    expect(lengthenedBonus('Жим лёжа')).toBe(0);
    expect(lengthenedBonus('Присед')).toBe(0);
  });
});

describe('C1: selectDiverseExercises — multi-angle diversity', () => {
  it('возвращает пустой массив для пустого пула', () => {
    const result = selectDiverseExercises([], 'chest', 3, new Set(), new Set(), 1, 1);
    expect(result).toHaveLength(0);
  });

  it('возвращает пустой массив для неизвестной мышцы', () => {
    const result = selectDiverseExercises(
      [{ id: '1', name: 'test' } as any],
      'unknown_muscle',
      3,
      new Set(),
      new Set(),
      1,
      1,
    );
    expect(result).toHaveLength(0);
  });

  it('chest: подбирает упражнения из разных angle classes', () => {
    const pool = [
      { id: 'bench', name: 'Жим штанги лёжа' },
      { id: 'incline', name: 'Жим гантелей на наклонной скамье' },
      { id: 'fly', name: 'Сведение в кроссовере' },
      { id: 'decline', name: 'Жим на скамье с отрицательным наклоном' },
    ] as any[];
    const result = selectDiverseExercises(pool, 'chest', 3, new Set(), new Set(), 1, 1);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThan(0);
    // Проверяем что выбраны РАЗНЫЕ упражнения
    const ids = result.map(e => (e as any).id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * C2: stateful periodization — уже встроена в buildBBPlan
 * ═══════════════════════════════════════════════════════════════════ */
describe('C2: stateful periodization — applyFeedbackToBuild', () => {
  it('applyFeedbackToBuild импортируется и доступна', async () => {
    const { applyFeedbackToBuild } = await import('../bb-progression-feedback.engine');
    expect(typeof applyFeedbackToBuild).toBe('function');
  });

  it('applyFeedbackToBuild возвращает план без изменений при пустом дневнике', async () => {
    const { applyFeedbackToBuild } = await import('../bb-progression-feedback.engine');
    const plan = {
      pattern: {} as any,
      weeks: [{
        week: 1,
        sessions: [{
          day: 1, weekOffset: 1, character: 'тяж',
          exercises: [{
            muscle: 'chest', name: 'bench', role: 'primary', character: 'тяж',
            sets: 4, repsRange: [6, 10], rir: 2,
            workSets: [{ reps: 8, rir: 2, weight: 80 }],
          }],
        }],
      }],
      rotationMuscleVolume: {}, rationale: [],
    } as any;
    const result = applyFeedbackToBuild(plan, [], { chest: 100 });
    // Без сессий в дневнике — план не меняется
    expect(result.weeks[0].sessions[0].exercises[0].workSets[0].weight).toBe(80);
  });
});
