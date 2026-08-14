/** calc-ped-banner.test.tsx — UI-тест PED-баннера калькулятора:
 *  тренболон 500 → баннер «Авто-защита по стеку PED» с рисками по системам
 *  (Печень/Сердечно-сосудистая/Почки/Репродуктивная), DHB → гемато-высокий. */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AutoCalculator } from '../AutoCalculator';

beforeEach(() => {
  localStorage.clear();
});

const renderCalc = (courseLinked: any[]) => render(
  React.createElement(AutoCalculator, {
    embedded: true,
    courseWeek: 6,
    courseLinked,
    onApply: () => {},
  } as any),
);

// React нужен для createElement
import React from 'react';

const course = (substanceId: string, doseValue: number) => [
  { id: '1', substanceId, doseValue, doseUnit: 'mg', frequency: 1, startWeek: 1, endWeek: 12 },
];

describe('CalcPEDCard/баннер: тренболон 500 — системные риски в UI', () => {
  it('показывает Нейрозащиту LV3 + Печень/Сердечно-сосудистая/Почки/Репродуктивная', async () => {
    renderCalc(course('tren_acet', 500) as any);
    await waitFor(() => {
      expect(screen.getAllByText(/Авто-защита по стеку PED/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Нейрозащита LV3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Печень — умеренный риск/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Сердечно-сосудистая — высокий риск/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Почки — умеренный риск/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Репродуктивная\/HPG — высокий риск/).length).toBeGreaterThan(0);
  });

  it('DHB: гемато-высокий + сердечно-сосудистая умеренный', async () => {
    renderCalc(course('dhb', 400) as any);
    await waitFor(() => {
      expect(screen.getAllByText(/Авто-защита по стеку PED/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Гемато LV3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Печень — умеренный риск/).length).toBeGreaterThan(0);
  });

  it('без PED баннер не показывается', async () => {
    renderCalc([]);
    await waitFor(() => { /* ждём рендер */ });
    expect(screen.queryAllByText(/Авто-защита по стеку PED/).length).toBe(0);
  });
});
