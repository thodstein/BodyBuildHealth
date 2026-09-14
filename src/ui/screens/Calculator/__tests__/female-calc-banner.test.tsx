/**
 * female-calc-banner.test.tsx — этап C («женский слой»): баннер калькулятора поддержки.
 *
 * Женский профиль + курс → «♀ Женский слой» (флаги вирилизации + усиление поверх мужского).
 * Мужской профиль → баннера нет (мужской путь не тронут).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AutoCalculator } from '../AutoCalculator';

const seedProfile = (sex: 'male' | 'female') => {
  localStorage.setItem(
    'he_profile_v2',
    JSON.stringify({ settings: { personal: { sex, weight: 60, age: 30 }, lifestyle: { sleepHours: 7, stressLevel: 4 } } }),
  );
};

const renderCalc = (courseLinked: any[]) =>
  render(
    React.createElement(AutoCalculator, { embedded: true, courseWeek: 6, courseLinked, onApply: () => {} } as any),
  );

const course = (substanceId: string, doseValue: number) => [
  { id: '1', substanceId, doseValue, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12 },
];

beforeEach(() => {
  localStorage.clear();
});

describe('female-calc-banner (этап C)', () => {
  it('женщина + Deca 50 → баннер «Женский слой» с флагом и усилением', async () => {
    seedProfile('female');
    renderCalc(course('deca', 50));
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Женский слой/).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
    expect(screen.queryAllByText(/Нандролон/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/vitex/).length).toBeGreaterThan(0);
  });

  it('женщина + тренболон → абсолютное противопоказание в баннере', async () => {
    seedProfile('female');
    renderCalc(course('tren_acet', 500));
    await waitFor(
      () => {
        expect(screen.queryAllByText(/АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ/).length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );
  });

  it('мужчина + Deca 50 → женского баннера нет', async () => {
    seedProfile('male');
    renderCalc(course('deca', 50));
    // Даём дебаунсу (250мс) и персисту отработать
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryAllByText(/Женский слой/).length).toBe(0);
    expect(screen.queryAllByText(/АБСОЛЮТНОЕ ПРОТИВОПОКАЗАНИЕ/).length).toBe(0);
  });
});
