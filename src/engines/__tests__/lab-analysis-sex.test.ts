/**
 * lab-analysis-sex.test.ts — проход 61: `interpretLabs` знает пол.
 *
 * Было: `REFERENCE_RANGES` — один мужской ряд для всех, и композитные индексы
 * считались от мужских знаменателей (печень /40, почки /110). Женщина с АЛТ 35,
 * ГГТ 40, HCT 49, HGB 160, креатинином 100, эстрадиолом 200 пг/мл или
 * пролактином 600 мЕд/л читала «норма», а тестостерон 1 нмоль/л давал ей
 * «андрогенный дефицит».
 *
 * Стало: женские границы из резолвера (`LFT_ULN`, `GGT_ULN`, `HCT_THRESHOLDS`,
 * `HGB_THRESHOLDS`, `CREATININE_ULN`, `FEMALE_HORMONE_ULN`) и индексы в долях
 * ВГН пациента. Без `sex` — прежний мужской путь байт-в-байт.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { interpretLabs } from '../lab-analysis.engine';
import {
  LFT_ULN, GGT_ULN, HCT_THRESHOLDS, HGB_THRESHOLDS, CREATININE_ULN,
  FEMALE_HORMONE_BANDS, FEMALE_HORMONE_ULN,
} from '../lab-norms.engine';

const one = (code: string, value: number) => [{ code, value } as any];
const interp = (code: string, value: number, sex?: 'male' | 'female') =>
  interpretLabs(one(code, value), sex).interpretations.find(i => i.code === code);
const status = (code: string, value: number, sex?: 'male' | 'female') =>
  interp(code, value, sex)?.status;

describe('маркеры: женские границы из резолвера', () => {
  it('АЛТ 35: у мужчины норма, у женщины высоко (её ВГН 31)', () => {
    expect(status('ALT', 35, 'male')).toBeUndefined();
    expect(status('ALT', 35, 'female')).toBe('high');
    expect(LFT_ULN.ALT.female).toBe(31);
  });

  it('ГГТ 40: у мужчины норма, у женщины высоко (её ВГН 31)', () => {
    expect(status('GGT', 40, 'male')).toBeUndefined();
    expect(status('GGT', 40, 'female')).toBe('high');
    expect(GGT_ULN.female).toBe(31);
  });

  it('HCT 49 и HGB 160: женские пороги 48/150', () => {
    expect(status('HEMATOCRIT', 49, 'male')).toBeUndefined();
    expect(status('HEMATOCRIT', 49, 'female')).toBe('high');
    expect(status('HEMOGLOBIN', 160, 'male')).toBeUndefined();
    expect(status('HEMOGLOBIN', 160, 'female')).toBe('high');
    expect(HCT_THRESHOLDS.female.erythrocytosis).toBe(48);
    expect(HGB_THRESHOLDS.female.upper).toBe(150);
  });

  it('креатинин 100: у мужчины норма, у женщины высоко (ВГН 97)', () => {
    expect(status('CREATININE', 100, 'male')).toBeUndefined();
    expect(status('CREATININE', 100, 'female')).toBe('high');
    expect(CREATININE_ULN.female).toBe(97);
  });
});

describe('гормоны: мужское окно не выдаётся за общее', () => {
  it('тестостерон 1 нмоль/л — «дефицит» только у мужчины', () => {
    expect(status('TESTOSTERONE_TOTAL', 1, 'male')).toBe('low');
    expect(status('TESTOSTERONE_TOTAL', 1, 'female')).toBeUndefined();
  });

  it('пролактин: у женщины высоко только от 800 мЕд/л', () => {
    expect(status('PROLACTIN', 400, 'male')).toBe('high');
    expect(status('PROLACTIN', 600, 'female')).toBeUndefined();
    expect(status('PROLACTIN', 900, 'female')).toBe('high');
    expect(FEMALE_HORMONE_ULN.PRL.high).toBe(800);
  });

  it('E2: у женщины 200 — норма, 500 — высоко, 900 — критично, 20 — низко', () => {
    // Мужской ряд 10–40, критично >60: 200 пг/мл — критично.
    expect(status('ESTRADIOL', 200, 'male')).toBe('critical_high');
    expect(status('ESTRADIOL', 200, 'female')).toBeUndefined();
    expect(status('ESTRADIOL', 500, 'female')).toBe('high');
    expect(status('ESTRADIOL', 900, 'female')).toBe('critical_high');
    expect(status('ESTRADIOL', 20, 'female')).toBe('low');
    // Числовые границы совпадают с текстовыми бэндами (40–400 зелёный, >800 красный).
    expect(FEMALE_HORMONE_ULN.E2.high).toBe(400);
    expect(FEMALE_HORMONE_BANDS.E2.red).toBe('>800 или <30');
  });

  it('E2 у женщины не штрафует гормональный балл в фазовой норме', () => {
    expect(interpretLabs(one('ESTRADIOL', 200), 'female').hormoneScore).toBe(0);
    expect(interpretLabs(one('ESTRADIOL', 200), 'male').hormoneScore).toBe(25);
  });
});

describe('композитные индексы — в долях ВГН пациента', () => {
  it('индекс печени: женские 31 эквивалентны мужским 40', () => {
    const fem = interpretLabs(one('ALT', LFT_ULN.ALT.female), 'female').liverStress;
    const male = interpretLabs(one('ALT', LFT_ULN.ALT.male), 'male').liverStress;
    expect(Math.abs(fem - male)).toBeLessThanOrEqual(1);
  });

  it('индекс почек: женские 97 эквивалентны мужским 110', () => {
    const fem = interpretLabs(one('CREATININE', CREATININE_ULN.female), 'female').kidneyStress;
    const male = interpretLabs(one('CREATININE', CREATININE_ULN.male), 'male').kidneyStress;
    expect(Math.abs(fem - male)).toBeLessThanOrEqual(1);
  });

  it('без sex — прежний мужской путь', () => {
    const labs = one('ALT', 90);
    expect(JSON.stringify(interpretLabs(labs))).toBe(JSON.stringify(interpretLabs(labs, 'male')));
  });
});

describe('исходник: мужские знаменатели индексов убраны', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/engines/lab-analysis.engine.ts'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n');

  it('печень и почки считают от ВГН пола', () => {
    expect(src).toContain('LFT_ULN.ALT.female');
    expect(src).toContain('CREATININE_ULN.female');
    expect(src).not.toContain('/ 3 / 40)');
    expect(src).not.toContain('creatinine / 110');
  });
});
