import { describe, expect, it } from 'vitest';
import {
  analyzeMuscleVolumePro,
  computeCNSFatigue,
  scaleWeekRowsToTarget,
} from '../volume-optimizer-pro.engine';
import type { ProExerciseRow } from '../volume-optimizer-pro.engine';

function rows(sets: number, day: number, extra?: Partial<ProExerciseRow>): ProExerciseRow[] {
  return [{ id: 'r1', exerciseId: 'bench_bar', week: 1, day, weight: 80, reps: 8, sets, rpe: 8, ...extra }];
}

describe('volume P2: частота v2 в per-muscle анализе', () => {
  it('bro-сплит в MAV в 1 сессию — info, не warning', () => {
    const a = analyzeMuscleVolumePro(rows(12, 1), 'intermediate', 'chest')!;
    expect(a.freqKind).toBe('info');
  });
  it('объём > MAV в 1 сессию — warning с разбивкой', () => {
    const a = analyzeMuscleVolumePro(rows(18, 1), 'intermediate', 'chest')!;
    expect(a.freqKind).toBe('warning');
    expect(a.freqVerdict).toContain('разбейте');
    expect(a.actionableTips.some(t => t.includes('разбейте'))).toBe(true);
  });
  it('объём > MRV — critical независимо от частоты', () => {
    const a = analyzeMuscleVolumePro(
      [...rows(12, 1), ...rows(12, 3).map(r => ({ ...r, id: 'r2' }))],
      'intermediate', 'chest',
    )!;
    expect(a.currentSets).toBe(24);
    expect(a.freqKind).toBe('critical');
  });
  it('лёгкие сеты (RPE<7) — hard меньше total + подсказка', () => {
    const a = analyzeMuscleVolumePro(rows(8, 1, { rpe: 5 }), 'intermediate', 'chest')!;
    expect(a.hardSets).toBe(0);
    expect(a.actionableTips.some(t => t.includes('hard-сетов'))).toBe(true);
  });
  it('hard-сеты считаются: RPE 8 — все hard', () => {
    const a = analyzeMuscleVolumePro(rows(8, 1, { rpe: 8 }), 'intermediate', 'chest')!;
    expect(a.hardSets).toBe(8);
  });
});

describe('volume И2: CNS-кап по уровню', () => {
  const heavy = (n: number): ProExerciseRow[] =>
    Array.from({ length: n }, (_, i) => ({ id: 'h' + i, exerciseId: 'squat', week: 1, day: 1, weight: 100, reps: 5, sets: 2, rpe: 9, oneRM: 110 }));
  it('один и тот же скор: новичок в warning, средний в норме', () => {
    const entries = heavy(5); // 10 тяж. компаунд-сетов = 50 баллов
    const beg = computeCNSFatigue(entries, 'beginner');
    const mid = computeCNSFatigue(entries, 'intermediate');
    expect(beg.maxRecommended).toBe(40);
    expect(mid.maxRecommended).toBe(80);
    expect(beg.warning).not.toBeNull();
    expect(mid.warning).toBeNull();
  });
  it('без уровня — legacy-кап 80 (обратная совместимость)', () => {
    expect(computeCNSFatigue(heavy(5)).maxRecommended).toBe(80);
  });
});

describe('volume И2: честное масштабирование недель', () => {
  it('per-muscle target/wk1: грудь 4→8 при цели 8, спина untouched', () => {
    const wk1: ProExerciseRow[] = [
      { id: 'a', exerciseId: 'bench_bar', week: 1, day: 1, weight: 80, reps: 8, sets: 4, rpe: 8 },
      { id: 'b', exerciseId: 'row_bar', week: 1, day: 2, weight: 60, reps: 8, sets: 3, rpe: 7 },
    ];
    const out = scaleWeekRowsToTarget(wk1, { 'Грудь': 8, 'Спина': 3 });
    expect(out.find(r => r.id === 'a')!.sets).toBe(8);
    expect(out.find(r => r.id === 'b')!.sets).toBe(3);
  });
  it('флор 1 сет; неизвестная мышца — как есть', () => {
    const wk1: ProExerciseRow[] = [
      { id: 'a', exerciseId: 'bench_bar', week: 1, day: 1, weight: 80, reps: 8, sets: 0, rpe: 8 },
    ];
    const out = scaleWeekRowsToTarget(wk1, { 'Грудь': 0 });
    expect(out[0].sets).toBe(1);
  });
});
