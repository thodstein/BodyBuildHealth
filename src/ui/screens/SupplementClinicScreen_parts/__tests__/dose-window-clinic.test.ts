/**
 * dose-window-clinic.test.ts — проход 51: клиника добавок и паспорт вещества
 * больше не показывают ЧУЖОЕ окно и не печатают предел без типа.
 *
 * Было: карта `WINDOW_BY_ID` подставляла окно другого вещества —
 * витамин E → окно витамина C (90–2000 мг, «UL 2000»), B6 и фолат → окно B12
 * (2.4–1000 мкг), медь → окно цинка (15–50 мг, «UL 40»), калий и ашваганда →
 * окно магния. `DosePanel` к тому же писал КАЖДУЮ дозу в «мг»: витамин D3
 * «2000 мг» вместо 2000 МЕ, B12 «1000 мг» вместо 1000 мкг.
 */
import { describe, it, expect } from 'vitest';
import { getDoseInfo } from '../shared';
import { DEFAULT_DOSAGES } from '../../../../data/support-meta';
import { formatDefaultDose } from '../../../../data/dose-units';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';

describe('клиника добавок: окно дозы из единого резолвера', () => {
  it('витамин E — свой предел 300 мг, а не окно витамина C', () => {
    const e = getDoseInfo('vitamin_e');
    expect(e.window?.limitText).toBe('UL 300 мг');
    expect(e.window?.limitText).not.toContain('2000');
  });

  it('B6 — UL 12 мг, а не окно B12 (мкг)', () => {
    const b6 = getDoseInfo('vitamin_b6');
    expect(b6.window?.limitText).toBe('UL 12 мг');
  });

  it('медь — UL 10 мг, а не окно цинка 40', () => {
    const cu = getDoseInfo('copper');
    expect(cu.window?.limitText).toBe('UL 10 мг');
  });

  it('калий — клинический ориентир 3700 мг, а не окно магния', () => {
    const k = getDoseInfo('potassium');
    expect(k.window?.limitText).toContain('3700 мг');
    expect(k.window?.limitText).toContain('не UL');
  });

  it('ашваганда — без UL: ни окна магния, ни выдуманного предела', () => {
    const a = getDoseInfo('ashwagandha');
    const txt = a.window?.limitText ?? '';
    // Окно из DOSE_RANGES честное, а вот «UL 350 мг» магния быть не должно.
    expect(txt).not.toContain('UL 350');
    expect(a.window?.ulKind === 'UL').toBe(false);
  });

  it('где предел реестра есть — число совпадает с реестром', () => {
    for (const [id, nutrient] of [
      ['zinc', 'zinc'], ['magnesium', 'magnesium'], ['selenium', 'selenium'],
      ['vitamin_d3', 'vitamin_d'], ['iron', 'iron'],
    ] as const) {
      const w = getDoseInfo(id).window;
      expect(w?.ul, id).toBe(NUTRIENT_LIMITS_V2[nutrient].value);
    }
  });
});

describe('клиника добавок: доза в натуральной единице', () => {
  it('D3 — МЕ, селен/фолат/B12 — мкг, а не «мг»', () => {
    expect(formatDefaultDose('vitamin_d3', DEFAULT_DOSAGES.vitamin_d3.mg)).toContain('МЕ');
    expect(formatDefaultDose('selenium', DEFAULT_DOSAGES.selenium.mg)).toContain('мкг');
    expect(formatDefaultDose('folate', DEFAULT_DOSAGES.folate.mg)).toContain('мкг');
    expect(formatDefaultDose('vitamin_b12', DEFAULT_DOSAGES.vitamin_b12.mg)).toContain('мкг');
  });
});
