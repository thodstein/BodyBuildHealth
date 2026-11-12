/**
 * plan-ul-actual-doses.test.ts — guard прохода 13 аудита калькулятора поддержки.
 *
 * Дефект, который закрыт: UL-контур плана вызывался с картой титрации
 * (`applyTitration`), а в ней есть только Mg/Zn/D3/Se/VitC/NAC/… — B6, витамин A,
 * K2, фолат, бор, медь и железо туда не попадают. Поэтому план мог назначить
 * 25 мг B6 (EFSA UL 12 мг) или 25 мг P5P и НЕ показать ни одного предупреждения,
 * хотя блок назывался «Пределы доз (UL) по фактическим дозам плана».
 *
 * Второй дефект: витамин A и E подписывались «МЕ», хотя каталог хранит мг —
 * план показывал «1 МЕ» витамина A вместо 3300 МЕ, а UL сравнивался с мг.
 */
import { describe, expect, it } from 'vitest';
import { checkPlanUpperLimits, ulLimitKeyOf } from '../support-plan/engine-helpers';
import { NUTRIENT_UL } from '../support-plan/types';

describe('UL по фактическим дозам плана', () => {
  it('B6 25 мг из плана попадает в UL-контур (EFSA UL 12 мг)', () => {
    const w = checkPlanUpperLimits(['vitamin_b6'], { vitamin_b6: 25 });
    expect(w).toHaveLength(1);
    expect(w[0].ulMg).toBe(NUTRIENT_UL['vitamin_b6']);
    expect(w[0].ulMg).toBe(12);
    expect(w[0].percentUL).toBe(208);
    expect(w[0].limitKind).toBe('UL');
    expect(w[0].recommendation).toContain('12 мг');
  });

  it('B6 в пределах UL — без предупреждения', () => {
    expect(checkPlanUpperLimits(['vitamin_b6'], { vitamin_b6: 10 })).toHaveLength(0);
    expect(checkPlanUpperLimits(['vitamin_b6'], { vitamin_b6: 12 })).toHaveLength(0);
  });

  it('P5P — активная форма B6, проверяется по тому же UL', () => {
    expect(ulLimitKeyOf('p5p')).toBe('vitamin_b6');
    const w = checkPlanUpperLimits(['p5p'], { p5p: 25 });
    expect(w).toHaveLength(1);
    expect(w[0].substanceId).toBe('p5p');
    expect(w[0].ulMg).toBe(12);
  });

  it('витамин D: план в МЕ, реестр в мкг — 2000 МЕ ok, 8000 МЕ превышение', () => {
    expect(checkPlanUpperLimits(['vitamin_d3'], { vitamin_d3: 2000 })).toHaveLength(0);
    const w = checkPlanUpperLimits(['vitamin_d3'], { vitamin_d3: 8000 });
    expect(w).toHaveLength(1);
    expect(w[0].ulMg).toBe(100); // 4000 МЕ = 100 мкг
    expect(w[0].percentUL).toBe(200);
  });

  it('витамин A: план в мкг RAE, UL 3000 мкг', () => {
    expect(checkPlanUpperLimits(['vitamin_a'], { vitamin_a: 1000 })).toHaveLength(0);
    const w = checkPlanUpperLimits(['vitamin_a'], { vitamin_a: 6000 });
    expect(w).toHaveLength(1);
    expect(w[0].ulMg).toBe(3000);
    expect(w[0].recommendation).toContain('UL');
  });

  it('витамин E: план в мг, UL 300 мг', () => {
    expect(checkPlanUpperLimits(['vitamin_e'], { vitamin_e: 200 })).toHaveLength(0);
    const w = checkPlanUpperLimits(['vitamin_e'], { vitamin_e: 600 });
    expect(w).toHaveLength(1);
    expect(w[0].ulMg).toBe(300);
  });

  it('алиас канонизируется: selenium_yeast проверяется как селен', () => {
    expect(ulLimitKeyOf('selenium_yeast')).toBe('selenium');
    const w = checkPlanUpperLimits(['selenium_yeast'], { selenium_yeast: 400 });
    expect(w).toHaveLength(1);
    expect(w[0].ulMg).toBe(NUTRIENT_UL['selenium']);
  });

  it('SafeLevel железа не подписывается как «превышение UL»', () => {
    const w = checkPlanUpperLimits(['iron'], { iron: 60 });
    expect(w).toHaveLength(1);
    expect(w[0].limitKind).toBe('SafeLevel');
    expect(w[0].risk).toContain('НЕ порог токсичности');
    expect(w[0].recommendation).toContain('safe level');
  });

  it('клинические ориентиры (NAC, B12) не выдаются за UL', () => {
    // NAC 2400 мг и B12 2000 мкг — ClinicalGuidance, а не регуляторный предел.
    expect(checkPlanUpperLimits(['nac'], { nac: 3000 })).toHaveLength(0);
    expect(checkPlanUpperLimits(['vitamin_b12'], { vitamin_b12: 5000 })).toHaveLength(0);
  });

  it('капаная доза показывается отдельно от расчётной', () => {
    const w = checkPlanUpperLimits(['magnesium'], { magnesium: 800 }, { magnesium: 350 });
    expect(w).toHaveLength(1);
    expect(w[0].currentDoseMg).toBe(800);
    expect(w[0].appliedDoseMg).toBe(350);
    expect(w[0].recommendation).toContain('ограничено до');
  });

  it('нулевые/отсутствующие дозы не создают предупреждений', () => {
    expect(checkPlanUpperLimits(['vitamin_b6'], {})).toHaveLength(0);
    expect(checkPlanUpperLimits(['vitamin_b6'], { vitamin_b6: 0 })).toHaveLength(0);
  });
});
