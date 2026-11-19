/**
 * lab-field-read-honest.test.ts — проход 141: одно правило чтения числа из поля.
 *
 * Два дефекта из одного корня — «у каждого контура свой разбор строки»:
 *
 *  1) Разряды. Бланк печатает «Ферритин 1 000», «Тромбоциты 250 000».
 *     `parseFloat` обрывается на пробеле: ферритин 1 000 читался как 1 ng/mL, то
 *     есть перегрузка железом приходила в ступени и в риск-модель тяжёлым дефицитом
 *     («Ферритин = 1 ng/mL — избыток железа… НЕ назначать железо» — на самом деле
 *     ни то, ни другое), а тромбоциты 250 000 — как 250 (случайно правдоподобно).
 *
 *  2) Копии правила. `labFieldNumber` (граница, полоска, запятая) существовала с
 *     прохода 136, но её обходили четыре своих разбора: `engine.ts` (пролактин,
 *     приоритеты по анализам, авто-вывод анкеты), `recommendation-engine.ts`,
 *     `Calc.labs-derived.ts`, `Calc.lab.tsx`. Из-за этого «>40» АЛТ включал риск,
 *     но не авто-вывод в анкете, а пролактин брался только из `fullPanel` и без
 *     единицы бланка.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { labFieldNumber } from '../lab-field-number';
import { labSliceToValues } from '../mapper-ctx';
import { buildTzInput } from '../engine-helpers';
import { DEFAULT_STATE } from '../../../ui/screens/Calculator/Calc.types';

const stateWithLabs = (labs: Record<string, unknown>) =>
  ({
    ...DEFAULT_STATE,
    // Курс-заглушка: без препаратов риск-модель не строит вход.
    pharma: { ...DEFAULT_STATE.pharma, aas: [{ id: 'test_e', doseMgWeek: 500, weeks: 12 }] },
    labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null, ...labs },
  } as any);

describe('проход 141: разряды в числе читаются целиком', () => {
  it('пробел и неразрывный пробел — разделитель тысяч, а не конец числа', () => {
    expect(labFieldNumber('1 000')).toBe(1000);
    expect(labFieldNumber('250 000')).toBe(250000);
    expect(labFieldNumber('2\u00A0000')).toBe(2000);
    expect(labFieldNumber('1 000,5')).toBe(1000.5);
    expect(labFieldNumber('1 200 000')).toBe(1200000);
    expect(labFieldNumber('>1 000')).toBe(1000);
  });

  it('обычное чтение не изменилось', () => {
    expect(labFieldNumber('5,4')).toBe(5.4);
    expect(labFieldNumber('5.4 ммоль/л')).toBe(5.4);
    expect(labFieldNumber('>1000')).toBe(1000);
    expect(labFieldNumber('≥ 3')).toBe(3);
    expect(labFieldNumber('12abc')).toBe(12);
    expect(labFieldNumber('1e3')).toBe(1000);
    expect(labFieldNumber(12)).toBe(12);
    expect(labFieldNumber(0)).toBe(0);
    expect(labFieldNumber('1+')).toBeUndefined();
    expect(labFieldNumber('')).toBeUndefined();
    expect(labFieldNumber(null)).toBeUndefined();
    expect(labFieldNumber(undefined)).toBeUndefined();
    expect(labFieldNumber('abc')).toBeUndefined();
  });

  it('«5 5» не склеивается в 55: это не разряды, и угадывать нельзя', () => {
    expect(labFieldNumber('5 5')).toBe(5);
  });

  it('ферритин «1 000» — перегрузка, а не дефицит: и в плане, и в риск-модели', () => {
    const slice = { date: '2026-11-01', panelIron: { Ferritin: '1 000' } };
    expect(labSliceToValues(slice as never, 'male')['FERRITIN']).toBe(1000);
    const tz = buildTzInput(stateWithLabs({ fullPanel: slice }), []);
    expect(tz?.labValues?.['FERRITIN']).toBe(1000);
  });
});

describe('проход 141: правило чтения поля одно на все контуры', () => {
  /** Строки без комментариев — чтобы упоминание в пояснении не считалось кодом. */
  const codeOnly = (src: string) =>
    src.split(/\r?\n/).filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  const root = resolve(__dirname, '..');
  const files: Array<[string, string]> = [
    ['engine.ts', 'labFieldNumber'],
    ['../recommendation-engine.ts', 'labFieldNumber'],
    ['../../ui/screens/Calculator/Calc.labs-derived.ts', 'labFieldNumber'],
    ['../../ui/screens/Calculator/Calc.lab.tsx', 'labFieldNumber'],
  ];

  for (const [rel, rule] of files) {
    it(`${rel}: число поля читается общим правилом, а не своим parseFloat`, () => {
      const src = readFileSync(resolve(root, rel), 'utf8');
      expect(src).toContain(rule);
      expect(codeOnly(src)).not.toMatch(/parseFloat\s*\(/);
    });
  }

  it('пролактин берётся из текущего бланка с единицей, а не из fullPanel сырым', () => {
    const src = readFileSync(resolve(root, 'engine.ts'), 'utf8');
    expect(src).not.toContain('fullPanel?.panelSex?.Prolactin');
    expect(src).toContain("['PROLACTIN']");
  });
});
