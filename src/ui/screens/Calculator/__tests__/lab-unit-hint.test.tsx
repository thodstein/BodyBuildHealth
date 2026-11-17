/**
 * lab-unit-hint.test.tsx — проход 114: форма говорит, в какой единице ждёт число.
 *
 * Раньше у полей не было ни единицы, ни места под неё: человек вписывал 15 г/дл
 * гемоглобина в поле, где движок сравнивает с 130–170 г/л, и получал анемию из
 * нормального бланка. У гормонов с выбором единицы подсказки нет — рядом стоит
 * `UnitPicker`, и подсказка только дублировала бы выбор.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { FullLabInput, LabSliceInput, labUnitHint } from '../Calc.lab';

afterEach(cleanup);

const placeholders = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('input')).map(i => i.getAttribute('placeholder') || '');

describe('проход 114: единица стоит подсказкой в поле', () => {
  it('полный бланк: гемоглобин «г/л», креатинин «мкмоль/л», глюкоза «ммоль/л»', () => {
    const { container } = render(<FullLabInput values={null} onChange={() => {}} />);
    const ph = placeholders(container);
    expect(ph).toContain('г/л');
    expect(ph).toContain('мкмоль/л');
    expect(ph).toContain('ммоль/л');
    expect(ph).toContain('10⁹/л');
  });

  it('бланк курса тоже подсказывает единицу', () => {
    const empty = {
      date: '', panelSex: {}, panelBiochem: {}, panelHematology: {}, panelThyroid: {},
      panelLipid: {}, panelIron: {}, panelVitamin: {}, panelCardiac: {}, panelCoagulation: {},
      panelInflammatory: {}, panelAdrenal: {}, panelMineral: {}, panelTumor: {}, panelUrinalysis: {},
    };
    const { container } = render(<LabSliceInput label="До курса" slice={empty as never} onChange={() => {}} />);
    const ph = placeholders(container);
    expect(ph).toContain('г/л');
    expect(ph).toContain('Ед/л');
  });

  it('у гормонов с выбором единицы подсказки нет — там UnitPicker', () => {
    expect(labUnitHint('E2')).toBeUndefined();
    expect(labUnitHint('Total T')).toBeUndefined();
    expect(labUnitHint('Prolactin')).toBeUndefined();
    // проход 118: прогестерон переехал в этот же список — у него две единицы
    expect(labUnitHint('Progesterone')).toBeUndefined();
    const { container } = render(<FullLabInput values={null} onChange={() => {}} />);
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
    const prog = container.querySelector('select[aria-label="Единица: Прогестерон"]') as HTMLSelectElement;
    expect(prog, 'у прогестерона должен быть выбор единицы').toBeTruthy();
    expect(Array.from(prog.options).map(o => o.value)).toEqual(['', 'нг/мл', 'нмоль/л']);
    // проход 119: свободный тестостерон — тем же путём
    expect(labUnitHint('Free T')).toBeUndefined();
    const ft = container.querySelector('select[aria-label="Единица: Своб. тестостерон"]') as HTMLSelectElement;
    expect(ft, 'у свободного тестостерона должен быть выбор единицы').toBeTruthy();
    expect(Array.from(ft.options).map(o => o.value)).toEqual(['', 'пг/мл', 'пмоль/л']);
    // проход 120: свободные Т3/Т4 — тоже с выбором единицы
    expect(labUnitHint('T3 free')).toBeUndefined();
    const t3 = container.querySelector('select[aria-label="Единица: Т3 своб."]') as HTMLSelectElement;
    expect(t3, 'у Т3 свободного должен быть выбор единицы').toBeTruthy();
    expect(Array.from(t3.options).map(o => o.value)).toEqual(['', 'пмоль/л', 'пг/мл']);
  });
});
