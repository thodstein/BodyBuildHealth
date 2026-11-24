/**
 * planner-recipe-last-mile.test.ts — §8.50 (QG51) «последняя миля рецептурного пути».
 *
 * Замок к регрессу, который поймал `planner-recipe-portion-drift.test.ts` после QG45:
 * когда из движка ушли фантомные макросы (позиция 8 г с макросами 160 г), рецептурный
 * день 95 кг / 3600 ккал / 10 приёмов честно просел — жир 87.6 из 95 (−7.8 %),
 * углеводы −5.8 %, калории 3446 из 3600 (−4.3 %). Канон держался фантомом.
 *
 * Стадия добирает остаток **реальной едой**: жир до 45 г → масло шагом 5–15 г, до трёх
 * раундов (§8.94; крошка <5 г запрещена — QG51), углеводы 12–140 г → плотный гарнир в приём
 * с наибольшей комнатой. Авторские ядра рецептов по-прежнему не двигаются (±3 %), добавка
 * принимается только если максимальная девиация дня падает.
 *
 * Замер (plain 3500, первая редакция): ккал −4.3 % → **+1.2 %**, жир −7.8 % → **−0.1 %**,
 * У −5.8 % → **−0.1 %**, макс. девиация 7.8 % → 3.8 % (остаток — белок ядер рецептов +3.8 %,
 * документированный honest-cap §3E). Полный прогон `IndividualPlan`: 180 файлов / 1808 тестов зелёные.
 *
 * ── вторая редакция замера (2026-11-24) ───────────────────────────────────────────────
 * После §8.122/§8.127 (овощной пол, кап тарелки) и правок добора `PLAIN_3500` приходит в
 * канон САМ: 3579/203/93/483 при цели 3600/200/95/490 — макс. девиация 2.1 %, остаток жира
 * 2 г и углеводов 7 г. Честная добавка масла 5 г дала бы жир 98 г (+3.2 %), то есть стадия
 * обязана молчать: «докармливать» канонический день нечем (приёмка требует, чтобы девиация
 * падала). Поэтому положительный контракт стадии проверяется на дне, где остаток реально
 * есть, — `MASS_4000` (110 кг / 4000 ккал / 6 приёмов / отдых). После стадии день выходит
 * **4035/233.1/111.4/525** при цели 4000/220/110/532 (девиации 0.9/6.0/1.3/1.3 %, белок —
 * документированный пол ядер рецептов), стадия ставит масло 13 г и 5 г (жир дня) и рис
 * 80 г (крупный остаток У), авторские ядра рецептов остаются в ±3 %. Молчание на
 * `PLAIN_3500` закреплено отдельным тестом как инвариант «канон не докармливается».
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';

const base = (over: any = {}): MealPlanInput =>
  ({
    weightKg: 120,
    lbmKg: 100,
    bodyFatPct: 16,
    sex: 'male' as const,
    goalKcal: 8900,
    goalProteinG: 500,
    goalFatG: 100,
    goalCarbsG: 1500,
    mealsCount: 10,
    isTrainingDay: false,
    budget: 'max' as const,
    dayOffset: 0,
    cyclePhase: 'course' as const,
    variety: 'max' as const,
    eveningLowCarb: false,
    quality: 'full' as const,
    randomSalt: 3,
    carbCapGPerKg: 0,
    // QG52: этот файл моделирует РЕЦЕПТУРНЫЙ контур (движок → assembleRecipeDay) —
    // ровно как в продакшене (`generationMode === 'recipes'`), поэтому справедливость
    // приёмов применяется после посадки блюд, а не в движке (§8.51).
    recipeAssembly: true,
    wakeTime: '07:00',
    bedTime: '23:00',
    dinnerTime: '19:00',
    ...over,
  }) as any;

const assemble = (inp: MealPlanInput) => {
  const src = buildDayPlan(inp);
  const meals = (src.meals as any[]).map((m: any) => ({
    ...m,
    items: (m.items || []).map((i: any) => ({ ...i })),
    totals: { ...m.totals },
  }));
  return assembleRecipeDay({
    meals,
    pool: RECIPE_DB as any,
    targets: {
      kcal: (inp as any).goalKcal,
      p: (inp as any).goalProteinG,
      f: (inp as any).goalFatG,
      c: (inp as any).goalCarbsG,
    },
    excludedIds: new Set<string>(),
    trainDay: !!inp.isTrainingDay,
    athleteWeightKg: (inp as any).weightKg,
    seed: 3,
    goal: 'mass',
    sex: 'male',
  } as any);
};

const PLAIN_3500 = base({
  weightKg: 95,
  lbmKg: 80,
  goalKcal: 3600,
  goalProteinG: 200,
  goalFatG: 95,
  goalCarbsG: 490,
  goal: 'mass',
});

// §8.50: день, где остаток реально есть (замер 2026-11-24: после стадии 4035/233.1/111.4/525
// при цели 4000/220/110/532) — на нём проверяется ПОЛОЖИТЕЛЬНЫЙ контракт стадии: жир дня
// (масло 13 г + 5 г) и крупный остаток У (рис 80 г), авторские ядра рецептов в ±3 %.
const MASS_4000 = base({
  weightKg: 110,
  lbmKg: 88,
  goalKcal: 4000,
  goalProteinG: 220,
  goalFatG: 110,
  goalCarbsG: 532,
  mealsCount: 6,
  goal: 'mass',
});

const devPct = (got: number, want: number) => (Math.abs(got - want) / want) * 100;

describe('§8.50 QG51: последняя миля рецептурного дня честными граммами', () => {
  it('plain 3500: жир и углеводы в каноне 3 %, калории в §4.4-коридоре 4 %', () => {
    const res = assemble(PLAIN_3500);
    const t = sumDayTotals(res.meals as any);
    expect(devPct(t.f, 95), `жир ${t.f.toFixed(1)} из 95`).toBeLessThanOrEqual(3);
    expect(devPct(t.c, 490), `углеводы ${t.c.toFixed(1)} из 490`).toBeLessThanOrEqual(3);
    expect(devPct(t.kcal, 3600), `ккал ${t.kcal.toFixed(0)} из 3600`).toBeLessThanOrEqual(4);
    expect(devPct(t.p, 200), `белок ${t.p.toFixed(1)} из 200 (ядра рецептов)`).toBeLessThanOrEqual(6);
  });

  it('добор идёт едой и подписан: масло/гарнир, а не распухание авторской порции', () => {
    const res = assemble(MASS_4000);
    const t = sumDayTotals(res.meals as any);
    const notes = res.notes as string[];
    expect(
      notes.filter((n) => n.includes('последняя миля рецептурного дня')).length,
      `ноты: ${notes.join(' | ')}`,
    ).toBeGreaterThan(0);
    // Добор вернул день в канон и не вывел его за него: после стадии 4035/233.1/111.4/525
    // при цели 4000/220/110/532.
    expect(devPct(t.kcal, 4000), `ккал ${t.kcal.toFixed(0)}`).toBeLessThanOrEqual(4);
    expect(devPct(t.f, 110), `жир ${t.f.toFixed(1)}`).toBeLessThanOrEqual(3);
    expect(devPct(t.c, 532), `углеводы ${t.c.toFixed(1)}`).toBeLessThanOrEqual(3);
    // Белок — честный пол ядер рецептов (§3E): он не режется ради канона, поэтому предел
    // шире 3 % и назван числом (замер 233.1 г = +6.0 % при цели 220).
    expect(devPct(t.p, 220), `белок ${t.p.toFixed(1)} (ядра рецептов)`).toBeLessThanOrEqual(6.5);
    // порции авторских блюд не уехали: лок §4.4 держит ±3 %
    const driftNotes = notes.filter((n) => /×\d+%/.test(n));
    // Замок не вакуумный: на этом дне масштабирование порции рецепта обязано быть названо
    // (замер: «Порция «Врапы с фаршем, рисом и фасолью (2 шт)» ×103% для сходимости КБЖУ дня»).
    expect(driftNotes.length, `ноты дрейфа: ${notes.join(' | ')}`).toBeGreaterThan(0);
    let drift = 0;
    for (const n of driftNotes) {
      const m = n.match(/×(\d+)%/);
      if (m) drift = Math.max(drift, Math.abs(Number(m[1]) - 100));
    }
    expect(drift, 'коридор авторских порций').toBeLessThanOrEqual(3);
  });

  it('добавленный добор — реальная позиция с целыми граммами ≥5 г', () => {
    const res = assemble(MASS_4000);
    const added = res.notes.filter((n: string) => n.includes('последняя миля рецептурного дня'));
    // Пустой список сделал бы тест пустым: на MASS_4000 стадия обязана говорить (замер:
    // масло 13 г + 5 г, рис 80 г).
    expect(added.length, 'стадия должна была сработать на MASS_4000').toBeGreaterThan(0);
    for (const n of added) {
      const m = n.match(/(\d+) г →/);
      expect(m, `граммы в ноте: ${n}`).toBeTruthy();
      const g = Number(m![1]);
      expect(Number.isInteger(g), `целые граммы: ${g}`).toBe(true);
      expect(g).toBeGreaterThanOrEqual(5);
      // Позиция — реальный продукт из базы, а не «порция ×103 %»: QG46 (масло 5–10 г) и
      // гарнир называются в ноте по имени.
      expect(/Подсолнечное масло|Рис белый/.test(n), `позиция в ноте: ${n}`).toBe(true);
    }
  });

  it('канонический день не докармливается: на PLAIN_3500 стадия молчит', () => {
    // Замер 3579/203/93/483 при цели 3600/200/95/490: девиации 0.58/1.5/2.11/1.43 %.
    // Остаток жира 2 г — меньше минимального шага масла 5 г (QG46: крошки 2 г запрещены),
    // остаток У 7 г — меньше окна гарнира 12 г. Любая добавка увеличила бы девиацию, поэтому
    // стадия обязана молчать; иначе тест 1 (канон) и этот инвариант противоречат друг другу.
    const res = assemble(PLAIN_3500);
    const t = sumDayTotals(res.meals as any);
    expect(devPct(t.kcal, 3600), `ккал ${t.kcal.toFixed(0)}`).toBeLessThanOrEqual(4);
    expect(devPct(t.f, 95), `жир ${t.f.toFixed(1)}`).toBeLessThanOrEqual(3);
    expect(
      (res.notes as string[]).filter((n) => n.includes('последняя миля рецептурного дня')),
      `ноты: ${(res.notes as string[]).join(' | ')}`,
    ).toHaveLength(0);
  });

  it('собранный день не трогается: на канон-клетке стадия молчит', () => {
    // 2600 ккал: после корректора день уже в коридоре — добор не должен «докармливать»
    const cell = base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320 });
    const res = assemble(cell);
    const t = sumDayTotals(res.meals as any);
    // калории не выходят за коридор и день не перекормлен сверху
    expect(devPct(t.kcal, 2600), `ккал ${t.kcal.toFixed(0)}`).toBeLessThanOrEqual(4);
    expect(t.kcal).toBeLessThanOrEqual(2600 * 1.045);
  });
});
