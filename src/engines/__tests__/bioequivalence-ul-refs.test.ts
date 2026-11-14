/**
 * bioequivalence-ul-refs.test.ts — проход 34: подписи форм в «Биодоступности»
 * называют предел реестра (`NUTRIENT_LIMITS_V2`), а не старую оценку IOM.
 *
 * Было: P5P — «UL 100 мг» при действующей EFSA 12 мг (в 8 раз строже),
 * селен — «UL 400 мкг» при EFSA 255, железо — «UL = 45» при Safe Level 40
 * (и это не порог токсичности, а уровень без наблюдаемых эффектов).
 */
import { describe, it, expect } from 'vitest';
import { FORM_PROFILES } from '../bioequivalence-base';
import { NUTRIENT_LIMITS_V2 } from '../support-limits';

const notes = (id: string) => FORM_PROFILES[id]?.notes || '';

describe('подписи форм: предел = реестр', () => {
  it('P5P: UL добавок B6 = 12 мг (EFSA), 100 мг — прежняя оценка', () => {
    const n = notes('b6_p5p_form');
    expect(n).toContain(`${NUTRIENT_LIMITS_V2.vitamin_b6.value} мг`);
    expect(n).toContain('прежняя оценка IOM');
  });

  it('селен: UL 255 мкг (EFSA 2023), 400 — прежняя оценка', () => {
    const n = notes('se_selenomethionine_form');
    expect(n).toContain(`${NUTRIENT_LIMITS_V2.selenium.value} мкг`);
    expect(n).toContain('прежняя оценка IOM');
  });

  it('железо: Safe Level 40 мг, а не «UL 45»', () => {
    const n = notes('iron_sulfate_form') || notes('iron_bisglycinate_form');
    expect(n).toContain('Safe Level');
    expect(n).toContain(`${NUTRIENT_LIMITS_V2.iron.value} мг`);
    expect(n).toContain('НЕ порог токсичности');
  });

  it('цинк: UL 40 мг — паритет с реестром', () => {
    expect(notes('zinc_picolinate_form')).toContain(`${NUTRIENT_LIMITS_V2.zinc.value} мг`);
  });

  it('витамин D3: UL 4000 МЕ, 10000 — только коррекция дефицита', () => {
    const n = notes('vitamin_d3_cholecalciferol_form');
    expect(n).toContain(`${NUTRIENT_LIMITS_V2.vitamin_d.value} МЕ`);
    expect(n).toContain('дефицит');
    // 10000 без привязки к дефициту читалось как «безопасный верх».
    expect(n).not.toMatch(/Верх:?\s*10000/);
  });

  it('NAC: 2400 — клинический ориентир, а не «UL 3000»', () => {
    const n = notes('nac_n_form');
    expect(n).toContain('2400');
    expect(n).toContain('не UL');
    expect(n).not.toMatch(/UL:?\s*3000/);
  });
});
