/**
 * support-dosing-ul-max.test.ts — проход 38: верхние дозы базы веществ, которые
 * выше предела реестра, — известный и закрытый список.
 *
 * `SUPPORT_DOSING.doseRange.max` — это КЛИНИЧЕСКИЙ верх (дефицит, курс), а не
 * разрешение. Список выше предела фиксируется здесь явно: новая запись выше UL
 * (например, «магний до 1200») упадёт тестом, пока её не подпишут, а каждая
 * запись обязана ловиться UL-контуром (`evaluateLimit` → over), чтобы план не
 * показывал такую дозу как безопасную по умолчанию.
 */
import { describe, it, expect } from 'vitest';
import { SUPPORT_DOSING } from '../../data/support-dosing';
import { DEFAULT_DOSAGES } from '../../data/support-meta';
import { NUTRIENT_LIMITS_V2, evaluateLimit, resolveNutrient } from '../support-limits';

/** Доза записи (её unit) → единица предела реестра. */
function conv(unit: string, v: number, limUnit: string, nutrient: string): number | null {
  const u = String(unit || '').toLowerCase();
  if (u === 'iu' || u === 'ме') {
    if (limUnit === 'iu') return v;
    if (limUnit === 'mg' && nutrient === 'vitamin_e') return v * 0.67;
    if (limUnit === 'mcg') return v / 40;
    return null;
  }
  if (u === 'mcg' || u === 'мкг') return limUnit === 'mcg' ? v : limUnit === 'mg' ? v / 1000 : null;
  if (u === 'mg' || u === 'мг') return limUnit === 'mg' ? v : limUnit === 'mcg' ? v * 1000 : null;
  return null;
}

/** Клинический верх выше UL — осознанные записи (см. шапку файла). */
const KNOWN_ABOVE_UL: Record<string, string> = {
  iron_bisglycinate: 'дефицит ферритина — по анализам, Safe Level 40 не токсический порог',
  magnesium: 'дефицит/по назначению: 400-800 мг элемента (UL 350 — из добавок без показаний)',
  vitamin_d3: 'коррекция дефицита 5000-10000 МЕ 8-12 нед (поддерживающая база 2000, UL 4000)',
  zinc: '50 мг — курсом 8-12 нед с медью (UL 40)',
  vitamin_b6: '25 мг в протоколе с предупреждением (UL добавок 12)',
};

const overRecords = () => {
  const rows: Array<{ id: string; nutrient: string; amount: number }> = [];
  for (const [id, rec] of Object.entries(SUPPORT_DOSING)) {
    const norm = resolveNutrient(id);
    if (!norm) continue;
    const lim = NUTRIENT_LIMITS_V2[norm];
    if (!lim || !(lim.value > 0) || (lim.kind !== 'UL' && lim.kind !== 'SafeLevel')) continue;
    const amount = conv(rec.doseRange.unit, rec.doseRange.max, lim.unit, norm);
    if (amount != null && amount > lim.value) rows.push({ id, nutrient: norm, amount });
  }
  return rows;
};

describe('база веществ: верх выше UL — закрытый список', () => {
  it('список совпадает с известным (новая запись выше UL упадёт здесь)', () => {
    expect(overRecords().map(r => r.id).sort()).toEqual(Object.keys(KNOWN_ABOVE_UL).sort());
  });

  it('каждая такая запись ловится UL-контуром, а не считается безопасной', () => {
    // UL → over; SafeLevel (железо) → по решению проекта НЕ over, но с warn и
    // честной формулировкой «safe level, не порог токсичности».
    const missed = overRecords()
      .filter(r => {
        const v = evaluateLimit(r.nutrient, r.amount);
        const ok = v.over
          || (v.kind === 'SafeLevel' && v.color === 'warn' && /safe level/i.test(v.message))
          || (v.kind === 'ClinicalGuidance' && v.color === 'warn');
        return !ok;
      })
      .map(r => r.id);
    expect(missed).toEqual([]);
  });

  it('в пределах UL — не в списке', () => {
    const ids = overRecords().map(r => r.id);
    expect(ids).not.toContain('selenium');
    expect(ids).not.toContain('vitamin_e');
    expect(ids).not.toContain('folate');
    expect(ids).not.toContain('vitamin_c');
  });
});

describe('базовые дозы плана (DEFAULT_DOSAGES): выше UL — только B6 25', () => {
  const overDefaults = () => {
    const rows: string[] = [];
    for (const [id, d] of Object.entries(DEFAULT_DOSAGES)) {
      const norm = resolveNutrient(id);
      if (!norm) continue;
      const lim = NUTRIENT_LIMITS_V2[norm];
      if (!lim || !(lim.value > 0) || (lim.kind !== 'UL' && lim.kind !== 'SafeLevel')) continue;
      // витамин D в базе плана — МЕ, остальные — единицы реестра
      const unit = norm === 'vitamin_d' ? 'iu' : lim.unit;
      const amount = conv(unit, d.mg, lim.unit, norm);
      if (amount != null && amount > lim.value) rows.push(id);
    }
    return rows;
  };

  it('закрытый список: только vitamin_b6 (решение проекта — 25 мг с предупреждением)', () => {
    expect(overDefaults().sort()).toEqual(['vitamin_b6']);
  });

  it('B6 25 мг ловится UL-контуром как превышение (over 12)', () => {
    const v = evaluateLimit('vitamin_b6', 25);
    expect(v.over).toBe(true);
    expect(v.limit?.value).toBe(NUTRIENT_LIMITS_V2.vitamin_b6.value);
  });
});
