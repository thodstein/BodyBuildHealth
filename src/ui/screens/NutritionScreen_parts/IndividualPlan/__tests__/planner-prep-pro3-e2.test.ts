/**
 * planner-prep-pro3-e2.test.ts — PRO-3 Э2 «питание без ловушек»:
 *   D4 — флаг lowFiberComposition (пик-день true / подготовка false / undefined legacy);
 *   D8 — единая база натрия PREP_SODIUM_BASE_MG;
 *   D9 — паритет целевых %жира planner-categories ↔ CATEGORY_PROFILES;
 *   D15 — рефид/diet-break не протекает через planner-моды (чистое поддержание).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { isLowFiberComposition } from '../food-availability';
import { BB_CATEGORIES } from '../planner-categories';
import {
  CATEGORY_PROFILES,
  PREP_SODIUM_BASE_MG,
  prepMaintenanceKcal,
  prepRefeedDates,
  prepDietBreaks,
  nutritionTargetsForPrepDate,
  buildBBContestPrepPlan,
  isoToday,
  isoAddDays,
  type BBContestPrepConfig,
} from '../../../../../engines/bb/bb-contest-prep.engine';

function base(over: Partial<MealPlanInput>): MealPlanInput {
  return {
    weightKg: 85, lbmKg: 70, bodyFatPct: 15, sex: 'male',
    goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
    mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
    budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max',
    wakeTime: '07:00', bedTime: '23:00',
    ...over,
  } as MealPlanInput;
}

function prepCfg(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male', category: 'mens_physique', weightKg: 85,
    experienceLevel: 'intermediate', enhanced: false, prepCount: 1,
    showDate: isoAddDays(isoToday(), 14 * 7),
    weeksOut: 2,
    trainingProtocol: 'bb', carbLoadStrategy: 'moderate',
    waterStrategy: 'stable', sodiumStrategy: 'stable',
    ...over,
  };
}

function baseNutrition(kcal = 3000) {
  return { kcal, proteinG: 190, fatG: 70, carbsG: Math.round((kcal - 190 * 4 - 70 * 9) / 4), waterMl: 3000, sodiumMg: PREP_SODIUM_BASE_MG };
}

describe('PRO-3 Э2/D4 — lowFiberComposition', () => {
  it('явный флаг главнее порога: true/false/undefined', () => {
    expect(isLowFiberComposition(30, true)).toBe(true);
    expect(isLowFiberComposition(60, true)).toBe(true);
    expect(isLowFiberComposition(30, false)).toBe(false);
    expect(isLowFiberComposition(20, false)).toBe(false);
    // legacy без флага — порог <35 (пик-неделя ББ), прежнее поведение
    expect(isLowFiberComposition(30, undefined)).toBe(true);
    expect(isLowFiberComposition(40, undefined)).toBe(false);
    expect(isLowFiberComposition(undefined, undefined)).toBe(false);
  });

  it('подготовка (явный false) держит обычный состав при капе <35; пик (true) — низкоклетчаточный', () => {
    const low = buildDayPlan(base({ fiberCapG: 30, lowFiberComposition: true } as any));
    const normal = buildDayPlan(base({ fiberCapG: 30, lowFiberComposition: false } as any));
    const legacy = buildDayPlan(base({ fiberCapG: 30 } as any));
    const idsOf = (p: any) => p.meals.flatMap((m: any) => m.items).map((it: any) => it.id);
    const veg = (p: any) => p.meals.flatMap((m: any) => m.items).filter((it: any) => it.role === 'veg').reduce((s: number, it: any) => s + (it.amount || 0), 0);
    // пик: без чиа/льна; подготовка: обычный состав (семена или более тяжёлые овощи)
    expect(idsOf(low).includes('chia_seeds') || idsOf(low).includes('flaxseed')).toBe(false);
    const normalHasSeeds = idsOf(normal).includes('chia_seeds') || idsOf(normal).includes('flaxseed');
    expect(normalHasSeeds || veg(normal) > veg(low)).toBe(true);
    // legacy без флага = true (байт-в-бит прежний порог)
    expect(idsOf(legacy)).toEqual(idsOf(low));
    expect(veg(legacy)).toBe(veg(low));
  });
});

describe('PRO-3 Э2/D8 — единая база натрия', () => {
  it('PREP_SODIUM_BASE_MG = 2800 и доходит до целей подготовки', () => {
    expect(PREP_SODIUM_BASE_MG).toBe(2800);
    const plan = buildBBContestPrepPlan(prepCfg(), { prepWeeks: 10, taperWeeks: 2 });
    const mid = isoAddDays(plan.preparation.startDate, 10);
    const t = nutritionTargetsForPrepDate(mid, plan, baseNutrition());
    expect(t.phase).toBeNull(); // не пик-день
    expect(t.sodiumMg).toBe(PREP_SODIUM_BASE_MG);
    expect(t.note).toContain('Na 2800 мг');
  });
});

describe('PRO-3 Э2/D9 — паритет целевых %жира', () => {
  it('planner-categories берёт targetBodyFatPct из CATEGORY_PROFILES', () => {
    for (const c of BB_CATEGORIES) {
      expect(c.targetBodyFatPct).toBe(CATEGORY_PROFILES[c.id as keyof typeof CATEGORY_PROFILES].targetBodyFatPct);
    }
    expect(BB_CATEGORIES.find(c => c.id === 'mens_physique')!.targetBodyFatPct).toBe(7);
    expect(BB_CATEGORIES.find(c => c.id === 'bikini')!.targetBodyFatPct).toBe(13);
  });
});

describe('PRO-3 Э2/D15 — рефид/брейк = чистое поддержание (без planner-утечек)', () => {
  it('рефид-день игнорирует раздутую базу (planner-моды/компенсацию)', () => {
    const plan = buildBBContestPrepPlan(prepCfg(), { prepWeeks: 12, taperWeeks: 2 });
    const refeed = prepRefeedDates(plan)[0];
    expect(refeed).toBeTruthy();
    const maint = prepMaintenanceKcal(plan);
    const t = nutritionTargetsForPrepDate(refeed, plan, baseNutrition(6000));
    expect(t.kcal).toBe(Math.max(maint, t.kcal)); // поддержание ≥ дефицита
    expect(t.kcal).toBe(maint);
    expect(t.note).toContain('Рефид-день');
  });

  it('diet-break день — тоже поддержание, без рефида-бонуса', () => {
    const plan = buildBBContestPrepPlan(prepCfg(), { prepWeeks: 16, taperWeeks: 2 });
    const brk = prepDietBreaks(plan)[0];
    expect(brk).toBeTruthy();
    const maint = prepMaintenanceKcal(plan);
    const t = nutritionTargetsForPrepDate(brk, plan, baseNutrition(6000));
    expect(t.kcal).toBe(maint);
    expect(t.note).toContain('Diet break');
    expect(t.note).not.toContain('Рефид-день');
  });
});
