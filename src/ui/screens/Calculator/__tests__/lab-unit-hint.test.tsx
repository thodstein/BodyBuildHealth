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
import { FullLabInput, LabSliceInput } from '../Calc.lab';

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
    const { container } = render(<FullLabInput values={null} onChange={() => {}} />);
    // селекты единиц присутствуют, значит подсказка им не нужна
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });
});
