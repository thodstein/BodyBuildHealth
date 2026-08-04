import { describe, expect, it } from 'vitest';
import { EXERCISE_ALIAS_MAP, resolveCatalogId } from '../../../data/lms-cycles/exercise-alias-map';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

describe('PL-auto catalog aliases', () => {
  it('resolves canonical LMS main lifts to catalog IDs', () => {
    expect(resolveCatalogId('Присед')).toBe('squat');
    expect(resolveCatalogId('Жим лежа')).toBe('bench_bar');
    expect(resolveCatalogId('Становая тяга')).toBe('deadlift');
  });

  it('is case-insensitive and handles ё/е normalization', () => {
    expect(resolveCatalogId('ЖИМ ЛЕЖА')).toBe('bench_bar');
    expect(Object.keys(EXERCISE_ALIAS_MAP).length).toBeGreaterThan(20);
  });

  it('points aliases only to existing catalog entries', () => {
    const ids = new Set(EXERCISE_CATALOG.map(exercise => exercise.id));
    const missing = [...new Set(Object.values(EXERCISE_ALIAS_MAP).filter(id => !ids.has(id)))];
    expect(missing).toEqual([]);
  });
});
