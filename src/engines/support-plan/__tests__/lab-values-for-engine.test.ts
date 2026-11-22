/**
 * lab-values-for-engine.test.ts — проход 206: один читатель бланка для движка.
 *
 * Класс дефекта: числа для риск-модели собирались вторым, приватным разбором
 * панелей (`engine-helpers.extractLabValues`), рядом с каноном формы
 * (`mapper-ctx.labSliceToValues`). Списки панелей разошлись: ЩФ, цистатин C и
 * инсулин доходили до риска только после правки во втором месте, а HOMA-IR жил
 * только во втором. Теперь карта одна — `labValuesForEngine`.
 *
 * Гард держит контракт этой карты:
 *  - ни одно прочитанное число не теряется и не подменяется (карта — надстройка
 *    над `tierLabView(labSliceToValues(...))`, а не вторая сборка);
 *  - производные считаются только из введённого и только там, где их нет в
 *    бланке (HOMA-IR, худший из СРБ/вчСРБ, СКФ по креатинину);
 *  - «нет записи» остаётся отсутствием ключа, а не нулём;
 *  - СКФ из бланка главнее расчёта (правило 23).
 */
import { describe, it, expect } from 'vitest';
import { labSliceToValues, labValuesForEngine } from '../mapper-ctx';
import { tierLabView } from '../../../data/lab-tier-ranges';
import { egfrFromCreatinine } from '../../lab-norms.engine';

/** Реалистичный бланк: панели, единицы, оба вида СРБ, СКФ полем. */
const blank = {
  date: '2026-11-20',
  panelBiochem: {
    ALT: '35',
    AST: '30',
    GGT: '40',
    ALP: '90',
    Bilirubin: '12',
    Glucose: '5.4',
    Insulin: '12',
    HbA1c: '5.4',
    Creatinine: '90',
    eGFR: '95',
    CRP: '2',
  },
  panelSex: { 'Total T': '18', E2: '25', Prolactin: '12' },
  panelHematology: { HCT: '46', Hemoglobin: '150', Platelets: '250' },
  panelMineral: { Potassium: '4.3', Sodium: '140', Magnesium: '0.9' },
  panelInflammatory: { hsCRP: '4' },
  units: { panelBiochem: { Glucose: 'ммоль/л', Insulin: 'мкЕд/мл' } },
} as any;

const base = () => tierLabView(labSliceToValues(blank, 'male'));

describe('проход 206: карта движка — надстройка над общим читателем', () => {
  it('ни одно введённое число не теряется и не меняется', () => {
    const baseMap = base();
    const engineMap = labValuesForEngine(blank, 'male', 30);
    expect(Object.keys(baseMap).length).toBeGreaterThan(20);
    for (const [key, value] of Object.entries(baseMap)) {
      // СРБ — единственное намеренное слияние: в карте он становится худшим из
      // СРБ/вчСРБ (проход 130, ниже отдельный тест). Остальное — байт-в-байт.
      if (key === 'CRP') continue;
      expect(engineMap[key], `потерян или изменён ${key}`).toBe(value);
    }
  });

  it('HOMA-IR считается из глюкозы и инсулина и виден под кодом доменов', () => {
    const engineMap = labValuesForEngine(blank, 'male', 30);
    // (5.4 × 12) / 22.5 = 2.88
    expect(engineMap['HOMAIR']).toBeCloseTo(2.88, 2);
  });

  it('без инсулина HOMA-IR не появляется (нет записи ≠ 0)', () => {
    const engineMap = labValuesForEngine({ date: '', panelBiochem: { Glucose: '5.4' } } as any, 'male', 30);
    expect(engineMap['GLU']).toBe(5.4);
    expect(engineMap['HOMAIR']).toBeUndefined();
    expect(engineMap['HOMA']).toBeUndefined();
  });

  it('СРБ и вчСРБ — один белок: берётся худшее число, второе не пропадает', () => {
    const both = labValuesForEngine(blank, 'male', 30);
    expect(both['CRP']).toBe(4);
    expect(both['HSCRP']).toBe(4);

    const onlyHs = labValuesForEngine({ date: '', panelInflammatory: { hsCRP: '7' } } as any, 'male', 30);
    expect(onlyHs['CRP']).toBe(7);

    const onlyCrp = labValuesForEngine({ date: '', panelBiochem: { CRP: '1' } } as any, 'male', 30);
    expect(onlyCrp['CRP']).toBe(1);
    // Мост написаний отдаёт то же число под вторым именем: это один белок,
    // а не два разных анализа.
    expect(onlyCrp['HSCRP']).toBe(1);
  });

  it('СКФ из бланка главнее расчёта по креатинину', () => {
    const engineMap = labValuesForEngine(blank, 'male', 30);
    expect(engineMap['EGFR']).toBe(95);
    expect(engineMap['EGFR']).not.toBe(egfrFromCreatinine(90, 30, 'male'));
  });

  it('без СКФ в бланке она считается той же формулой, что и везде', () => {
    const engineMap = labValuesForEngine({ date: '', panelBiochem: { Creatinine: '90' } } as any, 'male', 30);
    expect(engineMap['EGFR']).toBe(egfrFromCreatinine(90, 30, 'male'));
  });

  it('пустой бланк — пустая карта', () => {
    expect(labValuesForEngine(null, 'male', 30)).toEqual({});
    expect(labValuesForEngine({ date: '' } as any, 'male', 30)).toEqual({});
  });
});
