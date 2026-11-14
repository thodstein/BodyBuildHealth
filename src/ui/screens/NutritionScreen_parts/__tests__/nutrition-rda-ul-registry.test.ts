/**
 * nutrition-rda-ul-registry.test.ts — проход 52: пределы в справочнике питания
 * берутся из ЕДИНОГО реестра (`NUTRIENT_LIMITS_V2`), а не из легаси-таблицы.
 *
 * Было: таблица RDA/UL (`nutrition-reference-data.ts`) держала свою пятую копию
 * пределов и расходилась с калькулятором поддержки — селен «400 мкг» (реестр 255,
 * EFSA 2023), железо «45 мг» как UL (реестр: safe level 40, UL не установлен),
 * йод «600 мкг» (реестр 1100), калий «нет» (реестр: клинический ориентир 3700),
 * витамин D «100 мкг» вместо 4000 МЕ.
 */
import { describe, it, expect } from 'vitest';
import { RDA_ROWS } from '../nutrition-reference-data';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';
import { MICRONUTRIENT_TARGETS } from '../../../../core/constants';

const row = (name: string) => RDA_ROWS.find((r) => r.nutrient.includes(name));

describe('справочник питания: UL из реестра', () => {
  it('селен — 255 мкг (EFSA 2023), а не 400', () => {
    expect(row('Селен')?.ul).toContain('255 мкг');
    expect(row('Селен')?.ul).not.toContain('400');
  });

  it('железо — safe level 40 мг, а не «UL 45 мг»', () => {
    const u = row('Железо')?.ul || '';
    expect(u).toContain('40 мг');
    expect(u).toContain('Safe Level');
    expect(u).toContain('не порог токсичности');
    expect(u).not.toContain('45');
  });

  it('йод — 1100 мкг (реестр), а не 600', () => {
    expect(row('Йод')?.ul).toContain('1100 мкг');
  });

  it('B12 и калий — клинический ориентир, а не «нет предела»', () => {
    expect(row('B12')?.ul).toContain('клинический ориентир');
    expect(row('B12')?.ul).toContain('не UL');
    expect(row('Калий')?.ul).toContain('3700 мг');
    expect(row('Калий')?.ul).toContain('не UL');
  });

  it('витамин D — 4000 МЕ (= 100 мкг), как во всём приложении', () => {
    expect(row('Витамин D')?.ul).toContain('4000 МЕ');
    expect(row('Витамин D')?.ul).toContain('100 мкг');
  });

  it('числа строк совпадают с реестром', () => {
    const map: Array<[string, string]> = [
      ['Витамин C', 'vitamin_c'],
      ['Магний', 'magnesium'],
      ['Цинк', 'zinc'],
      ['Кальций', 'calcium'],
      ['Витамин A', 'vitamin_a'],
    ];
    for (const [name, key] of map) {
      expect(row(name)?.ul, name).toContain(String(NUTRIENT_LIMITS_V2[key].value));
    }
  });

  it('легаси-числа IOM не вернулись в таблицу', () => {
    const all = RDA_ROWS.map((r) => r.ul).join(' | ');
    expect(all).not.toContain('45 мг');
    expect(all).not.toContain('400 мкг');
    expect(all).not.toContain('600 мкг');
  });

  it('в целях микронутриентов своих пределов нет (предел — только реестр)', () => {
    // Шестая копия (`upperLimit`: Mg 700, D 10000 МЕ, B12 50, Fe 45) не читалась
    // нигде, но оставалась в коде как ложный источник чисел.
    for (const [key, v] of Object.entries(MICRONUTRIENT_TARGETS)) {
      expect(Object.keys(v), key).toEqual(['amount', 'unit']);
    }
  });
});
