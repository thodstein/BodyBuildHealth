import { describe, it, expect } from 'vitest';
import { buildHybridPlan } from '../hybrid-plan.engine';
import { TAG_MUSCLES, ROTATION_PAIRS, getPair, resolveCharacter, FORCE_HEAVY_GROUPS } from '../bb-day-types';
import { ANGLE_CLASSES } from '../bb-exercise-selection.engine';
import { perExerciseCap } from '../bb-volume.engine';
import { buildBBPlan } from '../bb-builder.engine';

describe('hybrid-plan', () => {
  it('buildHybridPlan: cycle + accessories без падения', () => {
    const plan = buildHybridPlan({ cycleId: 'cycle-01', pmMap: { squat: 150, bench: 100, dead: 180 }, weeks: 4, level: 'intermediate', workMax: { chest: 100, back: 120 } });
    expect(plan).not.toBeNull();
    expect(plan!.heavyWeeks.length).toBeGreaterThan(0);
    expect(plan!.daysByWeek.length).toBeGreaterThan(0);
    // accessories должны быть памп и не дублировать тяж
    for (const week of plan!.daysByWeek) {
      for (const day of week) {
        for (const acc of day.accessories) {
          expect(acc.role).toBe('accessory');
          expect(acc.character).toBe('памп');
          expect(acc.sets).toBeGreaterThanOrEqual(2);
          expect(acc.sets).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('hybrid: несуществующий cycle возвращает null', () => {
    const plan = buildHybridPlan({ cycleId: 'no_such_cycle_999', pmMap: {} });
    expect(plan).toBeNull();
  });
});

describe('bb-day-types', () => {
  it('TAG_MUSCLES покрывает все основные теги', () => {
    const required = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'FullBody', 'Chest', 'Back', 'Arms'];
    for (const tag of required) {
      expect(TAG_MUSCLES[tag], tag).toBeDefined();
      expect(TAG_MUSCLES[tag].length).toBeGreaterThan(0);
    }
  });

  it('ROTATION_PAIRS симметричны и getPair работает', () => {
    for (const [a, b] of ROTATION_PAIRS) {
      const pa = getPair(a);
      expect(pa, `getPair(${a})`).not.toBeNull();
      expect(pa!.includes(a)).toBe(true);
      const pb = getPair(b);
      expect(pb, `getPair(${b})`).not.toBeNull();
      expect(pb!.includes(b)).toBe(true);
    }
    expect(getPair('nonexistent_muscle_xyz')).toBeNull();
  });

  it('FORCE_HEAVY_GROUPS: forearms/traps всегда тяж', () => {
    expect(resolveCharacter('forearms', 'памп')).toBe('тяж');
    expect(resolveCharacter('traps', 'памп')).toBe('тяж');
    expect(resolveCharacter('chest', 'памп')).toBe('памп');
    expect(resolveCharacter('quads', 'памп')).toBe('памп'); // ноги теперь могут быть памп
  });

  it('ANGLE_CLASSES: каждая мышца имеет хотя бы 2 угла', () => {
    for (const [muscle, classes] of Object.entries(ANGLE_CLASSES)) {
      expect(classes.length, muscle).toBeGreaterThanOrEqual(2);
      for (const ac of classes) {
        expect(typeof ac.name).toBe('string');
        expect(typeof ac.match).toBe('function');
      }
    }
  });
});

describe('perExerciseCap', () => {
  it('стандарт 5, enhanced back/chest/quads 8 при 3+ годах', () => {
    expect(perExerciseCap('intermediate', 'chest')).toBe(5);
    expect(perExerciseCap('enhanced', 'chest', 1)).toBe(5);
    expect(perExerciseCap('enhanced', 'chest', 3)).toBe(8);
    expect(perExerciseCap('enhanced', 'biceps', 6)).toBe(5);
    expect(perExerciseCap('enhanced', 'back', 6)).toBe(8);
  });
});

describe('per-session explain', () => {
  it('enrichExerciseRationale добавляет угол и superSet info', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      weeks: 2,
      goal: 'mass' as any,
      supersetMode: 'antagonist' as any,
      workMax: { chest: 100, back: 120, legs: 150 },
    } as any);
    // Проверяем, что rationale содержит угол или superset после finalize
    const hasAngle = plan.weeks.some(w => w.sessions.some(s => s.exercises.some(e => (e.rationale || '').includes('угол:'))));
    expect(hasAngle).toBe(true);
  });
});
