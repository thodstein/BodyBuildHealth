/**
 * combat-mesocycle-guard.test.ts — мезоцикл не затирает осознанное снижение:
 * явный вес ниже прошлого сохраняется, остальное прогрессирует как раньше.
 */
import { describe, it, expect } from 'vitest';
import { applyCombatMesocycle } from '../combat-mesocycle';

const prev = {
  id: 'p1', discipline: 'mma', weeks: 4, patternId: 'combat_3',
  inputSnapshot: {
    workMaxByExercise: { bench_bar: 80, wrist_roller: 10 },
    workMax: { bench: 80, chest: 80 },
  },
} as any;

describe('combat mesocycle explicit guard', () => {
  it('унаследованные значения прогрессируют', () => {
    const next = applyCombatMesocycle(prev, {} as any);
    expect((next as any).workMaxByExercise.bench_bar).toBe(82.5);
    expect((next as any).workMaxByExercise.wrist_roller).toBe(11);
    expect((next as any).workMax.bench).toBe(81);
  });

  it('явное снижение не затирается бампом', () => {
    const next = applyCombatMesocycle(prev, {
      workMaxByExercise: { bench_bar: 70 },
      workMax: { bench: 70 },
    } as any);
    expect((next as any).workMaxByExercise.bench_bar).toBe(70);
    expect((next as any).workMax.bench).toBe(70);
    // нетронутые ключи при этом прогрессируют
    expect((next as any).workMaxByExercise.wrist_roller).toBe(11);
  });

  it('явное повышение прогрессирует дальше (семантика бампа)', () => {
    const next = applyCombatMesocycle(prev, {
      workMaxByExercise: { bench_bar: 90 },
    } as any);
    expect((next as any).workMaxByExercise.bench_bar).toBe(92.5);
  });

  it('без prev — вход как есть', () => {
    const inp = { workMax: { bench: 80 } } as any;
    expect(applyCombatMesocycle(null, inp)).toEqual(inp);
  });
});
