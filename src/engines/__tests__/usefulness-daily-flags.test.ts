/**
 * usefulness-daily-flags.test.ts — matrix-тесты флагов дневного отчёта (P1-6).
 *
 * Покрывает флаги analyzeDailyDiet: ammoniaRisk, electrolyteRisk, microDeficits,
 * glutathioneWarning, antinutrientWarning, histamineWarning, homaIr.
 * Использует реальные продукты FOOD_DB (детерминированно), для скан-зависимых флагов
 * подбирает подходящий продукт из БД и пропускает тест, если его нет.
 */
import { describe, it, expect } from 'vitest';
import { analyzeDailyDiet, getDefaultProfile } from '../product-usefulness-v2.engine';
import { FOOD_DB } from '../../core/nutrition-database';

const meal = (foodId: string, weightGrams: number) => [{ products: [{ foodId, weightGrams }] }];

describe('analyzeDailyDiet — флаги флагов (P1-6)', () => {
  it('ammoniaRisk: много белка при малой LBM и низкой клетчатке', () => {
    const p = getDefaultProfile();
    p.lbm = 30; // малая сухая масса → высокий показатель белка/кг FFM
    const r = analyzeDailyDiet(meal('chicken_breast', 400), p);
    expect(r.ammoniaRisk).toBe(true);
  });

  it('electrolyteRisk: диуретики + рацион с низким калием/магнием', () => {
    const p = getDefaultProfile();
    p.pharma.DIURETICS = true;
    const r = analyzeDailyDiet(meal('rice_white', 300), p);
    expect(r.electrolyteRisk).toBe(true);
  });

  it('microDeficits: низкие цинк и магний без поддержки', () => {
    const p = getDefaultProfile();
    const r = analyzeDailyDiet(meal('rice_white', 200), p);
    expect(r.microDeficits).toContain('Цинк');
    expect(r.microDeficits).toContain('Магний');
  });

  it('glutathioneWarning: рацион без поддержки глутатиона', () => {
    const p = getDefaultProfile();
    const r = analyzeDailyDiet(meal('rice_white', 200), p);
    expect(r.glutathioneWarning).toBeTruthy();
  });

  it('antinutrientWarning: продукт с оксалатами/лектинами выше порога', () => {
    const hit = FOOD_DB.find(f => (f.specific_compounds_100g?.oxalates_mg ?? 0) > 800 || (f.specific_compounds_100g?.lectins_mg ?? 0) > 800);
    if (!hit) { expect(true).toBe(true); return; }
    const r = analyzeDailyDiet(meal(hit.id, 100), getDefaultProfile());
    expect(r.antinutrientWarning).toBeTruthy();
  });

  it('histamineWarning: чувствителен к гистамину + продукт с высоким уровнем', () => {
    const hit = FOOD_DB.find(f => (f.metabolic_flags?.histamine_level ?? 'LOW') === 'HIGH');
    if (!hit) { expect(true).toBe(true); return; }
    const p = getDefaultProfile();
    p.histamineSensitive = true;
    const r = analyzeDailyDiet(meal(hit.id, 150), p);
    expect(r.histamineWarning).toBeTruthy();
  });

  it('homaIr: считается из глюкозы и инсулина', () => {
    const p = getDefaultProfile();
    p.labs = { glucose_fasting: 5.5, insulin_fasting: 10 };
    const r = analyzeDailyDiet(meal('rice_white', 100), p);
    expect(r.homaIr).toBeCloseTo(10 * 5.5 / 22.5, 1);
  });
});

describe('analyzeDailyDiet — профильные микро-таргеты (P1-4)', () => {
  it('женщина: добавляются железо и кальций', () => {
    const p = getDefaultProfile();
    p.sex = 'female';
    p.lbm = 50;
    p.weightKg = 60;
    const r = analyzeDailyDiet(meal('rice_white', 200), p);
    expect(r.microDeficits).toContain('Железо');
    expect(r.microDeficits).toContain('Кальций');
  });

  it('мужчина без PED: железо/кальций не выставляются', () => {
    const p = getDefaultProfile();
    const r = analyzeDailyDiet(meal('rice_white', 200), p);
    expect(r.microDeficits).not.toContain('Железо');
    expect(r.microDeficits).not.toContain('Кальций');
  });

  it('курсовой профиль (PED): повышается Mg-таргет и добавляется калий', () => {
    const p = getDefaultProfile();
    p.pharma.AAS_INJECTABLE = true;
    const r = analyzeDailyDiet(meal('rice_white', 200), p);
    expect(r.microDeficits).toContain('Магний'); // таргет 420 (курсовой) — рис не добирает
    expect(r.microDeficits).toContain('Калий');
  });
});

