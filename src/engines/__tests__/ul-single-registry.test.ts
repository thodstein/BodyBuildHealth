/**
 * ul-single-registry.test.ts — гард «один реестр пределов».
 *
 * До ноября 2026 «Контроль дозировок» (`checkStackToxicity`) жил на СВОЕЙ
 * таблице UL (`SUPPLEMENT_UPPER_LIMITS`): B6 = 100 мг (IOM) вместо EFSA 12 мг,
 * селен 400 вместо 255, всё в «мг». Плюс пересчёт микронутриентов был сломан в
 * 1000× (селен 0.2 мг × 0.001), поэтому реальные превышения селена и витамина D
 * молча не находились.
 *
 * Теперь предел один — `NUTRIENT_LIMITS_V2`; `SUPPLEMENT_UPPER_LIMITS` — его
 * производный вид. И проверяется ЭЛЕМЕНТАРНОЕ вещество (фактическое количество
 * в таблетке), а не масса соли.
 */
import { describe, it, expect } from 'vitest';
import {
  checkStackToxicity,
  SUPPLEMENT_UPPER_LIMITS,
  elementalMgOf,
} from '../biostack-safety.engine';
import { NUTRIENT_LIMITS_V2 } from '../support-limits';
import { SUPPORT_CATALOG_DATA } from '../../data/support-database';

const cat = (id: string) => (SUPPORT_CATALOG_DATA as any)[id];

describe('UL: единственный источник — реестр NUTRIENT_LIMITS_V2', () => {
  it('числа реестра, а не легаси-таблицы (B6 EFSA, селен EFSA)', () => {
    expect(NUTRIENT_LIMITS_V2.vitamin_b6.kind).toBe('UL');
    expect(SUPPLEMENT_UPPER_LIMITS.vitamin_b6).toBe(12); // было 100 (IOM)
    expect(SUPPLEMENT_UPPER_LIMITS.selenium).toBeCloseTo(0.255, 6); // было 400 мкг
    expect(SUPPLEMENT_UPPER_LIMITS.vitamin_d3).toBeCloseTo(0.1, 6); // 4000 МЕ
    expect(SUPPLEMENT_UPPER_LIMITS.zinc).toBe(40);
    expect(SUPPLEMENT_UPPER_LIMITS.vitamin_c).toBe(2000);
  });

  it('NotEstablished не превращается в UL (креатин)', () => {
    expect(SUPPLEMENT_UPPER_LIMITS.creatine).toBeUndefined();
    expect(checkStackToxicity(['creatine']).some(w => w.severity === 'danger')).toBe(false);
  });

  it('B6 50 мг каталога — настоящее превышение EFSA UL 12 мг', () => {
    const w = checkStackToxicity(['vitamin_b6']);
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe('danger');
    expect(w[0].percentUL).toBe(417);
    expect(w[0].limitText).toBe('12 мг');
    expect(w[0].doseText).toBe('50 мг');
  });
});

describe('UL: пересчёт в элементарное вещество', () => {
  it('микронутриенты не занижаются в 1000×', () => {
    // селен 0.2 мг каталога = 200 мкг = 78 % UL 255 мкг — не «0.0002 мг»
    expect(elementalMgOf('selenium', cat('selenium'))).toBeCloseTo(0.2, 6);
    expect(checkStackToxicity(['selenium'])).toEqual([]);
    // D3: 0.05 мг элементарного = 50 мкг = 2000 МЕ = 50 % UL 4000 МЕ
    expect(elementalMgOf('vitamin_d3', cat('vitamin_d3'))).toBeCloseTo(0.05, 6);
    expect(checkStackToxicity(['vitamin_d3'])).toEqual([]);
  });

  it('магний: 400 мг соли ≈ 64 мг элементарного — не «400 мг»', () => {
    const mg = elementalMgOf('magnesium', cat('magnesium'));
    expect(mg).toBeGreaterThan(55);
    expect(mg).toBeLessThan(70);
    expect(checkStackToxicity(['magnesium']).some(w => w.severity !== 'titrate')).toBe(false);
  });

  it('сумма разных источников одного минерала считается вместе', () => {
    // Два источника магния в стеке = сумма элементарных величин, а не salt-mass.
    const one = elementalMgOf('magnesium', cat('magnesium'));
    const two = checkStackToxicity(['magnesium', 'magnesium']);
    expect(two.every(w => w.severity !== 'danger')).toBe(true);
    expect(one * 2).toBeLessThan(350);
  });
});

describe('UL: тип предела определяет цвет', () => {
  it('SafeLevel (железо) — жёлтое предупреждение, а не «опасно»', () => {
    // 15 источников по 18 мг бисглицината ≈ 43 мг элементарного железа > 40 мг safe level
    const w = checkStackToxicity(Array(15).fill('iron'));
    const ironW = w.find(x => x.substanceId === 'iron');
    expect(ironW).toBeDefined();
    expect(ironW!.severity).toBe('warning');
    expect(ironW!.message).toContain('НЕ порог токсичности');
  });

  it('ClinicalGuidance (NAC) — титрация, а не UL', () => {
    const w = checkStackToxicity(Array(5).fill('nac')); // 5 × 600 мг = 3000 мг > 2400
    const nacW = w.find(x => x.substanceId === 'nac');
    expect(nacW).toBeDefined();
    expect(nacW!.severity).toBe('titrate');
    expect(nacW!.message).toContain('не регуляторный UL');
  });
});
