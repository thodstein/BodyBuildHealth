/**
 * planner-recipe-canon-and-lastmile.test.ts — §8.135 (канон дня по пути) и §8.50
 * (строгая приёмка последней мили) в рецептурном контуре.
 *
 * Замки к правкам владельца:
 *  1. §8.135: флаг `withinTolerance` рецептурного дня судится каноном ПУТИ, который
 *     вызывающий передаёт в `args.canonPct` (движок отдаёт его в поле `canonPct` дня):
 *     ручной день — 2 %, авто — `PLANNER_CONVERGENCE_PCT` (3 %). Канон подсвечен и в строке
 *     корректора: «… (≤2%)» на ручном пути против «… (≤3%)» на общем.
 *  2. §8.50: последняя миля принимает шаг ТОЛЬКО при строгом падении худшей оси дня —
 *     нота «3.4 % → 3.4 %» (равный шаг) больше невозможна.
 *
 * Профили и замеры этого файла (движок + `assembleRecipeDay`, seed 3):
 *  - ручной день 85 кг / 3600 ккал / 10 приёмов / отдых: при каноне пути 2 % корректор
 *    доводит день до 3627/200.8/95.5/489.9 (0.75 %), при общем 3 % тот же день остаётся
 *    3628/198.3/97.2/488.9 (2.32 %) — канон 2 строже и включает корректор раньше;
 *  - `PLAIN_3500` (95 кг / 3600 ккал / 10) приходит в канон сам — 3610/201/94/490
 *    (1.4 %) — на нём проверяется, что стадия последней мили молчит;
 *  - ручной M4000 105 кг / 5 приёмов: движок 2.5 % (canonPct 2, вне допуска), контур
 *    прокидывает канон и корректор сводит день к 1.9 % — проверка проброса канона;
 *  - ручной M4000 85 кг / 4 приёма: один и тот же день 3948/219.5/110.4/518.4 (2.56 %) —
 *    канон меняет только вердикт (2 % → вне, 3 % → в допуске);
 *  - сетка 3×4×2×2×3 = 144 дня: >100 нот «➕ Жир дня», равных пар «X % → X %» — 0.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { PLANNER_CONVERGENCE_PCT } from '../day-target-corrector';
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
    // Рецептурный контур: движок → assembleRecipeDay, как в продакшене.
    recipeAssembly: true,
    wakeTime: '07:00',
    bedTime: '23:00',
    dinnerTime: '19:00',
    ...over,
  }) as any;

/**
 * День движка + рецептурная сборка. `canonPct` — канон пути, который передаёт вызывающий;
 * без явного значения берётся канон самого дня (`src.canonPct`) — ровно как в UI.
 */
const assemble = (inp: MealPlanInput, canonPct?: number) => {
  const src = buildDayPlan(inp);
  const meals = (src.meals as any[]).map((m: any) => ({
    ...m,
    items: (m.items || []).map((i: any) => ({ ...i })),
    totals: { ...m.totals },
  }));
  const canon = canonPct != null ? canonPct : Number((src as any).canonPct);
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
    ...(Number.isFinite(canon) ? { canonPct: canon } : {}),
  } as any);
};

const devPct = (got: number, want: number) => (Math.abs(got - want) / want) * 100;
/** §8.91: тот же канон, что у флага — ккал/Ж/У двусторонне + НЕДОБОР белка. */
const floorDev = (t: any, tg: { kcal: number; p: number; f: number; c: number }) =>
  Math.max(devPct(t.kcal, tg.kcal), devPct(t.f, tg.f), devPct(t.c, tg.c), (Math.max(0, tg.p - t.p) / tg.p) * 100);

const TARGETS_3600 = { kcal: 3600, p: 200, f: 95, c: 490 };
const TARGETS_4000 = { kcal: 4000, p: 220, f: 110, c: 532 };

// §8.135: ручной день (kbjuMode='manual' + manualTargetsLocked) — канон пути 2 %.
const MANUAL_2PCT = base({
  weightKg: 85,
  lbmKg: 70,
  goalKcal: 3600,
  goalProteinG: 200,
  goalFatG: 95,
  goalCarbsG: 490,
  mealsCount: 10,
  kbjuMode: 'manual',
  manualTargetsLocked: true,
});

// Контроль: тот же день, но без ручных целей — авто-канон 3 %.
const PLAIN_3500 = base({
  weightKg: 95,
  lbmKg: 80,
  goalKcal: 3600,
  goalProteinG: 200,
  goalFatG: 95,
  goalCarbsG: 490,
});

// §8.135: ручной M4000, где движок выносит 2.5 % (вне 2 %) — проверка проброса canonPct.
const MANUAL_4000_105 = base({
  weightKg: 105,
  lbmKg: 86,
  goalKcal: 4000,
  goalProteinG: 220,
  goalFatG: 110,
  goalCarbsG: 532,
  mealsCount: 5,
  kbjuMode: 'manual',
  manualTargetsLocked: true,
});
const PLAIN_4000_105 = base({
  weightKg: 105,
  lbmKg: 86,
  goalKcal: 4000,
  goalProteinG: 220,
  goalFatG: 110,
  goalCarbsG: 532,
  mealsCount: 5,
});

// §8.135: тот же день 2.56 % при обоих канонах — канон меняет только вердикт.
const MANUAL_4000_85_M4 = base({
  weightKg: 85,
  lbmKg: 70,
  goalKcal: 4000,
  goalProteinG: 220,
  goalFatG: 110,
  goalCarbsG: 532,
  mealsCount: 4,
  kbjuMode: 'manual',
  manualTargetsLocked: true,
});

const EQUAL_PLUS = /(\d+\.?\d*) % → \1 %/;

describe('§8.135: канон рецептурного дня по пути', () => {
  it('ручной день: канон 2 % сводит к ≤2 %, канон 3 % оставляет 2.3 %', () => {
    const r2 = assemble(MANUAL_2PCT, 2);
    const r3 = assemble(MANUAL_2PCT, 3);
    const t2 = sumDayTotals(r2.meals as any);
    const d2 = floorDev(t2, TARGETS_3600);
    const d3 = floorDev(sumDayTotals(r3.meals as any), TARGETS_3600);
    // Замер: canonPct 2 → 3627/200.8/95.5/489.9 (0.75 %); canonPct 3 → 3628/198.3/97.2/488.9
    // (2.32 %). Ручной канон строже — корректор включается по 2 % и доводит день внутрь него.
    expect(
      d2,
      `canon2: ${Math.round(t2.kcal)}/${t2.p.toFixed(1)}/${t2.f.toFixed(1)}/${t2.c.toFixed(1)}`,
    ).toBeLessThanOrEqual(2.0);
    expect(d3, `canon3: девиация ${d3.toFixed(2)}%`).toBeGreaterThan(2.0);
    expect(d3 - d2, `разница канонов ${(d3 - d2).toFixed(2)} п.п.`).toBeGreaterThan(1);
    // Оба дня сведены в СВОЙ канон — красного флага нет.
    expect(r2.withinTolerance).toBe(true);
    expect(r3.withinTolerance).toBe(true);
    // Канон пути виден в строке корректора: (≤2%) на ручном против (≤3%) на общем.
    const corr2 = (r2.notes as string[]).filter((n) => n.includes('Корректор дневных целей'));
    const corr3 = (r3.notes as string[]).filter((n) => n.includes('Корректор дневных целей'));
    expect(corr2, `ноты: ${(r2.notes as string[]).join(' | ')}`).toHaveLength(1);
    expect(corr2[0]).toContain('(≤2%)');
    expect(corr3).toHaveLength(1);
    expect(corr3[0]).toContain('(≤3%)');
    // §8.135: порог предупреждения — тот же канон, поэтому ложного «(>2%)» на сведённом дне нет.
    expect((r2.notes as string[]).filter((n) => n.includes('(>2%)'))).toHaveLength(0);
    expect((r2.notes as string[]).filter((n) => n.includes('не сведён'))).toHaveLength(0);
  });

  it('без canonPct — прежний общий канон 3 %', () => {
    const plain = assemble(PLAIN_3500);
    const explicit = assemble(PLAIN_3500, PLANNER_CONVERGENCE_PCT);
    const t = sumDayTotals(plain.meals as any);
    const d = floorDev(t, TARGETS_3600);
    expect(PLANNER_CONVERGENCE_PCT).toBe(3);
    expect(d, `девиация ${d.toFixed(2)}%`).toBeLessThanOrEqual(PLANNER_CONVERGENCE_PCT);
    expect(plain.withinTolerance).toBe(true);
    // Умолчание = явный общий канон: поле необязательное и не меняет прежнее поведение.
    expect(explicit.withinTolerance).toBe(plain.withinTolerance);
    expect(explicit.deviationPct).toBe(plain.deviationPct);
  });

  it('канонический день не докармливается: на PLAIN_3500 нет нот последней мили ➕', () => {
    const res = assemble(PLAIN_3500);
    const plus = (res.notes as string[]).filter((n) => n.startsWith('➕'));
    // Замер: остаток жира 2 г, остаток У 7 г — любой шаг 5 г поднял бы девиацию дня.
    // Строгая приёмка (§8.50) обязана молчать; старый «равный шаг» писал бы ноту
    // «жир дня → …», хотя худшая ось дня не падала.
    expect(plus, `ноты ➕: ${plus.join(' | ')}`).toHaveLength(0);
  });
});

describe('§8.135: canonPct движка прокидывается в рецептурный контур', () => {
  it('ручной день 2.5 %: движок отдаёт canonPct 2, контур судит тем же каноном', () => {
    const v2 = buildDayPlan(MANUAL_4000_105);
    // Замер: движок 2.5 % (вне ручного канона 2 %), canonPct=2.
    expect(v2.canonPct).toBe(2);
    expect(v2.withinTolerance).toBe(false);
    expect(v2.deviationPct, `движок ${v2.deviationPct}%`).toBeGreaterThan(2);
    expect(v2.deviationPct).toBeLessThanOrEqual(3);
    // Вызывающий передаёт канон движка в `assembleRecipeDay`.
    const day = assemble(MANUAL_4000_105, v2.canonPct);
    // Контракт: флаг рецептурного дня судится переданным canonPct, а не общим 3 %.
    expect(day.withinTolerance).toBe(day.deviationPct <= v2.canonPct);
    // Замер: корректор свёл день к 1.9 % ≤ 2 — контур вернул день в ручной канон.
    // Поэтому буквальное `day.withinTolerance === v2.withinTolerance` здесь НЕ выполняется
    // (движок до корректора — false, контур после корректора — true): это не регресс,
    // а работа §8.135 — канон 2 заставляет корректор дотянуть день.
    expect(day.deviationPct, `контур ${day.deviationPct}%`).toBeLessThanOrEqual(2);
    // Канон виден в строке корректора: postDev 2.4 % > 2 → без «(≤2%)», а на общем каноне — «(≤3%)».
    const corr2 = (day.notes as string[]).filter((n) => n.includes('Корректор дневных целей'));
    expect(corr2, `ноты: ${(day.notes as string[]).join(' | ')}`).toHaveLength(1);
    expect(corr2[0]).toContain('5% → 2.4%');
    expect(corr2[0]).not.toContain('(≤2%)');
    const day3 = assemble(MANUAL_4000_105, PLANNER_CONVERGENCE_PCT);
    const corr3 = (day3.notes as string[]).filter((n) => n.includes('Корректор дневных целей'));
    expect(corr3).toHaveLength(1);
    expect(corr3[0]).toContain('(≤3%)');
    // Контроль авто-пути: тот же профиль без ручных целей — canonPct 3.
    const vAuto = buildDayPlan(PLAIN_4000_105);
    expect(vAuto.canonPct).toBe(PLANNER_CONVERGENCE_PCT);
  });

  it('assembleRecipeDay судит день переданным canonPct: 2.6 % — вне 2 %, но в 3 %', () => {
    const r2 = assemble(MANUAL_4000_85_M4, 2);
    const r3 = assemble(MANUAL_4000_85_M4, PLANNER_CONVERGENCE_PCT);
    const t2 = sumDayTotals(r2.meals as any);
    const t3 = sumDayTotals(r3.meals as any);
    const d2 = floorDev(t2, TARGETS_4000);
    const d3 = floorDev(t3, TARGETS_4000);
    // Замер: 3948/219.5/110.4/518.4 (2.56 %) в обоих — канон меняет ТОЛЬКО вердикт.
    expect(d2, `день ${Math.round(t2.kcal)}/${t2.p.toFixed(1)}/${t2.f.toFixed(1)}/${t2.c.toFixed(1)}`).toBeCloseTo(
      d3,
      6,
    );
    expect(d2, `девиация ${d2.toFixed(2)}%`).toBeGreaterThan(2);
    expect(d2, `девиация ${d2.toFixed(2)}%`).toBeLessThan(3);
    expect(r2.withinTolerance).toBe(false);
    expect(r3.withinTolerance).toBe(true);
  });
});

describe('§8.50: последняя миля не принимает равный шаг', () => {
  it('жировой разрыв 5–15 г при худшей оси не по жиру: масло не добавляется', () => {
    // Замер: 3000 ккал / 85 кг / 5 приёмов / авто — жир 64.7 из 70 (разрыв 5.3 г),
    // худшая ось — ккал 8.97 %. Добавка масла 5 г не меняет худшую ось, поэтому строгая
    // приёмка §8.50 отвергает шаг: ноты «➕ Жир дня» нет (старый «равный шаг» добавил бы
    // масло и напечатал «9.0 % → 9.0 %»).
    const day = base({
      weightKg: 85,
      lbmKg: 70,
      goalKcal: 3000,
      goalProteinG: 180,
      goalFatG: 70,
      goalCarbsG: 480,
      mealsCount: 5,
    });
    const res = assemble(day);
    const notes = res.notes as string[];
    const t = sumDayTotals(res.meals as any);
    const gap = Number(((day as any).goalFatG - t.f).toFixed(1));
    expect(gap, `остаток жира ${gap} г`).toBeGreaterThanOrEqual(5);
    expect(gap, `остаток жира ${gap} г`).toBeLessThanOrEqual(15);
    expect(
      notes.filter((n) => n.startsWith('➕ Жир дня')),
      `ноты: ${notes.join(' | ')}`,
    ).toHaveLength(0);
    expect(
      notes.filter((n) => EQUAL_PLUS.test(n)),
      `ноты: ${notes.join(' | ')}`,
    ).toHaveLength(0);
  });

  it('универсальный скан сетки: ни одной ноты «X % → X %»', () => {
    // Сетка: 3 веса × 4 приёма × тренировка/отдых × авто/ручной × 3 цели = 144 дня.
    // Замер: 144 дня, >100 нот «➕ Жир дня», равных пар — 0.
    const weights = [85, 90, 95];
    const meals = [3, 4, 5, 6];
    const trains = [false, true];
    const modes = ['auto', 'manual'] as const;
    const targets = [
      { goalKcal: 3600, goalProteinG: 200, goalFatG: 95, goalCarbsG: 490 },
      { goalKcal: 4000, goalProteinG: 220, goalFatG: 110, goalCarbsG: 532 },
      { goalKcal: 3000, goalProteinG: 180, goalFatG: 70, goalCarbsG: 480 },
    ];
    let fatNotes = 0;
    const equal: string[] = [];
    for (const w of weights)
      for (const mc of meals)
        for (const tr of trains)
          for (const mode of modes)
            for (const tg of targets) {
              const res = assemble(
                base({
                  weightKg: w,
                  lbmKg: Math.round(w * 0.82),
                  mealsCount: mc,
                  isTrainingDay: tr,
                  ...tg,
                  ...(mode === 'manual' ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
                }),
              );
              for (const n of res.notes as string[]) {
                if (n.startsWith('➕ Жир дня')) fatNotes++;
                // §8.50: строгий шаг — до/после не могут совпасть даже в десятых.
                if (EQUAL_PLUS.test(n)) equal.push(n);
              }
            }
    expect(fatNotes, 'скан не вакуумный: стадия должна была сработать').toBeGreaterThan(100);
    expect(equal, `равные шаги: ${equal.join(' | ')}`).toHaveLength(0);
  }, 300000);
});
