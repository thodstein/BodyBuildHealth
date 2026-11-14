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
import { doseWindowFor } from '../../../../engines/support-hub-evidence.engine';
import { buildSubstancePassport } from '../../../../engines/support-hub-passport.engine';
import { DOSE_RANGES } from '../SupportEffectiveDose';

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

// ── Системный гард по всем окнам ──
const KEY_TO_NUTRIENT: Record<string, string> = {
  zn: 'zinc', mg: 'magnesium', magnesium: 'magnesium', fe: 'iron', se: 'selenium',
  d3: 'vitamin_d', vitc: 'vitamin_c', iodine: 'iodine', copper: 'copper', ca: 'calcium',
};

describe('THERAPEUTIC_WINDOWS: ни одно окно не молчит', () => {
  it('где предел реестра есть — поле ul совпадает', () => {
    const wrong: string[] = [];
    for (const [key, nutrient] of Object.entries(KEY_TO_NUTRIENT)) {
      const w = THERAPEUTIC_WINDOWS[key];
      const lim = NUTRIENT_LIMITS_V2[nutrient];
      if (!w || !lim) continue;
      if (lim.kind !== 'UL' && lim.kind !== 'SafeLevel') continue;
      // calcium в реестре в мг — окно тоже в мг; остальные совпадают по единице
      if (w.ul !== lim.value) wrong.push(`${key}: ${w.ul} ≠ ${lim.value}`);
    }
    expect(wrong).toEqual([]);
  });

  it('верх выше предела реестра → в note есть «UL» или «Safe Level»', () => {
    const silent = Object.entries(KEY_TO_NUTRIENT)
      .filter(([key, nutrient]) => {
        const w = THERAPEUTIC_WINDOWS[key];
        const lim = NUTRIENT_LIMITS_V2[nutrient];
        if (!w || !lim || !(lim.value > 0)) return false;
        if (lim.kind !== 'UL' && lim.kind !== 'SafeLevel') return false;
        return w.maxMg > w.ul && !/UL|Safe Level/i.test(w.note);
      })
      .map(([k]) => k);
    expect(silent).toEqual([]);
  });
});

// ── Проход 51: тип предела назван словом ──
describe('предел в окне дозы: тип — часть утверждения', () => {
  const win = (id: string) => doseWindowFor(id, THERAPEUTIC_WINDOWS as never, DOSE_RANGES as never);

  it('реестр: UL, Safe Level и клинический ориентир подписаны по-разному', () => {
    expect(win('zinc').limitText).toBe('UL 40 мг');
    expect(win('vitamin_d3').limitText).toBe('UL 4000 МЕ');
    expect(win('iron').limitText).toContain('Safe Level 40 мг');
    expect(win('iron').limitText).toContain('не порог токсичности');
    expect(win('nac').limitText).toContain('2400 мг');
    expect(win('nac').limitText).toContain('не UL');
    expect(win('b12').limitText).toContain('клинический ориентир 2000 мкг');
  });

  it('числа без записи в реестре — потолок протокола, а не UL', () => {
    // Берберин 3000, омега-3 5000, мелатонин 10, EGCG 1200, ашваганда 2000 —
    // регуляторных UL у них нет; паспорт печатал «UL <число>».
    for (const id of ['berberine', 'omega3', 'melatonin', 'egcg', 'ashwagandha']) {
      const w = win(id);
      expect(w.ulKind, id).not.toBe('UL');
      expect(w.ulWarning, id).toBe(false);
      expect(w.limitText, id).toContain('потолок протокола');
      expect(w.limitText, id).toContain('не UL');
    }
  });

  it('паспорт вещества печатает подпись предела, а не «UL null»', () => {
    const passport = buildSubstancePassport({
      id: 'b12', nameRu: 'Витамин B12', maxBio: 0.5,
      therapeutic: THERAPEUTIC_WINDOWS as never, ranges: DOSE_RANGES as never,
      category: ['vitamin'],
    });
    expect(passport.dose.limitText).toContain('клинический ориентир');
    expect(passport.dose.limitText).not.toContain('null');
    const berberine = buildSubstancePassport({
      id: 'berberine', nameRu: 'Берберин', maxBio: 0.3,
      therapeutic: THERAPEUTIC_WINDOWS as never, ranges: DOSE_RANGES as never,
      category: ['herb'],
    });
    expect(berberine.dose.limitText).not.toMatch(/^UL /);
  });
});
