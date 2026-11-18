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
import { FullLabInput, LabSliceInput, labUnitHint, FULL_PANELS } from '../Calc.lab';
import { LAB_UNIT_CHOICES } from '../../../../core/constants';

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
    // проход 120: свободные Т3/Т4 — тоже с выбором единицы; 127: плюс нг/дл (США)
    expect(labUnitHint('T3 free')).toBeUndefined();
    const t3 = container.querySelector('select[aria-label="Единица: Т3 своб."]') as HTMLSelectElement;
    expect(t3, 'у Т3 свободного должен быть выбор единицы').toBeTruthy();
    expect(Array.from(t3.options).map(o => o.value)).toEqual(['', 'пмоль/л', 'пг/мл', 'нг/дл']);
    const t4 = container.querySelector('select[aria-label="Единица: Т4 своб."]') as HTMLSelectElement;
    expect(t4, 'у Т4 свободного должен быть выбор единицы').toBeTruthy();
    expect(Array.from(t4.options).map(o => o.value)).toEqual(['', 'пмоль/л', 'пг/мл', 'нг/дл']);
    // проход 121: витамин D — тоже с выбором единицы
    expect(labUnitHint('Vitamin D (25-OH)')).toBeUndefined();
    const vd = container.querySelector('select[aria-label="Единица: Вит. D"]') as HTMLSelectElement;
    expect(vd, 'у витамина D должен быть выбор единицы').toBeTruthy();
    expect(Array.from(vd.options).map(o => o.value)).toEqual(['', 'нг/мл', 'нмоль/л']);
    // проход 122: фолат — тоже с выбором единицы
    expect(labUnitHint('Folate')).toBeUndefined();
    const fol = container.querySelector('select[aria-label="Единица: Фолат"]') as HTMLSelectElement;
    expect(fol, 'у фолата должен быть выбор единицы').toBeTruthy();
    expect(Array.from(fol.options).map(o => o.value)).toEqual(['', 'нг/мл', 'нмоль/л']);
    // проход 123: B12 — тоже с выбором единицы
    expect(labUnitHint('B12')).toBeUndefined();
    const b12 = container.querySelector('select[aria-label="Единица: В12"]') as HTMLSelectElement;
    expect(b12, 'у B12 должен быть выбор единицы').toBeTruthy();
    expect(Array.from(b12.options).map(o => o.value)).toEqual(['', 'пг/мл', 'пмоль/л']);
  });
});

/**
 * Проход 129: единица нужна не только «звёздным» маркерам. Каталог маркеров держит
 * единицу для АпоB, Лп(а), ГСПГ, ПТГ, гомоцистеина — но поле формы подписано
 * человеческим именем (`Lp(a)`, `NT-proBNP`, `CK-MB`), и сравнение строк в нижнем
 * регистре пару не находило. Поле просило число без единицы: 95 мг/дл АпоB и
 * 0.95 г/л — одно и то же, но форма об этом молчала.
 */
describe('проход 129: у каждого поля формы есть единица или выбор единицы', () => {
  it('мост UCUM закрывает ГСПГ, ПТГ, ЛПОНП, ПСА и hsCRP', () => {
    expect(labUnitHint('SHBG')).toBe('нмоль/л');
    expect(labUnitHint('PTH')).toBe('пг/мл');
    expect(labUnitHint('VLDL')).toBe('ммоль/л');
    expect(labUnitHint('PSA total')).toBe('нг/мл');
    expect(labUnitHint('hsCRP')).toBe('мг/л');
  });

  it('каталог маркеров находится без учёта написания', () => {
    expect(labUnitHint('ApoB')).toBe('г/л');
    expect(labUnitHint('ApoA1')).toBe('г/л');
    expect(labUnitHint('Lp(a)')).toBe('мг/дл');
    expect(labUnitHint('CK-MB')).toBe('нг/мл');
    expect(labUnitHint('NT-proBNP')).toBe('пг/мл');
    expect(labUnitHint('IL-6')).toBe('пг/мл');
    expect(labUnitHint('Uric acid')).toBe('мкмоль/л');
  });

  it('ни одно поле полного бланка не просит число без единицы', () => {
    // Исключения честные, а не забытые:
    //  - без концентрации: INR — отношение, pH мочи — безразмерный, мочевые
    //    полосы (белок, кетоны, лейкоциты, нитриты) — «следы/+/++»;
    //  - не описаны в каталоге единиц вовсе: 3a-ADG, витамин K, насыщение
    //    трансферрина (процент), тропонин T (не тот же анализ, что тропонин I).
    // Новое имя в этом списке — повод завести запись в каталоге, а не привычка.
    const KNOWN = [
      'INR', 'pH', 'Protein', 'Ketones', 'Leukocytes', 'Nitrite',
      '3a-ADG', 'Vitamin K', 'Transferrin Sat', 'Troponin T',
    ];
    const missing = FULL_PANELS
      .flatMap(p => p.markers)
      .filter(m => !LAB_UNIT_CHOICES[m] && !labUnitHint(m))
      .filter(m => !KNOWN.includes(m));
    expect(missing).toEqual([]);
  });
});
