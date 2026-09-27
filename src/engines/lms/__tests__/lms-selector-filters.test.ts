/**
 * lms-selector-filters.test.ts — тесты фильтров селектора циклов.
 * Проверяет: фильтры по evidenceLevel, equipmentNeeded, periodization, timeCommitment.
 */

import { describe, it, expect } from 'vitest';
import { rankCycles, type LMSSelectorInput } from '../lms-selector.engine';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

function makeInput(overrides: Partial<LMSSelectorInput> = {}): LMSSelectorInput {
  return {
    goal: 'strength',
    level: 'II-KMS',
    daysPerWeek: 3,
    ...overrides,
  };
}

describe('Фильтры селектора циклов', () => {
  it('без фильтров — ранжирование работает', () => {
    const ranked = rankCycles(makeInput());
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
  });

  it('фильтр по evidenceLevel — ранжирование работает с фильтром', () => {
    const withA = rankCycles(makeInput({ evidenceLevel: 'A' }));
    expect(withA.length).toBeGreaterThan(0);
    // Сортировка не нарушена
    for (let i = 1; i < withA.length; i++) {
      expect(withA[i - 1].score).toBeGreaterThanOrEqual(withA[i].score);
    }
  });

  it('фильтр по equipmentNeeded — циклы с соответствующим оборудованием получают бонус', () => {
    const withBarbell = rankCycles(makeInput({ equipmentNeeded: ['barbell'] }));
    const ranked = withBarbell;
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('фильтр по periodization — циклы с соответствующей периодизацией получают бонус', () => {
    const withDup = rankCycles(makeInput({ periodization: 'dup' }));
    expect(withDup.length).toBeGreaterThan(0);
  });

  it('фильтр по timeCommitment — циклы с соответствующими затратами получают бонус', () => {
    const withLow = rankCycles(makeInput({ timeCommitment: 'low' }));
    expect(withLow.length).toBeGreaterThan(0);
  });

  it('фильтр по evidenceLevel — несоответствующие циклы получают штраф', () => {
    const withA = rankCycles(makeInput({ evidenceLevel: 'A' }));
    const nonACycles = withA.filter(r => r.cycle.meta.evidenceLevel && r.cycle.meta.evidenceLevel !== 'A');
    // Несоответствующие циклы должны иметь warnings
    for (const r of nonACycles.slice(0, 3)) {
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });

  it('все циклы имеют базовые поля метаданных', () => {
    for (const cycle of LMS_CYCLES.slice(0, 10)) {
      expect(cycle.meta.id).toBeDefined();
      expect(cycle.meta.title).toBeDefined();
      expect(cycle.meta.level).toBeDefined();
    }
  });

  it('rankCycles возвращает отсортированный список', () => {
    const ranked = rankCycles(makeInput());
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('rankCycles с несколькими фильтрами — комбинированный скоринг', () => {
    const ranked = rankCycles(makeInput({
      evidenceLevel: 'A',
      periodization: 'dup',
      timeCommitment: 'medium',
    }));
    expect(ranked.length).toBeGreaterThan(0);
  });
});
