/**
 * calc-sub-dosage-units.test.ts — «subDosage отдаёт НАТУРАЛЬНУЮ единицу».
 *
 * Аудит 2026-11: `subDosage` предпочитала каталожную дозу (`dosage.mg` —
 * МИЛЛИГРАММЫ), а потребители подписывали её `formatDefaultDose` /
 * сравнивали с фактическим приёмом, которые работают в натуральной единице
 * (мкг/МЕ). Итог: селен «0.2 мкг» вместо 200 мкг, витамин D «0.13 МЕ»
 * вместо 2000 МЕ, а биотин считался перекрытым приёмом 5 мкг.
 */
import { describe, it, expect } from 'vitest';
import { subDosage } from '../Calc.mapper';
import { formatDefaultDose } from '../../../../data/dose-units';

describe('subDosage: натуральная единица, а не мг каталога', () => {
  it('селен: 0.2 мг каталога → 200 (мкг)', () => {
    const d = subDosage('selenium');
    expect(d?.mg).toBe(200);
    expect(formatDefaultDose('selenium', d!.mg)).toBe('200 мкг');
  });

  it('витамин D3: 0.05 мг каталога → 2000 (МЕ)', () => {
    const d = subDosage('vitamin_d3');
    expect(d?.mg).toBe(2000);
    expect(formatDefaultDose('vitamin_d3', d!.mg)).toBe('2000 МЕ');
  });

  it('биотин: 5 мг каталога → 5000 мкг', () => {
    const d = subDosage('biotin');
    expect(d?.mg).toBe(5000);
    expect(formatDefaultDose('biotin', d!.mg)).toBe('5000 мкг');
  });

  it('мг-вещества не меняются (NAC 600 мг)', () => {
    const d = subDosage('nac');
    expect(d?.mg).toBe(600);
    expect(formatDefaultDose('nac', d!.mg)).toBe('600 мг');
  });

  it('неизвестное вещество — null, а не выдуманная доза', () => {
    expect(subDosage('__нет_такого__')).toBe(null);
  });
});
