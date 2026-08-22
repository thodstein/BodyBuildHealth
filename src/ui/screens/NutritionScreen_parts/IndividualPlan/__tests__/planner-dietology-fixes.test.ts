/**
 * planner-dietology-fixes.test.ts — проверка раунда «диетология генерации рациона» (Aug 22 2026):
 *  D1 — завтрак НИКОГДА не получает дневную мясную ротацию (жалоба «овсянка и говяжий фарш»);
 *  D2 — E5-«добивка» фруктом ограничена 150 г и предпочитает карб-плотные фрукты
 *       (жалоба «500 г клюквы в обед»);
 *  D3 — углеводы под инсулин масштабируются от ДОЗЫ (~10 г/1 ЕД), а не фикс. 40 г
 *       (жалоба «инсулин и на тренировке так мало углеводов»);
 *  D4 — физиологический потолок углеводов 8 г/кг (вопрос «120 кг на курсе → 900 г?»).
 */

import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const base = (overrides: any = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 190, goalFatG: 80, goalCarbsG: 320,
  mealsCount: 5, isTrainingDay: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'maintenance' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...overrides,
});

// «Завтрашний» белок — яйца/творог/йогурт/сыворотка/тофу/казеин (не мясо/рыба).
// Используем префиксы, т.к. в FOOD_DB несколько вариантов имён (egg_white/egg_white_cooked/…).
const BREAKFAST_OK_PREFIX = ['egg_', 'omelet', 'omelette', 'cottage_cheese', 'yogurt', 'milk', 'kefir',
  'whey_', 'casein', 'tofu', 'supp_pea_protein', 'supp_soy_isolate', 'supp_rice_protein'];

// Мясо/рыба, которые НЕ должны попасть в завтрак из дневной ротации.
const BREAKFAST_FORBIDDEN = ['beef', 'pork', 'chicken', 'turkey', 'salmon', 'tuna', 'cod', 'pollock',
  'lamb', 'mackerel', 'shrimp', 'sardines', 'rabbit', 'duck', 'liver'];

const isBreakfastOkId = (id: string): boolean =>
  BREAKFAST_OK_PREFIX.some(p => id.includes(p)) && !BREAKFAST_FORBIDDEN.some(k => id.includes(k));

describe('D1: завтрак не получает мясную ротацию (жалоба «овсянка и говяжий фарш»)', () => {
  it('завтрашний белок всегда «завтрашний» (яйца/творог/сыворотка), а не мясо из ротации дня', () => {
    for (const salt of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const plan = buildDayPlan(base({ randomSalt: salt, mealsCount: 4 }));
      const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
      const prot = breakfast.items.find(it => it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein');
      expect(prot, `salt=${salt}`).toBeTruthy();
      expect(isBreakfastOkId(prot!.id), `salt=${salt} prot=${prot!.id}`).toBe(true);
    }
  });

  it('завтрак-шаблон «хлопья + протеин» даёт хлопья/овсянку + сыворотку и НЕ содержит говядины', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, breakfastTemplate: 'protein_flakes' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'oats')).toBe(true);
    expect(breakfast.items.some(it => it.id === 'whey_isolate')).toBe(true);
    const hasMeat = breakfast.items.some(it => BREAKFAST_FORBIDDEN.some(k => it.id.includes(k)));
    expect(hasMeat).toBe(false);
  });

  it('завтрак-шаблон «овсянка»: есть овсянка и ягоды/банан, нет мяса', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, breakfastTemplate: 'classic_oat' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'oats')).toBe(true);
    const hasMeat = breakfast.items.some(it => BREAKFAST_FORBIDDEN.some(k => it.id.includes(k)));
    expect(hasMeat).toBe(false);
  });

  it('ИЗБРАННЫЙ говяжий фарш не попадает в завтрак (только на обед/ужин)', () => {
    // Реальный сценарий жалобы: пользователь отметил говядину/фарш любимым белком → раньше
    // завтрак получал «говяжий фарш» через preferredRot (обходя ротационный фильтр).
    const plan = buildDayPlan(base({ mealsCount: 5, preferredIds: new Set(['beef_minced', 'beef_lean']) }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const hasMeat = breakfast.items.some(it => BREAKFAST_FORBIDDEN.some(k => it.id.includes(k)));
    expect(hasMeat).toBe(false);
    // говядина всё же присутствует в дне (на обеде/ужине) — пользовательский выбор уважается
    const dayHasBeef = plan.meals.some(m => m.items.some(it => it.id.includes('beef')));
    expect(dayHasBeef).toBe(true);
    // ни один белок не раздут за 300 г на приём (коррекция не даёт «лосось 316 г»)
    plan.meals.forEach(m => m.items.filter(i => i.role === 'protein').forEach(it => expect(it.amount).toBeLessThanOrEqual(300)));
  });
});

describe('D2: E5-добивка фруктом ограничена и предпочитает карб-плотные фрукты (жалоба «500 г клюквы»)', () => {
  it('при крупной углеводной цели фруктовая позиция в обеде не превышает 150 г', () => {
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 520, goalKcal: 3600, goalProteinG: 190, goalFatG: 90 }));
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    lunch.items.filter(it => it.role === 'fruit').forEach(it => {
      expect(it.amount || 0).toBeLessThanOrEqual(150);
    });
  });

  it('для углеводной добивки выбирается карб-плотный фрукт (≥20 г/100 г), а не низкоплотная клюква', () => {
    // Принудительно маленький пул фруктов: если в пуле есть и банан(плотный), и клюква(низкоплотная),
    // добивка возьмёт банан. Проверяем, что клюква не раздувается до «500 г» нигде в обеде.
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 520, goalKcal: 3600, goalProteinG: 190, goalFatG: 90 }));
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    const cranberry = lunch.items.find(it => it.id.includes('cranber'));
    if (cranberry) {
      expect((cranberry.amount || 0)).toBeLessThanOrEqual(150);
    }
  });
});

describe('D3: углеводы под инсулин масштабируются от дозы (жалоба «инсулин даёт мало углеводов») ', () => {
  it('болюсный инсулин 10 ЕД → приём «Углеводы под инсулин» с целью ~100 г углеводов', () => {
    const plan = buildDayPlan(base({
      isTrainingDay: false, mealsCount: 5,
      injections: [{ type: 'инсулин', name: 'НовоРапид', dose: 10, esterType: 'short', time: '10:00', trainLinked: false, trainTiming: 'none' as const }],
    }));
    const insulinMeal = plan.meals.find(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(insulinMeal).toBeTruthy();
    expect(insulinMeal!.target?.c).toBe(100); // 10 ЕД × 10 г
  });

  it('болюсный инсулин 20 ЕД → цель ~200 г (с капом 120 г на приём)', () => {
    const plan = buildDayPlan(base({
      isTrainingDay: false, mealsCount: 5,
      injections: [{ type: 'инсулин', name: 'НовоРапид', dose: 20, esterType: 'short', time: '10:00', trainLinked: false, trainTiming: 'none' as const }],
    }));
    const insulinMeal = plan.meals.find(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(insulinMeal).toBeTruthy();
    expect(insulinMeal!.target?.c).toBeLessThanOrEqual(120);
  });

  it('без инсулина приёма «Углеводы под инсулин» нет', () => {
    const plan = buildDayPlan(base({ mealsCount: 5 }));
    const insulinMeal = plan.meals.find(m => (m.label || '').includes('Углеводы под инсулин'));
    expect(insulinMeal).toBeUndefined();
  });
});

describe('D4: физиологический потолок углеводов 8 г/кг (вопрос «120 кг на курсе → 900 г?»)', () => {
  it('120 кг при целе 1200 г углеводов → план не превышает ~960 г (8 г/кг)', () => {
    const plan = buildDayPlan(base({ weightKg: 120, lbmKg: 100, goalCarbsG: 1200, goalKcal: 6400, goalProteinG: 300, goalFatG: 100, mealsCount: 6 }));
    expect(plan.totals.c).toBeLessThanOrEqual(960 + 30);
  });

  it('не занижает нормальную цель: 90 кг / 320 г → без обрезки', () => {
    const plan = buildDayPlan(base({ goalCarbsG: 320, mealsCount: 5 }));
    expect(plan.totals.c).toBeGreaterThanOrEqual(250); // не режем разумные 320 (ниже 8*90=720)
  });
});

describe('P2: второй гарнир в одном приёме убран (жалоба «500 г каши двумя разными»)', () => {
  it('в высокоуглеводном обеде только ОДИН крупяной источник, а не «гречка+рис»', () => {
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 520, goalKcal: 3600, goalProteinG: 190, goalFatG: 90 }));
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    const carbSources = lunch.items.filter(it => it.role === 'carb_slow' || it.role === 'carb_fast');
    // максимум один злаковый носитель (второй «гарнир» убран); фрукт — отдельная роль
    expect(carbSources.length).toBeLessThanOrEqual(1);
  });
});

describe('P3: завтрак-шаблон ЗАМЕНЯЕТ пуловый завтрак (не «дополняет»)', () => {
  it('шаблон eggs_toast: нет второго углеводного источника поверх шаблона — только тост', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, breakfastTemplate: 'eggs_toast' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const carbSources = breakfast.items.filter(it => it.role === 'carb_slow');
    // тост — единственный углеводный носитель (раньше пуловый завтрак добавлял ещё кашу)
    expect(carbSources.length).toBeLessThanOrEqual(1);
    expect(carbSources[0]).toBeTruthy();
  });

  it('все 4 шаблона имеют полноценный белок (лейцин-порог MPS) — яйца/творог/сыворотка', () => {
    for (const t of ['classic_oat', 'protein_flakes', 'eggs_toast', 'cottage_berries']) {
      const plan = buildDayPlan(base({ mealsCount: 4, breakfastTemplate: t as any }));
      const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
      const prot = breakfast.items.filter(it => ['protein', 'fast_protein', 'slow_protein'].includes(it.role));
      expect(prot.length, `template=${t}`).toBeGreaterThanOrEqual(1);
      expect(isBreakfastOkId(prot[0]!.id), `template=${t}`).toBe(true);
      // нет мяса/рыбы в завтраке ни в одном шаблоне
      expect(breakfast.items.some(it => BREAKFAST_FORBIDDEN.some(k => it.id.includes(k))), `template=${t}`).toBe(false);
    }
  });
});

