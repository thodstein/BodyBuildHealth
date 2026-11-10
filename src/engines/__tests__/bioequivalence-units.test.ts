/**
 * bioequivalence-units.test.ts — единица в предупреждении о дозе замены.
 *
 * Аудит 2026-11: текст предупреждения был жёстко «мг», хотя аналог мог
 * быть в мкг/МЕ/млрд КОЕ (D3 5000 = МЕ, селен 200 = мкг). Теперь единицу
 * передаёт вызывающий код — `defaultDoseUnit(id)`.
 */

import { describe, it, expect } from 'vitest';
import { validateReplacementDose } from '../bioequivalence-base';
import { defaultDoseUnit } from '../../data/dose-units';

describe('validateReplacementDose: единица в тексте', () => {
  it('по умолчанию подписывает «мг»', () => {
    const r = validateReplacementDose('magnesium', 'magnesium_glycinate', 400, 100);
    expect(r.isCorrect).toBe(false);
    expect(r.warning).toContain('100 мг');
    expect(r.warning).toContain('400 мг');
  });

  it('использует переданную единицу, а не «мг» для всего', () => {
    const r = validateReplacementDose('magnesium', 'magnesium_glycinate', 400, 50, 'мкг');
    expect(r.warning).toContain('50 мкг');
    expect(r.warning).not.toContain('50 мг');
  });

  it('не предупреждает, когда доза в пределах ±20% от рекомендуемой', () => {
    const r = validateReplacementDose('magnesium', 'magnesium_glycinate', 400, 400, defaultDoseUnit('magnesium_glycinate'));
    expect(r.isCorrect).toBe(true);
    expect(r.warning).toBeUndefined();
    expect(r.doseRatioUsed).toBeCloseTo(1, 5);
  });
});
