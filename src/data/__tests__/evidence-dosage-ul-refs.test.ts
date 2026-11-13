/**
 * evidence-dosage-ul-refs.test.ts — проход 33: справка «Эффективная доза»
 * называет тот же предел, что реестр (`NUTRIENT_LIMITS_V2`).
 *
 * Было: витамин E — «UL 1000 мг (1500 МЕ)» (IOM 2004) при действующем в
 * приложении EFSA 300 мг; селен — «UL 400 мкг» (IOM 2000) при EFSA 255.
 * Пользователь читал в справке один предел, а UL-контур сравнивал с другим.
 * Диапазоны (opt/max) выше UL оставлены как клинические, но обязаны нести
 * предупреждение рядом.
 */
import { describe, it, expect } from 'vitest';
import { EVIDENCE_DOSAGES } from '../evidence-dosage-db';
import { NUTRIENT_LIMITS_V2, resolveNutrient } from '../../engines/support-limits';

const refs = (id: string) => (EVIDENCE_DOSAGES[id]?.references || []).join(' | ');
const notes = (id: string) => EVIDENCE_DOSAGES[id]?.notes || '';

/** Доза записи (её `unit`) → единица предела реестра. */
function toLimitUnit(unit: string, v: number, limitUnit: string, nutrient: string): number | null {
  const u = String(unit || '').toLowerCase();
  if (u === 'ме' || u === 'iu') {
    if (limitUnit === 'iu') return v;
    if (limitUnit === 'mg' && nutrient === 'vitamin_e') return v * 0.67; // 1 МЕ d-α-токоферола
    if (limitUnit === 'mcg') return v / 40; // витамин D
    return null;
  }
  if (u.startsWith('мкг') || u === 'mcg' || u === 'µg') {
    if (limitUnit === 'mcg') return v;
    if (limitUnit === 'mg') return v / 1000;
    return null;
  }
  if (u.startsWith('мг') || u === 'mg') {
    if (limitUnit === 'mg') return v;
    if (limitUnit === 'mcg') return v * 1000;
    return null;
  }
  return null;
}

describe('справка доз: предел = реестр', () => {
  it('витамин E — 300 мг (EFSA) — действующий, 1000 мг помечен как прежний', () => {
    const r = refs('vitamin_e');
    expect(r).toContain(`${NUTRIENT_LIMITS_V2.vitamin_e.value} мг`);
    expect(r.indexOf('EFSA')).toBeLessThan(r.indexOf('IOM'));
    expect(r).toContain('прежняя');
  });

  it('селен — 255 мкг (EFSA 2023) — действующий, 400 помечен как прежний', () => {
    const r = refs('selenium');
    expect(r).toContain(`${NUTRIENT_LIMITS_V2.selenium.value} мкг`);
    expect(r.indexOf('EFSA')).toBeLessThan(r.indexOf('IOM'));
    expect(r).toContain('прежняя');
  });

  it('цинк и магний называют UL 40 и 350', () => {
    expect(refs('zinc')).toContain(`${NUTRIENT_LIMITS_V2.zinc.value} мг`);
    expect(refs('magnesium')).toContain(`${NUTRIENT_LIMITS_V2.magnesium.value}`);
  });

  it('железо — Safe Level 40 (EFSA), IOM 45 помечен как прежняя оценка', () => {
    const r = refs('iron');
    expect(r).toContain('Safe Level');
    expect(r).toContain(`${NUTRIENT_LIMITS_V2.iron.value} мг`);
    expect(r).toContain('прежняя');
    expect(notes('copper')).toContain('≥25 мг/сут');
  });

  it('витамин D — 4000 МЕ', () => {
    expect(notes('vitamin_d3')).toContain('UL 4000');
  });
});

describe('справка доз: диапазон выше UL подписан', () => {
  it('витамин E: 800 МЕ выше UL 300 мг — есть предупреждение', () => {
    expect(notes('vitamin_e')).toContain('выше UL');
  });

  it('селен: max 400 выше UL 255 мкг — есть предупреждение', () => {
    expect(notes('selenium')).toContain('выше действующего UL');
  });

  it('магний и цинк: клинический верх выше UL — есть предупреждение', () => {
    expect(notes('magnesium')).toContain('выше UL добавок 350');
    expect(notes('zinc')).toContain('UL 40 мг/сут');
  });
});

// ── Системный гард: любая запись выше предела обязана это сказать ──
describe('справка доз: ни одна запись выше UL не молчит', () => {
  it('maxMg/optMg выше предела реестра → в note есть «UL» или «Safe Level»', () => {
    const silent: string[] = [];
    for (const [id, e] of Object.entries(EVIDENCE_DOSAGES)) {
      const norm = resolveNutrient(id);
      if (!norm) continue;
      const lim = NUTRIENT_LIMITS_V2[norm];
      if (!lim || !(lim.value > 0) || (lim.kind !== 'UL' && lim.kind !== 'SafeLevel')) continue;
      const max = toLimitUnit(e.unit, e.maxMg, lim.unit, norm);
      const opt = toLimitUnit(e.unit, e.optMg, lim.unit, norm);
      const over = (max != null && max > lim.value) || (opt != null && opt > lim.value);
      if (!over) continue;
      const n = e.notes || '';
      if (!/UL|Safe Level/i.test(n)) silent.push(`${id} (max ${max} ${opt} vs ${lim.value})`);
    }
    expect(silent).toEqual([]);
  });
});
