/**
 * lab-unit-at-read.test.ts — проход 86: единица бланка приводится к единице
 * приложения на чтении.
 *
 * Поле единицы в форме анализа — свободный текст, и `LabPoint` хранит ровно то,
 * что ввёл человек. `interpretLabs` же сравнивает число со шкалой из
 * `REFERENCE_RANGES`, где единица фиксирована (тестостерон — нмоль/л, креатинин —
 * мкмоль/л, глюкоза — ммоль/л). Без пересчёта «600 нг/дл» тестостерона читались
 * как 600 нмоль/л (критично вместо 20.8), а креатинин «1.0 мг/дл» — как 1.0
 * мкмоль/л (низко вместо 88.4).
 *
 * Стало: `convertToUnit` в `labs-mapping` переводит по единицам (масса↔масса,
 * моль↔моль, масса↔моль через молярную массу), а `findLab` применяет перевод к
 * `REFERENCE_RANGES[code].unit`. Если единицу разобрать нельзя — значение
 * остаётся как есть: гадать вслепую хуже, чем не пересчитывать. Активность (МЕ) в
 * массу не переводим — коэффициента вещества у нас нет; пролактин в нг/мл пока
 * остаётся долгом, а не догадкой.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LabPoint } from '../../core/types';
import { convertToUnit } from '../../core/labs-mapping';
import { interpretLabs } from '../lab-analysis.engine';

const point = (code: string, value: number, unit: string): LabPoint => ({
  id: `${code}-1`, code, name: code, value, unit, date: '2026-11-10', phase: 'any',
});
const interp = (code: string, value: number, unit: string) =>
  interpretLabs([point(code, value, unit)]).interpretations.find((i) => i.code === code.toUpperCase());

describe('convertToUnit: единица бланка → единица приложения', () => {
  it('тестостерон 600 нг/дл — это 20.82 нмоль/л', () => {
    expect(convertToUnit('TESTOSTERONE_TOTAL', 600, 'нг/дл', 'нмоль/л')).toBeCloseTo(20.82, 1);
  });

  it('одинаковые единицы — значение как есть', () => {
    expect(convertToUnit('TESTOSTERONE_TOTAL', 18, 'нмоль/л', 'нмоль/л')).toBe(18);
  });

  it('креатинин 1.0 мг/дл — 88.4 мкмоль/л, глюкоза 90 мг/дл — ~5.0 ммоль/л', () => {
    expect(convertToUnit('CREATININE', 1.0, 'мг/дл', 'мкмоль/л')).toBeCloseTo(88.4, 0);
    expect(convertToUnit('GLUCOSE', 90, 'мг/дл', 'ммоль/л')).toBeCloseTo(5.0, 1);
  });

  it('неразобранная единица — null, а не «на глазок»', () => {
    expect(convertToUnit('CRP', 3, 'балл', 'мг/л')).toBeNull();
    expect(convertToUnit('CRP', 3, '', 'мг/л')).toBeNull();
  });

  it('активность ↔ масса без коэффициента вещества — null (пролактин 15 нг/мл)', () => {
    expect(convertToUnit('PROLACTIN', 15, 'нг/мл', 'мЕд/л')).toBeNull();
  });
});

describe('строка разбора: пересчёт по единице, а не мужская шкала на догадке', () => {
  it('тестостерон 600 нг/дл (20.8 нмоль/л) — норма, значка нет', () => {
    expect(interp('TESTOSTERONE_TOTAL', 600, 'нг/дл')).toBeUndefined();
  });

  it('тестостерон 600 без единицы — по-прежнему критично (единицы нет)', () => {
    expect(interp('TESTOSTERONE_TOTAL', 600, '')?.status).toBe('critical_high');
  });

  it('креатинин 1.0 мг/дл (88.4) — норма; 1.0 без единицы — низко', () => {
    expect(interp('CREATININE', 1.0, 'мг/дл')).toBeUndefined();
    expect(interp('CREATININE', 1.0, '')?.status).toBe('low');
  });

  it('глюкоза 90 мг/дл (5.0) — норма; 90 без единицы — критично', () => {
    expect(interp('GLUCOSE', 90, 'мг/дл')).toBeUndefined();
    expect(interp('GLUCOSE', 90, '')?.status).toBe('critical_high');
  });
});

describe('источник: приобретение единицы в одном месте', () => {
  const analysis = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8');

  it('findLab переводит значение через convertToUnit до сравнения со шкалой', () => {
    expect(analysis).toContain('convertToUnit(code, lab.value');
    expect(analysis).toContain("REFERENCE_RANGES[code]?.unit || ''");
  });
});
