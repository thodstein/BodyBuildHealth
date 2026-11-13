/**
 * therapeutic-windows-ul.test.ts — проход 35: окна «Биодоступности» не
 * обещают дозу выше UL без подписи и не расходятся с правилом меди.
 *
 * Было: цинк — «UL 40 мг. >50 мг → дефицит Cu», хотя правило приложения —
 * медь обязательна уже с 25 мг/сут (кросс-кап и баннеры); магний — opt 400 мг
 * при UL 350 без пометки, что 400+ только по назначению.
 */
import { describe, it, expect } from 'vitest';
import { THERAPEUTIC_WINDOWS } from '../SupportBioavailabilityData';
import { NUTRIENT_LIMITS_V2 } from '../../../../engines/support-limits';

describe('THERAPEUTIC_WINDOWS: предел и оговорки', () => {
  it('ul совпадает с реестром (Zn 40, Mg 350, Se 255, D 4000)', () => {
    expect(THERAPEUTIC_WINDOWS.zn.ul).toBe(NUTRIENT_LIMITS_V2.zinc.value);
    expect(THERAPEUTIC_WINDOWS.mg.ul).toBe(NUTRIENT_LIMITS_V2.magnesium.value);
    expect(THERAPEUTIC_WINDOWS.se.ul).toBe(NUTRIENT_LIMITS_V2.selenium.value);
    expect(THERAPEUTIC_WINDOWS.d3.ul).toBe(NUTRIENT_LIMITS_V2.vitamin_d.value);
  });

  it('цинк: медь обязательна с 25 мг/сут, а не только после 50', () => {
    expect(THERAPEUTIC_WINDOWS.zn.note).toContain('≥25 мг/сут');
    expect(THERAPEUTIC_WINDOWS.zn.note).toContain('ОБЯЗАТЕЛЬНА');
  });

  it('магний: opt 400 выше UL 350 — подписан как «по назначению»', () => {
    expect(THERAPEUTIC_WINDOWS.mg.optMg).toBeGreaterThan(THERAPEUTIC_WINDOWS.mg.ul);
    expect(THERAPEUTIC_WINDOWS.mg.note).toContain('выше UL');
    expect(THERAPEUTIC_WINDOWS.mg.note).toContain('по назначению');
  });

  it('селен: действующий UL 255, старое 400 названо старым', () => {
    expect(THERAPEUTIC_WINDOWS.se.note).toContain('255');
    expect(THERAPEUTIC_WINDOWS.se.note).toContain('старый IOM');
  });
});
