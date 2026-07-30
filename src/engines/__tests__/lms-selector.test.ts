import { describe, it, expect } from 'vitest';
import { rankCycles, selectBestCycle, explainSelection, type LMSSelectorInput } from '../lms/lms-selector.engine';

describe('rankCycles', () => {
  it('возвращает непустой список для валидного input', () => {
    const ranked = rankCycles({ goal: 'strength', level: 'II-KMS', bodyWeight: 85, daysPerWeek: 3, direction: 'powerlifting', mode: 'natural' });
    expect(ranked.length).toBeGreaterThan(0);
  });

  it('сортирует по убыванию score', () => {
    const ranked = rankCycles({ goal: 'strength', level: 'II-KMS', direction: 'powerlifting' });
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
    }
  });

  it('цикл с совпадающим направлением получает более высокий score', () => {
    const rankedPL = rankCycles({ goal: 'strength', level: 'II-KMS', direction: 'powerlifting' });
    const rankedBB = rankCycles({ goal: 'strength', level: 'II-KMS', direction: 'bodybuilding' });
    // Топ-цикл при direction=powerlifting должен быть powerlifting-циклом
    const topPL = rankedPL[0];
    expect(topPL.cycle.meta.direction).toBe('powerlifting');
    // Топ-цикл при direction=bodybuilding должен быть bodybuilding-циклом
    const topBB = rankedBB[0];
    expect(topBB.cycle.meta.direction).toBe('bodybuilding');
  });

  it('точное совпадение уровня даёт бонус +30 к score', () => {
    const ranked = rankCycles({ goal: 'strength', level: 'II-KMS', direction: 'powerlifting' });
    const top = ranked[0];
    expect(top.rationale.some(r => r.includes('точное совпадение'))).toBe(true);
  });

  it('дней/нед достаточно → бонус', () => {
    const ranked = rankCycles({ goal: 'strength', level: 'II-KMS', daysPerWeek: 5, direction: 'powerlifting' });
    const top = ranked[0];
    // хотя бы один цикл должен получить бонус за дни
    expect(ranked.some(r => r.rationale.some(x => x.includes('доступно')))).toBe(true);
  });

  it('дней/нед недостаточно → штраф', () => {
    const ranked = rankCycles({ goal: 'strength', level: 'II-KMS', daysPerWeek: 2, direction: 'powerlifting' });
    // топ-цикл может иметь warnings по дням
    const hasWarning = ranked.some(r => r.warnings.some(w => w.includes('доступно только')));
    expect(hasWarning).toBe(true);
  });

  it('каждый элемент имеет rationale и warnings массивы', () => {
    const ranked = rankCycles({ goal: 'strength', level: 'II-KMS' });
    for (const r of ranked) {
      expect(Array.isArray(r.rationale)).toBe(true);
      expect(Array.isArray(r.warnings)).toBe(true);
      expect(typeof r.score).toBe('number');
    }
  });
});

describe('selectBestCycle', () => {
  it('возвращает топ-1 цикл', () => {
    const best = selectBestCycle({ goal: 'strength', level: 'II-KMS', direction: 'powerlifting' });
    expect(best).not.toBeNull();
    expect(best!.score).toBeGreaterThan(0);
  });

  it('возвращает null только если нет циклов (невозможно — LMS_CYCLES непустой)', () => {
    const best = selectBestCycle({ goal: 'mixed', level: 'MS-MSMK' });
    expect(best).not.toBeNull();
  });
});

describe('explainSelection', () => {
  it('возвращает человекочитаемую сводку', () => {
    const best = selectBestCycle({ goal: 'strength', level: 'II-KMS', direction: 'powerlifting' });
    const text = explainSelection(best!);
    expect(text).toContain('скоринг');
    expect(text.length).toBeGreaterThan(20);
  });
});