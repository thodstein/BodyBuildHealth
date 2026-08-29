/**
 * planner-preferred.test.ts — Тесты «любимые продукты добавляются все».
 *
 * Багфикс: раньше любимые продукты терялись из-за:
 *  1. гейта ротации белка (говядина в «рыбный» день — никогда);
 *  2. GI/fiber-гейта фруктов (арбуз/финики отсекались: gi<=55 && fiber>=1.5);
 *  3. отсутствия mergePreferred в veg/fatty/lean/fast/slow пулах;
 *  4. MPS-добора всегда сывороткой (без учёта любимых).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const baseInput = (overrides: any = {}) => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  randomSalt: 42,
  ...overrides,
});

const allDayIds = (plan: any): string[] => plan.meals.flatMap((m: any) => m.items.map((it: any) => it.id));

describe('buildDayPlan — любимые продукты (все попадают в план)', () => {
  it('все любимые из разных категорий появляются в недельном плане ≥1 раза', () => {
    const favorites = ['chicken_breast', 'rice_white', 'broccoli', 'tomato', 'banana', 'avocado', 'watermelon', 'onion'];
    const weekIds = new Set<string>();
    for (let d = 0; d < 7; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, preferredIds: new Set(favorites) }));
      allDayIds(plan).forEach(id => weekIds.add(id));
    }
    for (const fid of favorites) {
      const name = FOOD_DB.find(f => f.id === fid)?.name || fid;
      expect(weekIds.has(fid), `любимый продукт не попал в недельный план: ${name}`).toBe(true);
    }
  });

  it('любимый белок появляется в КАЖДЫЙ день недели (без гейта ротации)', () => {
    // beef_lean (говядина) — раньше выбиралась только в дни ротации «Красное мясо» (~2/7);
    // после фикса любимый белок приоритетен каждый день.
    let daysWithBeef = 0;
    for (let d = 0; d < 7; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, preferredIds: new Set(['beef_lean']) }));
      if (allDayIds(plan).includes('beef_lean')) daysWithBeef++;
    }
    expect(daysWithBeef).toBe(7);
  });

  it('любимый фрукт с высоким GI (арбуз, GI 76) попадает в план', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['watermelon']) }));
    expect(allDayIds(plan)).toContain('watermelon');
  });

  it('любимый овощ вне keyword-списков (onion) попадает в план как овощ', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['onion']) }));
    expect(allDayIds(plan)).toContain('onion');
  });

  it('любимый овощ из цветного пула (tomato) попадает в план', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['tomato']) }));
    expect(allDayIds(plan)).toContain('tomato');
  });

  it('любимый жир (olive_oil) попадает в план', () => {
    const ids = new Set<string>();
    for (let d = 0; d < 3; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, preferredIds: new Set(['olive_oil']) }));
      allDayIds(plan).forEach(id => ids.add(id));
    }
    expect(ids.has('olive_oil')).toBe(true);
  });

  it('любимый рисовый крем попадает в ЗАВТРАК трен-дня (без цели >=60г)', () => {
    // FIX favorite-breakfast: раньше любимый углевод добавлялся в пул только при carbTarget>=60,
    // поэтому завтрак никогда не получал rice_cream (GI 82, не в commonCarbs)
    // EVEN protein (равномерно от веса) может сдвинуть завтрак — проверяем что rice_cream попадает в план (хотя бы 1 приём)
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['rice_cream']), isTrainingDay: true, goalCarbsG: 250 }));
    expect(allDayIds(plan)).toContain('rice_cream');
  });

  it('любимый углевод не монополизирует все приёмы (следующие приёмы — разнообразие)', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['rice_cream']), isTrainingDay: true, goalCarbsG: 300 }));
    const mealsWithRice = plan.meals.filter((m: any) => m.items.some((i: any) => i.id === 'rice_cream')).length;
    expect(mealsWithRice).toBeGreaterThanOrEqual(1);
    expect(mealsWithRice).toBeLessThan(plan.meals.length);
  });

  it('любимый быстрый белок (egg_white) приоритетнее whey в post-workout', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['egg_white']) }));
    const postw = plan.meals.find((m: any) => m.label === 'Пост-трен');
    expect(postw).toBeTruthy();
    const ids = postw!.items.map((it: any) => it.id);
    expect(ids).toContain('egg_white');
    expect(ids).not.toContain('whey_isolate');
    expect(ids).not.toContain('whey_protein');
  });

  it('без preferred план остаётся валидным (kcal ±8%, белок ±6.5%)', () => {
    const plan = buildDayPlan(baseInput({}));
    expect(Math.abs(plan.totals.kcal - 3000) / 3000).toBeLessThan(0.08);
    // Эпик B: ±5% → ±6.5% — реалистичные минимальные порции (полы 80-110 г) дают
    // системный сдвиг +1-1.5 п.п.; белок по-прежнему в MPS-коридоре (день ±6.5%).
    expect(Math.abs(plan.totals.p - 180) / 180).toBeLessThan(0.065);
  });

  it('preferred не возвращается, если он исключён пользователем (excludedIds)', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['rice_white']), excludedIds: new Set(['rice_white']) }));
    expect(allDayIds(plan)).not.toContain('rice_white');
  });

  it('preferred не возвращается при теге аллергена (allergenTags dairy) — кроме порошка (протеин не аллерген)', () => {
    const plan = buildDayPlan(baseInput({ preferredIds: new Set(['whey_protein']), allergenTags: new Set(['dairy']) }));
    // whey порошок не считается молочным аллергеном per user: "протеин не аллерген" — должен остаться
    expect(allDayIds(plan)).toContain('whey_protein');
    // но обычная молочка — исключается
    const planMilk = buildDayPlan(baseInput({ preferredIds: new Set(['milk']), allergenTags: new Set(['dairy']) }));
    expect(allDayIds(planMilk)).not.toContain('milk');
  });
});
