/**
 * lab-exercise-profile.test.ts — Epic A (+B-хелпер): профиль из данных, честный coverage, честный вес.
 */
import { describe, it, expect } from 'vitest';
import {
  getLabResistanceProfile,
  subregionsCoveredBy,
  groupSubregionCoverage,
  resolveLabWorkingWeight,
} from '../lab-exercise-profile.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

describe('lab-exercise-profile', () => {
  it('lengthened из данных: fly_cable → lengthened/data, sfr 5', () => {
    const p = getLabResistanceProfile({ id: 'fly_cable' });
    expect(p.profile).toBe('lengthened');
    expect(p.source).toBe('data');
    expect(p.sfr).toBe(5);
  });

  it('fallback честно estimated для неизвестного id', () => {
    const p = getLabResistanceProfile({ id: 'unknown_xyz_123', name: 'Неизвестное упражнение' });
    expect(p.source).toBe('estimated');
    expect(p.sfr).toBeNull();
  });

  it('stretchPhase каталога вне SFR_DB → lengthened/data (dips_chest)', () => {
    const p = getLabResistanceProfile({ id: 'dips_chest' });
    expect(p.profile).toBe('lengthened');
    expect(p.source).toBe('data');
  });

  it('unilateral из данных: bulgarian_split_squat одностороннее', () => {
    expect(getLabResistanceProfile({ id: 'bulgarian_split_squat' }).unilateral).toBe(true);
    expect(getLabResistanceProfile({ id: 'bench_bar' }).unilateral).toBe(false);
  });

  it('подрегион одного упражнения: incline_db закрывает chest_upper', () => {
    const covered = subregionsCoveredBy({ id: 'incline_db' }, 'chest');
    expect(covered).toContain('chest_upper');
  });

  it('покрытие группы chest всеми упражнениями каталога: covered ≥ 3/6 (ловит мёртвый матчинг 1.3)', () => {
    const chest = EXERCISE_CATALOG.filter((e) => e.group === 'chest').map((e) => ({
      id: e.id,
      name: e.name,
    }));
    expect(chest.length).toBeGreaterThan(5);
    const cov = groupSubregionCoverage('chest', chest);
    expect(cov.total).toBe(6);
    // Мутация: матчинг только по targetMuscle («Грудь») даёт covered ≈ 0 — тест падает.
    expect(cov.covered.length).toBeGreaterThanOrEqual(3);
  });

  it('неизвестная группа → пустое покрытие без throw', () => {
    expect(groupSubregionCoverage('nope', [{ id: 'x' }])).toEqual({
      covered: [],
      uncovered: [],
      total: 0,
    });
  });

  it('вес: baseline приоритетнее workMax', () => {
    expect(
      resolveLabWorkingWeight({ bench_bar: 100 }, { chest: 80 }, { id: 'bench_bar', group: 'chest' }),
    ).toEqual({ weight: 100, source: 'baseline' });
  });

  it('вес: workMax fallback при пустом baseline', () => {
    expect(resolveLabWorkingWeight({}, { chest: 80 }, { id: 'bench_bar', group: 'chest' })).toEqual({
      weight: 80,
      source: 'workmax',
    });
  });

  it('вес: null без базы (мока нет — регрессия fakeRM)', () => {
    expect(resolveLabWorkingWeight({}, {}, { id: 'bench_bar', group: 'chest' })).toEqual({
      weight: null,
      source: null,
    });
    expect(resolveLabWorkingWeight(null, null, { id: 'bench_bar', group: 'chest' })).toEqual({
      weight: null,
      source: null,
    });
  });
});
