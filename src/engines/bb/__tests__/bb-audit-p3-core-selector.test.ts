/**
 * Аудит 2026-11, ядро P3-1 и P3-2 — капы сессии и определение «высокого объёма».
 *
 * P3-1. `splitSessionBudget` объявляла `pedDoses`/`mode`, но не читала их, и жёстко
 * ставила `years = 0`: капы сессии (и предупреждения о плотных днях) для опытного
 * атлета считались как для новичка. Теперь стаж приходит из `BBSelectorInput`
 * (`trainingYears`), а `undefined` оставляет прежнее консервативное поведение.
 *
 * P3-2. Одно решение о сплите опиралось на три разных определения «высокого
 * объёма»: дозо-зависимое в `rankBBSplits`, «любой PED в списке» в
 * `splitFitWarnings` (креатин считался курсом) и `peds.length > 0` в капах.
 * Теперь правило одно — `highVolumeDemandOf` (enhanced или реальный PED-профиль).
 */
import { describe, expect, it } from 'vitest';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import { highVolumeDemandOf, pedProfileOf, splitFitWarnings, splitSessionBudget } from '../bb-selector.engine';

const split = (id: string) => SPLIT_PATTERNS.find(p => p.id === id)!;
const DENSE_WARNING = /групп при высоком объёме/;

describe('ядро P3-1: стаж доезжает до капов сессии', () => {
  it('enhanced + AAS: 8 лет стажа дают больший кап, чем 0 лет', () => {
    const zero = splitSessionBudget(split('ppl_6'), { level: 'enhanced', peds: ['AAS'], trainingYears: 0 });
    const years8 = splitSessionBudget(split('ppl_6'), { level: 'enhanced', peds: ['AAS'], trainingYears: 8 });
    expect(years8.maxWorkingSets).toBeGreaterThan(zero.maxWorkingSets);
    expect(years8.maxExercises).toBeGreaterThanOrEqual(zero.maxExercises);
  });

  it('стаж неизвестен — поведение прежнее (как 0 лет)', () => {
    const none = splitSessionBudget(split('ppl_6'), { level: 'enhanced', peds: ['AAS'] });
    const zero = splitSessionBudget(split('ppl_6'), { level: 'enhanced', peds: ['AAS'], trainingYears: 0 });
    expect(none).toEqual(zero);
  });

  it('явный режим «на курсе» учитывается без PED-списка', () => {
    const natural = splitSessionBudget(split('upper_lower_4'), { level: 'advanced', mode: 'natural', trainingYears: 5 });
    const onCourse = splitSessionBudget(split('upper_lower_4'), { level: 'advanced', mode: 'on_course', trainingYears: 5 });
    expect(onCourse.maxWorkingSets).toBeGreaterThan(natural.maxWorkingSets);
  });
});

describe('ядро P3-2: одно определение «высокого объёма»', () => {
  it('креатин не делает пользователя «высокообъёмным»', () => {
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['creatine'] } as any)).toBe(false);
  });

  it('AAS/GH/инсулин (по имени или дозе) и enhanced — да', () => {
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['AAS'] } as any)).toBe(true);
    expect(highVolumeDemandOf({ level: 'advanced', peds: [], pedDoses: { AAS: 750 } } as any)).toBe(true);
    expect(highVolumeDemandOf({ level: 'advanced', peds: ['GH'] } as any)).toBe(true);
    expect(highVolumeDemandOf({ level: 'advanced', peds: [], pedDoses: { insulin: 10 } } as any)).toBe(true);
    expect(highVolumeDemandOf({ level: 'enhanced', peds: [] } as any)).toBe(true);
  });

  it('порог AAS по дозе — 500 мг', () => {
    expect(pedProfileOf({ peds: [], pedDoses: { AAS: 499 } } as any).hasAAS).toBe(false);
    expect(pedProfileOf({ peds: [], pedDoses: { AAS: 500 } } as any).hasAAS).toBe(true);
    expect(pedProfileOf({ peds: ['AAS'] } as any).hasAAS).toBe(true);
  });

  it('splitFitWarnings: плотный день предупреждается только при реальном PED-профиле', () => {
    const withCreatine = splitFitWarnings(
      { level: 'advanced', goal: 'mass', daysPerWeek: 3, peds: ['creatine'] } as any,
      'fullbody_3',
    );
    const withAAS = splitFitWarnings(
      { level: 'advanced', goal: 'mass', daysPerWeek: 3, peds: ['AAS'] } as any,
      'fullbody_3',
    );
    expect(withCreatine.some(w => DENSE_WARNING.test(w))).toBe(false);
    expect(withAAS.some(w => DENSE_WARNING.test(w))).toBe(true);
  });
});
