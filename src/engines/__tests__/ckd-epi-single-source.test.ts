/**
 * ckd-epi-single-source.test.ts — проход 133: СКФ считается одним кодом.
 *
 * CKD-EPI 2021 жила в двух местах. В риск-модели (`support-plan/engine-helpers`)
 * коэффициенты были верные, а в индексах здоровья (`clinical-indices.engine`) —
 * смешанные: константа 142, женский множитель 1.012 и `0.9938^возраст` из редакции
 * 2021, а показатели степени `−0.329/−0.411` из редакции 2009. Для креатинина ниже
 * каппа (женщины, низкая мышечная масса) это давало разные числа СКФ на одном бланке.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ckdEpi2021 } from '../lab-norms.engine';
import { calculateIndices } from '../clinical-indices.engine';

describe('проход 133: CKD-EPI 2021 — один расчёт', () => {
  it('числа редакции 2021: мужчина 40 лет, креатинин 80 → 110', () => {
    expect(ckdEpi2021(80, 40, 'male')).toBeCloseTo(110.0, 1);
    // Женщина при том же креатинине ниже — каппа 0.7 и множитель 1.012.
    expect(ckdEpi2021(80, 40, 'female')).toBeCloseTo(82.3, 1);
    expect(ckdEpi2021(80, 40, 'female')).toBeLessThan(ckdEpi2021(80, 40, 'male'));
    // Возраст снижает фильтрацию.
    expect(ckdEpi2021(120, 60, 'male')).toBeCloseTo(59.7, 1);
  });

  it('без пола — мужской путь, как во всей модели', () => {
    expect(ckdEpi2021(80, 40)).toBe(ckdEpi2021(80, 40, 'male'));
    expect(ckdEpi2021(80, 40, null)).toBe(ckdEpi2021(80, 40, 'male'));
  });

  it('непригодный вход не даёт числа', () => {
    expect(Number.isNaN(ckdEpi2021(0, 40, 'male'))).toBe(true);
    expect(Number.isNaN(ckdEpi2021(80, 0, 'male'))).toBe(true);
    expect(Number.isNaN(ckdEpi2021(NaN, 40, 'male'))).toBe(true);
  });

  it('индексы здоровья читают ту же функцию, а не свою копию', () => {
    const labs = [{ code: 'CREATININE', value: 200, unit: 'мкмоль/л', date: '2026-01-01' }];
    const male = calculateIndices(labs as never, 'male', 60).egfr;
    expect(male.value).toBeCloseTo(Number(ckdEpi2021(200, 60, 'male').toFixed(1)), 5);
    expect(male.status).toBe('g3b');
    const female = calculateIndices(labs as never, 'female', 60).egfr;
    expect(female.value).toBeCloseTo(Number(ckdEpi2021(200, 60, 'female').toFixed(1)), 5);
    expect(female.value).toBeLessThan(male.value);
  });

  it('второй формулы в исходниках не осталось', () => {
    const ci = readFileSync(resolve(__dirname, '..', 'clinical-indices.engine.ts'), 'utf8');
    expect(ci).toContain('ckdEpi2021');
    expect(ci).not.toContain('Math.pow(Math.min');
    expect(ci).not.toContain('-0.329');
    const helpers = readFileSync(resolve(__dirname, '..', 'support-plan', 'engine-helpers.ts'), 'utf8');
    expect(helpers).toContain('ckdEpi2021');
    expect(helpers).not.toContain('Math.pow(Math.min');
    expect(helpers).not.toContain('-0.241');
  });
});
