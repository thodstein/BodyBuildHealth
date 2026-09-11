import { describe, expect, it } from 'vitest';
import { analyzeMuscleVolumePro } from '../volume-optimizer-pro.engine';
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
