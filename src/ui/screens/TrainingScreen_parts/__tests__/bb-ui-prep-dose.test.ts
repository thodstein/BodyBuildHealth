/**
 * Аудит UI, P2: персональная доза углеводов trial в пик-неделю.
 *
 * Доза хранится в плане (`peakWeek.carbDoseGPerKg`) и читается питанием и пик-неделей.
 * «Перенос даты шоу» и «±неделя подготовки» пересобирали оверлей без `carbDoseGPerKg`,
 * поэтому персональная доза терялась — план и питание возвращались к среднему коридора.
 *
 * `prepTrialDose` — единое правило: сохранённая в плане доза приоритетна, иначе берём из
 * последнего результата пробного пика, иначе `undefined` (движок сам возьмёт середину
 * коридора).
 */
import { describe, expect, it } from 'vitest';
import { prepTrialDose } from '../bb-auto-constructor-shared';
import { trialCarbDoseGPerKg } from '../../../../engines/bb/bb-contest-prep.engine';

const lastTest: any = {
  id: 'trial-1',
  verdict: 'tested_ok',
  weightDeltaKg: 1,
  responses: { waterRetention: 5, fullness: 1 },
};

describe('аудит UI: доза trial пик-недели', () => {
  it('сохранённая в плане доза приоритетнее пересчёта', () => {
    expect(prepTrialDose({ peakWeek: { carbDoseGPerKg: 7.5 }, category: 'mens_physique', sex: 'male' }, lastTest)).toBe(7.5);
    // Даже если из trial получилось бы другое число — план не переписываем молча.
    expect(prepTrialDose({ peakWeek: { carbDoseGPerKg: 4 }, category: 'mens_physique', sex: 'male' }, lastTest)).toBe(4);
  });

  it('нет дозы в плане — считаем из последнего trial', () => {
    const expected = trialCarbDoseGPerKg(lastTest, 'mens_bodybuilding', 'male');
    expect(prepTrialDose({ peakWeek: {}, category: 'mens_bodybuilding', sex: 'male' }, lastTest)).toBe(expected);
    expect(prepTrialDose(null, lastTest)).toBe(trialCarbDoseGPerKg(lastTest, 'mens_physique', 'male'));
  });

  it('ни плана, ни trial — `undefined` (движок берёт средний коридор)', () => {
    expect(prepTrialDose(null, null)).toBeUndefined();
    expect(prepTrialDose({ peakWeek: null }, undefined)).toBeUndefined();
  });

  it('мусор в сохранённой дозе не проходит как измерение', () => {
    expect(prepTrialDose({ peakWeek: { carbDoseGPerKg: 0 as any }, category: 'mens_physique' }, lastTest))
      .toBe(trialCarbDoseGPerKg(lastTest, 'mens_physique', 'male'));
    expect(prepTrialDose({ peakWeek: { carbDoseGPerKg: Number.NaN as any }, category: 'mens_physique' }, lastTest))
      .toBe(trialCarbDoseGPerKg(lastTest, 'mens_physique', 'male'));
  });
});
