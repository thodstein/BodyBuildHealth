/**
 * dose-units.test.ts — guard единиц дозирования.
 *
 * Аудит 2026-11: UI подписывал ВСЁ как «мг», поэтому 200 мкг селена
 * показывались как «200 мг» (ошибка 1000×), а 5000 МЕ витамина D — как
 * «5000 мг». Единица должна определяться веществом, а не быть константой.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultDoseUnit,
  doseUnit,
  formatDefaultDose,
  formatDose,
  formatDoseFromMg,
  naturalFromMg,
  toMgEquivalent,
} from '../dose-units';

describe('doseUnit', () => {
  it('микронутриенты — мкг', () => {
    expect(doseUnit('selenium')).toBe('мкг');
    expect(doseUnit('vitamin_b12')).toBe('мкг');
    expect(doseUnit('folate')).toBe('мкг');
    expect(doseUnit('clenbuterol')).toBe('мкг');
  });

  it('гормоны — МЕ', () => {
    expect(doseUnit('hcg')).toBe('МЕ');
    expect(doseUnit('hgh')).toBe('МЕ');
  });

  it('витамины A/E — единицы реестра пределов (мкг/мг), не МЕ', () => {
    // Аудит 2026-11 (проход 13): каталог хранит мг, а подпись была «МЕ» →
    // витамин A показывался как «1 МЕ» вместо 3300 МЕ (ошибка 3300×).
    expect(doseUnit('vitamin_a')).toBe('мкг');
    expect(doseUnit('vitamin_e')).toBe('мг');
    expect(doseUnit('vitamin_d3')).toBe('мкг');
  });

  it('инсулины — Ед, пробиотики — млрд КОЕ, остальное — мг', () => {
    expect(doseUnit('ins_short')).toBe('Ед');
    expect(doseUnit('probiotics')).toBe('млрд КОЕ');
    expect(doseUnit('nac')).toBe('мг');
    expect(doseUnit('creatine')).toBe('мг');
    // Фибринолитики дозируются в мг (100 мг ≈ 2000 ФЕ) — не «ФЕ».
    expect(doseUnit('nattokinase')).toBe('мг');
    expect(doseUnit('serrapeptase')).toBe('мг');
  });
});

describe('formatDose', () => {
  it('селен 200 мкг — не «200 мг»', () => {
    expect(formatDose('selenium', 200)).toBe('200 мкг');
  });

  it('витамин D: ≥1000 МЕ показываем в МЕ, малые дозы — в мкг', () => {
    expect(formatDose('vitamin_d3', 25)).toBe('1000 МЕ');
    expect(formatDose('vitamin_d3', 12.5)).toBe('12.5 мкг');
  });

  it('подписывает МЕ / Ед / мг / млрд КОЕ', () => {
    expect(formatDose('hcg', 500)).toBe('500 МЕ');
    expect(formatDose('ins_short', 10)).toBe('10 Ед');
    expect(formatDose('nattokinase', 100)).toBe('100 мг');
    expect(formatDose('probiotics', 20)).toBe('20 млрд КОЕ');
    expect(formatDose('nac', 600)).toBe('600 мг');
  });

  it('пустая/нулевая доза — прочерк, а не «0 мг»', () => {
    expect(formatDose('nac', 0)).toBe('—');
    expect(formatDose('nac', Number.NaN)).toBe('—');
  });
});

describe('formatDoseFromMg (каталожные dosage.mg)', () => {
  it('мкг-вещества: мг каталога → мкг', () => {
    // Каталог: selenium dosage.mg = 0.2 (0.2 мг = 200 мкг)
    expect(formatDoseFromMg('selenium', 0.2)).toBe('200 мкг');
    expect(formatDoseFromMg('vitamin_b12', 0.001)).toBe('1 мкг');
  });

  it('витамин D: 0.125 мг = 125 мкг = 5000 МЕ', () => {
    expect(formatDoseFromMg('vitamin_d3', 0.125)).toBe('5000 МЕ');
    // <1000 МЕ показываем в мкг (как и formatDose): 0.0125 мг = 12.5 мкг = 500 МЕ.
    expect(formatDoseFromMg('vitamin_d3', 0.0125)).toBe('12.5 мкг');
  });

  it('мг-вещества: мг как есть, крупные — в граммах', () => {
    expect(formatDoseFromMg('nac', 600)).toBe('600 мг');
    expect(formatDoseFromMg('vitamin_c', 1000)).toBe('1 г');
    expect(formatDoseFromMg('nattokinase', 100)).toBe('100 мг');
  });

  it('витамин A/E: мг каталога → мкг RAE / мг α-токоферола', () => {
    // Каталог: vitamin_a dosage.mg = 1 (1 мг ретинола = 1000 мкг RAE ≈ 3300 МЕ).
    expect(formatDoseFromMg('vitamin_a', 1)).toBe('1000 мкг');
    // vitamin_e dosage.mg = 200 (200 мг α-токоферола ≈ 300 МЕ).
    expect(formatDoseFromMg('vitamin_e', 200)).toBe('200 мг');
  });

  it('МЕ / млрд КОЕ — значение уже в натуральной единице', () => {
    expect(formatDoseFromMg('hcg', 500)).toBe('500 МЕ');
    expect(formatDoseFromMg('probiotics', 20)).toBe('20 млрд КОЕ');
  });

  it('нулевое значение — прочерк', () => {
    expect(formatDoseFromMg('selenium', 0)).toBe('—');
  });
});

describe('formatDefaultDose / defaultDoseUnit', () => {
  it('значения DEFAULT_DOSAGES подписываются их натуральной единицей', () => {
    expect(defaultDoseUnit('vitamin_d3')).toBe('МЕ');
    expect(formatDefaultDose('vitamin_d3', 2000)).toBe('2000 МЕ');
    expect(formatDefaultDose('selenium', 200)).toBe('200 мкг');
    expect(formatDefaultDose('nac', 600)).toBe('600 мг');
    expect(formatDefaultDose('probiotics', 20)).toBe('20 млрд КОЕ');
    // A/E — единицы реестра UL, а не МЕ.
    expect(defaultDoseUnit('vitamin_a')).toBe('мкг');
    expect(defaultDoseUnit('vitamin_e')).toBe('мг');
    expect(formatDefaultDose('vitamin_e', 200)).toBe('200 мг');
    // Крупные миллиграммы — в граммах.
    expect(formatDefaultDose('collagen', 5000)).toBe('5 г');
  });
});

describe('naturalFromMg — мг каталога → натуральная единица плана', () => {
  it('витамин A/E больше не остаются «в мг» под видом МЕ', () => {
    expect(naturalFromMg('vitamin_a', 1)).toBe(1000);   // мкг RAE
    expect(naturalFromMg('vitamin_e', 200)).toBe(200);  // мг α-токоферола
    expect(naturalFromMg('vitamin_d3', 0.05)).toBe(2000); // МЕ
  });
});

describe('toMgEquivalent', () => {
  it('мкг → мг, мг → мг', () => {
    expect(toMgEquivalent('selenium', 200)).toBeCloseTo(0.2, 10);
    expect(toMgEquivalent('vitamin_d3', 50)).toBeCloseTo(0.05, 10);
    expect(toMgEquivalent('vitamin_a', 1000)).toBeCloseTo(1, 10);
    expect(toMgEquivalent('vitamin_e', 200)).toBe(200);
    expect(toMgEquivalent('nac', 600)).toBe(600);
  });

  it('МЕ/млрд КОЕ не конвертируем', () => {
    expect(toMgEquivalent('hcg', 500)).toBeUndefined();
    expect(toMgEquivalent('probiotics', 20)).toBeUndefined();
  });
});
