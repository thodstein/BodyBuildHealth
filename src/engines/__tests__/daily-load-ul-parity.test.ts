/**
 * daily-load-ul-parity.test.ts — guard прохода 16 аудита калькулятора поддержки.
 *
 * Дефект: «Суммарная нагрузка / UL» (`aggregateDailyLoad`) считалась по карте
 * титрации, а в ней только Mg/Zn/D3/Se/VitC/NAC/… Поэтому:
 *  - B6 25 мг (EFSA UL 12 мг), витамин A, K2, фолат, бор, медь, железо не попадали
 *    в сводку вовсе — UL-блок рядом предупреждал, а сводка молчала;
 *  - алиасы (`selenium_yeast`, `p5p`) не канонизировались — вместо суммы два ряда;
 *  - ClinicalGuidance (NAC 2400, CoQ10, B12, K2, калий) выдавались за UL.
 *
 * Теперь источник доз — те же `planDoses`, что у UL-проверки, через общий
 * `planDosesInUlScale` (D3: МЕ→мкг); учитываются только истинные UL.
 */
import { describe, expect, it } from 'vitest';
import { aggregateDailyLoad, planDosesInUlScale } from '../support-plan/engine-helpers';
import { NUTRIENT_UL } from '../support-plan/types';

describe('planDosesInUlScale', () => {
  it('витамин D: МЕ → мкг (2000 МЕ = 50 мкг)', () => {
    expect(planDosesInUlScale({ vitamin_d3: 2000 }).vitamin_d3).toBe(50);
    expect(planDosesInUlScale({ vitamin_d3: 4000 }).vitamin_d3).toBe(100);
  });

  it('остальные дозы не пересчитываются (уже в единице реестра)', () => {
    expect(planDosesInUlScale({ magnesium: 200, selenium: 50, vitamin_a: 1000 })).toEqual({
      magnesium: 200, selenium: 50, vitamin_a: 1000,
    });
  });

  it('нулевые и нечисловые дозы отбрасываются', () => {
    expect(planDosesInUlScale({ magnesium: 0, zinc: Number.NaN, iron: -5 })).toEqual({});
  });
});

describe('aggregateDailyLoad по фактическим дозам плана', () => {
  it('B6 25 мг виден в нагрузке (раньше не титровался — не было в сводке)', () => {
    const load = aggregateDailyLoad(['vitamin_b6'], { vitamin_b6: 25 });
    expect(load.vitamin_b6.totalMg).toBe(25);
    expect(load.vitamin_b6.ulMg).toBe(NUTRIENT_UL['vitamin_b6']);
    expect(load.vitamin_b6.ulMg).toBe(12);
    expect(load.vitamin_b6.contributors).toEqual(['vitamin_b6']);
  });

  it('P5P складывается с B6 в один нутриент', () => {
    const load = aggregateDailyLoad(['p5p', 'vitamin_b6'], { p5p: 25, vitamin_b6: 10 });
    expect(load.vitamin_b6.totalMg).toBe(35);
    expect(load.vitamin_b6.contributors).toEqual(['p5p', 'vitamin_b6']);
  });

  it('алиас selenium_yeast канонизируется и суммируется с selenium', () => {
    const load = aggregateDailyLoad(['selenium_yeast', 'selenium'], { selenium_yeast: 200, selenium: 50 });
    expect(load.selenium.totalMg).toBe(250);
    expect(load.selenium.ulMg).toBe(255);
    expect(load.selenium.contributors).toEqual(['selenium_yeast', 'selenium']);
  });

  it('D3 в МЕ переводится в мкг: 2000 МЕ = 50 мкг (50 % UL), а не 2000 %', () => {
    const load = aggregateDailyLoad(['vitamin_d3'], { vitamin_d3: 2000 });
    expect(load.vitamin_d3.totalMg).toBe(50);
    expect(load.vitamin_d3.ulMg).toBe(100);
  });

  it('если титрация капнула дозу — в нагрузку идёт фактический приём', () => {
    const load = aggregateDailyLoad(['vitamin_d3'], { vitamin_d3: 8000 }, { vitamin_d3: 100 });
    expect(load.vitamin_d3.totalMg).toBe(100);
    const mg = aggregateDailyLoad(['magnesium'], { magnesium: 800 }, { magnesium: 350 });
    expect(mg.magnesium.totalMg).toBe(350);
    expect(mg.magnesium.ulMg).toBe(350);
  });

  it('ClinicalGuidance и SafeLevel в «нагрузку / UL» не попадают', () => {
    const load = aggregateDailyLoad(
      ['nac', 'coq10', 'vitamin_b12', 'vitamin_k2', 'potassium', 'chromium', 'iron'],
      { nac: 1800, coq10: 100, vitamin_b12: 500, vitamin_k2: 200, potassium: 200, chromium: 200, iron: 45 },
    );
    expect(load).toEqual({});
  });

  it('вещества без UL (креатин) не создают строку', () => {
    expect(aggregateDailyLoad(['creatine'], { creatine: 5000 })).toEqual({});
  });

  it('витамин A: 6000 мкг против UL 3000', () => {
    const load = aggregateDailyLoad(['vitamin_a'], { vitamin_a: 6000 });
    expect(load.vitamin_a.totalMg).toBe(6000);
    expect(load.vitamin_a.ulMg).toBe(3000);
  });
});
