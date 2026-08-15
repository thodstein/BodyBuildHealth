/**
 * Тесты единого канона разминочной пирамиды (warmup-ramp.engine.ts).
 * Паритет с прежним bb-builder.buildWarmup (FIX-B5): гриф 20×15 → 50%×10 → 70%×5 → 80%×3 → 90%×1.
 */
import { describe, expect, it } from 'vitest';
import {
  WARMUP_RAMP_STEPS, BAR_WEIGHT, warmupRampFor, activeRampRows, warmupRampSummary,
} from '../warmup-ramp.engine';

describe('warmupRampFor (паритет с buildWarmup)', () => {
  it('изоляции и вес ≤ 0 → пустая рампа', () => {
    expect(warmupRampFor(100, false)).toEqual([]);
    expect(warmupRampFor(0)).toEqual([]);
    expect(warmupRampFor(-10)).toEqual([]);
    expect(warmupRampFor(NaN)).toEqual([]);
  });

  it('100 кг compound → 4 шага: гриф 20×15, 50×10, 70×5, 80×3', () => {
    expect(warmupRampFor(100)).toEqual([
      { load: 20, reps: 15 },
      { load: 50, reps: 10 },
      { load: 70, reps: 5 },
      { load: 80, reps: 3 },
    ]);
  });

  it('150 кг → 5 шагов: + 90%×1 (135кг)', () => {
    expect(warmupRampFor(150)).toEqual([
      { load: 20, reps: 15 },
      { load: 75, reps: 10 },
      { load: 105, reps: 5 },
      { load: 120, reps: 3 },
      { load: 135, reps: 1 },
    ]);
  });

  it('40 кг → 2 шага (без грифа и без 80%): 50%×10, 70%×5', () => {
    expect(warmupRampFor(40)).toEqual([
      { load: 20, reps: 10 },
      { load: 28, reps: 5 },
    ]);
  });

  it('вес ровно на пороге: 60 кг → без 80%; 61 кг → с 80%', () => {
    const at60 = warmupRampFor(60);
    expect(at60.some(s => s.load === 48 && s.reps === 3)).toBe(false);
    const at61 = warmupRampFor(61);
    expect(at61.some(s => s.load === 49 && s.reps === 3)).toBe(true);
  });
});

describe('activeRampRows / summary', () => {
  it('activeRampRows содержит pct и флаг bar', () => {
    const rows = activeRampRows(100);
    expect(rows[0]).toMatchObject({ bar: true, load: BAR_WEIGHT, reps: 15 });
    expect(rows[1]).toMatchObject({ pct: 0.5, reps: 10 });
    expect(rows[rows.length - 1]).toMatchObject({ pct: 0.8, reps: 3 });
  });

  it('activeRampRows невалидного веса → []', () => {
    expect(activeRampRows(0)).toEqual([]);
    expect(activeRampRows(NaN)).toEqual([]);
  });

  it('warmupRampSummary — строка «→» для отображения; пустая для невалидного веса', () => {
    const s = warmupRampSummary(100);
    expect(s).toContain('гриф 20кг×15');
    expect(s).toContain('50% (50кг)×10');
    expect(s).toContain('→');
    expect(warmupRampSummary(0)).toBe('');
    expect(warmupRampSummary(NaN)).toBe('');
  });

  it('канон WARMUP_RAMP_STEPS: 5 шагов с монотонным ростом reps-условий', () => {
    expect(WARMUP_RAMP_STEPS.length).toBe(5);
    expect(WARMUP_RAMP_STEPS[0].bar).toBe(true);
    expect(WARMUP_RAMP_STEPS.every(s => s.reps > 0 && s.pct >= 0 && s.pct <= 1)).toBe(true);
  });
});
