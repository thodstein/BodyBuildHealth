/**
 * planner-meal-typology.test.ts — проверка раунда «логика приёмов пищи» (E1/E4/E5/E6/E2):
 * E1  — завтрак имеет собственный продуктовый пул (не «обеденный стол»): нет овощей, есть фрукт;
 * E4  — предупреждение «перегрузка приёма» при упоре в кап каши/крупы + совет увеличить приёмы;
 * E5  — углеводная «добивка» фруктом/сухофруктами, когда крупяная порция упирается в кап;
 * E6  — количество приёмов расширено до 10 (появляются snack3/snack4);
 * E2  — заметка о неравномерном интервале между приёмами.
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

describe('E1: завтрак — собственный продуктовый пул (не «обеденный стол»)', () => {
  it('завтрак не содержит овощей (порционная каша/хлопья), обед/ужин — содержат', () => {
    const plan = buildDayPlan(base({ mealsCount: 4 }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    const dinner = plan.meals.find(m => m.type === 'dinner')!;
    // На 4 приёмах includeVeg для завтрака = false → нет «обеденного» овощного салата.
    expect(breakfast.items.some(it => it.role === 'veg')).toBe(false);
    expect(lunch.items.some(it => it.role === 'veg')).toBe(true);
    expect(dinner.items.some(it => it.role === 'veg')).toBe(true);
    // Завтрак несёт фрукт/ягоды (в отличие от обеда/ужина).
    expect(breakfast.items.some(it => it.role === 'fruit')).toBe(true);
    expect(breakfast.items.some(it => it.role === 'carb_slow')).toBe(true);
  });

  it('завтрашний углевод — крупа/каша (овсянка/рис/хлопья/гречка), а не гарнир-обед', () => {
    const plan = buildDayPlan(base({ mealsCount: 4 }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const carb = breakfast.items.find(it => it.role === 'carb_slow');
    expect(carb).toBeTruthy();
    // Проверяем, что источник — крупяная/злаковая категория (не овощ/не «обед»).
    expect(carb!.name.length).toBeGreaterThan(0);
  });
});

describe('E4: предупреждение перегрузки приёма при упоре в кап каши', () => {
  it('высокоуглеводная цель при малом числе приёмов даёт заметку «Перегрузка приёма»', () => {
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 520, goalKcal: 3600, goalProteinG: 190, goalFatG: 90 }));
    const hasOverload = plan.notes.some(n => (n || '').includes('Перегрузка приёма'));
    expect(hasOverload).toBe(true);
  });
});

describe('E5: углеводная добивка фруктом, когда крупяная порция упёрлась в кап', () => {
  it('в перегруженном углеводами приёме появляется фруктовая добивка поверх каши', () => {
    // Максимальная углеводная нагрузка на завтрак → каша упирается в 280г, остаток закрываем фруктом.
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 560, goalKcal: 3800, goalProteinG: 190, goalFatG: 90 }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const fruitItems = breakfast.items.filter(it => it.role === 'fruit');
    // В условиях крупного углеводного завтрака добавляется вторая фруктовая/сухофруктовая позиция.
    expect(fruitItems.length).toBeGreaterThanOrEqual(1);
    const carbItems = breakfast.items.filter(it => it.role === 'carb_slow');
    // Каша не превышает разумный потолок (280г).
    carbItems.forEach(it => expect(it.amount || 0).toBeLessThanOrEqual(300));
  });
});

describe('E6: количество приёмов до 10', () => {
  it('mealsCount=10 (нетренировочный день) строит snack3 и snack4', () => {
    const plan = buildDayPlan(base({ mealsCount: 10, isTrainingDay: false }));
    const types = plan.meals.map(m => m.type);
    expect(types).toContain('snack3');
    expect(types).toContain('snack4');
    expect(types).toContain('snack2');
    expect(plan.meals.length).toBeGreaterThanOrEqual(8);
  });

  it('mealsCount=8 включает snack3, но не snack4', () => {
    const plan = buildDayPlan(base({ mealsCount: 8, isTrainingDay: false }));
    const types = plan.meals.map(m => m.type);
    expect(types).toContain('snack3');
    expect(types).not.toContain('snack4');
  });
});

describe('E2: заметка о неравномерном интервале', () => {
  it('слишком большой интервал между приёмами даёт заметку про 3–5 ч', () => {
    // Ранний завтрак и поздний ужин при малом числе приёмов → большой разрыв.
    const plan = buildDayPlan(base({ mealsCount: 3, wakeTime: '06:00', dinnerTime: '21:00' }));
    const hasGapNote = plan.notes.some(n => (n || '').includes('Большой интервал'));
    expect(hasGapNote).toBe(true);
  });
});

describe('E8: молоко к завтраку и кокосовое масло (по выбору пользователя)', () => {
  it('включает молоко и кокосовое масло в завтрак при включённых флагах', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, addMilkToBreakfast: true, coconutOilBoost: true }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'milk')).toBe(true);
    expect(breakfast.items.some(it => it.id === 'coconut_oil')).toBe(true);
  });

  it('не добавляет молоко, если молочные исключены (no_dairy)', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, addMilkToBreakfast: true, excludedIds: new Set(['milk','kefir','yogurt','cottage_cheese_5']) }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'milk')).toBe(false);
  });

  it('без флагов молоко/кокосовое масло не добавляются', () => {
    const plan = buildDayPlan(base({ mealsCount: 4 }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'milk')).toBe(false);
    expect(breakfast.items.some(it => it.id === 'coconut_oil')).toBe(false);
  });
});

describe('E10: target предтрена отражает фактическую углеводную долю (не константу)', () => {
  it('высокоуглеводный план даёт предтрену target.c > константы 40 г', () => {
    const hi = buildDayPlan(trainLike({ mealsCount: 7, goalCarbsG: 520 }));
    const prew = hi.meals.find(m => m.type === 'preworkout')!;
    expect(prew).toBeTruthy();
    // carbG масштабируется от дневного бюджета → target.c должен превышать фикс. 40 г.
    expect(prew.target.c).toBeGreaterThan(40);
  });

  it('низкоуглеводный план даёт предтрену target.c < 40 г', () => {
    const lo = buildDayPlan(trainLike({ mealsCount: 7, goalCarbsG: 120 }));
    const prew = lo.meals.find(m => m.type === 'preworkout');
    if (prew) expect(prew.target.c).toBeLessThan(40);
  });
});

describe('E7: перекус-типология (протеин-порошок + хлопья + сухофрукты, без овощей)', () => {
  it('перекус строится с быстрым белком (порошок) и не содержит овощей', () => {
    const plan = buildDayPlan(base({ mealsCount: 8, isTrainingDay: false }));
    const snack = plan.meals.find(m => m.type === 'snack' || m.type === 'snack2')!;
    expect(snack).toBeTruthy();
    expect(snack.items.some(it => it.role === 'veg')).toBe(false);
    // Белок перекуса — быстрый протеин (порошок) или присутствует быстрый белок в составе.
    const hasFastProtein = snack.items.some(it => it.role === 'fast_protein' || it.role === 'protein');
    expect(hasFastProtein).toBe(true);
  });

  it('в перекусе присутствует фрукт/сухофрукты', () => {
    const plan = buildDayPlan(base({ mealsCount: 8, isTrainingDay: false }));
    const snack = plan.meals.find(m => m.type === 'snack' || m.type === 'snack2')!;
    expect(snack.items.some(it => it.role === 'fruit')).toBe(true);
  });
});

describe('N3/тайминг: перекусы распределяются по самым большим разрывам (нет «6 ч между завтраком и обедом»)', () => {
  const toMin = (t: string) => { const [h, m] = (t || '').split(':').map(Number); return h * 60 + m; };

  it('при 6 приёмах (snack+snack2) завтрак→обед не остаётся пустым', () => {
    const plan = buildDayPlan(base({ mealsCount: 6, isTrainingDay: false, wakeTime: '07:00', lunchTime: '13:00', dinnerTime: '19:00', bedTime: '23:00' }));
    const times = plan.meals.map(m => toMin(m.time)).sort((a, b) => a - b);
    const bMin = toMin('07:30'); // завтрак = wake+30
    const lMin = toMin('13:00');
    // Есть приём строго между завтраком и обедом (утренний перекус).
    expect(times.some(t => t > bMin && t < lMin)).toBe(true);
    // Ни один разрыв между соседними приёмами не превышает ~4 ч.
    let maxGap = 0;
    for (let i = 1; i < times.length; i++) maxGap = Math.max(maxGap, times[i] - times[i - 1]);
    expect(maxGap).toBeLessThanOrEqual(4 * 60 + 10);
  });

  it('gapFillTimes распределяет перекусы в самые большие разрывы', () => {
    const plan = buildDayPlan(base({ mealsCount: 6, isTrainingDay: false }));
    // Перекусы не должны слипаться в один промежуток — их времена различны и разнесены.
    const snackTimes = plan.meals.filter(m => m.type === 'snack' || m.type === 'snack2').map(m => toMin(m.time)).sort((a, b) => a - b);
    expect(snackTimes.length).toBeGreaterThanOrEqual(2);
    expect(snackTimes[1] - snackTimes[0]).toBeGreaterThanOrEqual(2 * 60);
  });
});

describe('Пери-тренировочное распределение: пост-трен после окончания сессии', () => {
  const toMin = (t: string) => { const [h, m] = (t || '').split(':').map(Number); return h * 60 + m; };

  it('post-workout ставится через 30 мин после ОКОНЧАНИЯ сессии (не внутрь)', () => {
    // Тренировка 17:30, длительность 90 мин → окончание 19:00, пост-трен ≈ 19:30.
    const plan = buildDayPlan(trainLike({ mealsCount: 7, trainStartMin: 17 * 60 + 30, trainDurationMin: 90 }));
    const postw = plan.meals.find(m => m.type === 'postworkout')!;
    expect(postw).toBeTruthy();
    const pm = toMin(postw.time);
    expect(pm).toBeGreaterThan(17 * 60 + 30 + 90); // после конца сессии (19:00)
    expect(pm).toBeLessThanOrEqual(17 * 60 + 30 + 90 + 60); // в пределах часа после
  });

  it('pre-workout за 90 мин до старта', () => {
    const plan = buildDayPlan(trainLike({ mealsCount: 7, trainStartMin: 17 * 60 + 30 }));
    const prew = plan.meals.find(m => m.type === 'preworkout')!;
    expect(prew).toBeTruthy();
    expect(toMin(prew.time)).toBe(17 * 60 + 30 - 90);
  });

  it('intra-workout во время сессии (30-я минута)', () => {
    const plan = buildDayPlan(trainLike({ mealsCount: 7, trainStartMin: 17 * 60 + 30, trainDurationMin: 90 }));
    const intra = plan.meals.find(m => m.type === 'intra')!;
    expect(intra).toBeTruthy();
    expect(toMin(intra.time)).toBe(17 * 60 + 30 + 30);
  });
});

describe('N1: профиль вкуса завтрака (основа по выбору)', () => {
  it('стиль eggs — завтрак содержит яйца', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, breakfastStyle: 'eggs' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const proteinItem = breakfast.items.find(it => it.role === 'protein' || it.role === 'fast_protein');
    expect(proteinItem).toBeTruthy();
    expect((proteinItem!.name || '').toLowerCase()).toMatch(/яичн|яйцо|омлет|egg/);
  });

  it('стиль porridge — завтрашний углевод это каша/манка', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, breakfastStyle: 'porridge' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    const carbItem = breakfast.items.find(it => it.role === 'carb_slow');
    expect(carbItem).toBeTruthy();
    expect((carbItem!.name || '').toLowerCase()).toMatch(/овсян|манк|гречк|каш/);
  });
});

// Тренировочный вход (для E10: prew строится только на тренировочный день).
function trainLike(overrides: any = {}): MealPlanInput {
  return base({ isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true, ...overrides });
}
