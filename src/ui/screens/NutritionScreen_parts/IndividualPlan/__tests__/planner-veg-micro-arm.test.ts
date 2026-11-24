import { describe, it, expect } from 'vitest';
import { preferVegPlan122 } from '../meal-plan-engine';
import { scoreDayQuality } from '../planner-quality-score';
import { analyzeMicroCoverage, sumMicros, lowCountForScore } from '../planner-micro-coverage';
import { FOOD_DB } from '../../../../../core/nutrition-database';

/**
 * §8.135 «овощное плечо сравнивается с честным и по микро-оси» (замок сравнения).
 *
 * Раньше `preferVegPlan122` брал балл качества БЕЗ микро (`scoreDayQuality` без
 * `microCoverage`), хотя микро-ось у дня уже считается (§ мимо). Овощной день, добитый
 * низко-нутриентным наполнителем (граммов больше, микро меньше), выигрывал у честного по
 * баллу только потому, что микро не смотрели. Теперь микро КАЖДОГО плеча считается из ЕГО
 * финальных позиций и передаётся обоим одинаково.
 *
 * Замер сетки 160 дней (10 профилей × 3–6 приёмов × трен/отдых × авто/руч, как в
 * `planner-veg-floor-8122`): выбор плеча МЕНЯЕТСЯ на 0 днях — микро-ось симметрична и на
 * реальной сетке лишь сужает отрыв (48 из 160 дней балл реально сдвигается, 15 дней — разное
 * число дефицитов у плеч, но перевес всегда решают граммы/виды/обрезки/тарелки).
 *
 * Замок ниже — на САМОМ сравнении, где микро обязан решать:
 *   кейс A: честный день — шпинат 200 г (10 дефицитов из 16), овощной — огурец 250 г
 *           (14 из 16, +50 г граммов); при равных обрезках/вёдрах/девиации балл без микро
 *           у плеч ОДИН (68/68), с микро честное выше (63 против 61) — овощной отвергается
 *           (false). Без микро-оси тест бы прошёл наоборот — он держит именно разницу.
 *   кейс B: микро равное (огурец 200 → 250 г, 14/14): овощной выигрывает граммами (true).
 */

const WEIGHT = 80;

const item = (
  id: string,
  role: string,
  amount: number,
  p: number,
  f: number,
  c: number,
  kcal: number,
  fiber: number,
) => ({
  id,
  role,
  amount,
  p,
  f,
  c,
  kcal,
  fiber,
});

const protein = item('chicken_breast', 'protein', 150, 34.5, 2.7, 0, 165, 0);
const carb = item('buckwheat', 'carb_slow', 100, 12.6, 3.3, 62, 313, 10);

/** День минимальной формы: один основной приём, прочие оси у плеч одинаковы. */
const day = (vegItem: any): any => {
  const totals = { p: 50, f: 10, c: 100, kcal: 690, fiber: 12 };
  return {
    dayIndex: 0,
    isTrainingDay: false,
    meals: [
      {
        label: 'Обед',
        type: 'lunch',
        items: [vegItem, protein, carb],
        totals,
        target: { p: 40, f: 10, c: 90 },
      },
    ],
    totals,
    notes: [],
    deviationPct: 1,
  };
};

const vegSpinach = (g: number) =>
  item('spinach', 'veg', g, (2.9 * g) / 100, (0.4 * g) / 100, (3.6 * g) / 100, (23 * g) / 100, (2.2 * g) / 100);
const vegCucumber = (g: number) =>
  item('cucumber', 'veg', g, (0.7 * g) / 100, (0.1 * g) / 100, (2.9 * g) / 100, (15 * g) / 100, (0.5 * g) / 100);

const INPUT: any = {
  weightKg: WEIGHT,
  lbmKg: 66,
  sex: 'male',
  cyclePhase: 'none',
  isTrainingDay: false,
  goalKcal: 690,
  goalProteinG: 50,
  goalFatG: 10,
  goalCarbsG: 100,
};

const microOf = (d: any): { total: number; low: number } => {
  const items = (d.meals || []).flatMap((m: any) =>
    (m.items || []).map((it: any) => ({ id: it.id, amount: it.amount })),
  );
  const cov: any = analyzeMicroCoverage(sumMicros(items, FOOD_DB as any), 'male', WEIGHT, 'none' as any, false);
  return { total: cov.coverage.length, low: lowCountForScore(cov.coverage as any) };
};

const scoreWith = (d: any, micro?: { lowCount: number; total: number }): number =>
  Number(scoreDayQuality(d.meals as any[], { weightKg: WEIGHT, microCoverage: micro })?.total);

describe('§8.135: овощное плечо судится по микро-оси так же, как честное', () => {
  it('кейс A: больше граммов, но хуже микро — овощной день отвергается', () => {
    const plain = day(vegSpinach(200));
    const veg = day(vegCucumber(250)); // граммов больше на 50 г, микро — меньше
    const mp = microOf(plain);
    const mv = microOf(veg);
    expect(mv.low, 'огурец 250 г не должен быть «богаче» шпината').toBeGreaterThan(mp.low);
    // Без микро-оси плечи неразличимы по баллу — ровно та дыра, которую закрывает правка.
    expect(scoreWith(veg)).toBe(scoreWith(plain));
    // С микро честное плечо выше.
    expect(scoreWith(veg, { lowCount: mv.low, total: mv.total })).toBeLessThan(
      scoreWith(plain, { lowCount: mp.low, total: mp.total }),
    );
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(false);
  });

  it('кейс B: при равном микро овощное плечо выигрывает граммами', () => {
    const plain = day(vegCucumber(200));
    const veg = day(vegCucumber(250));
    expect(microOf(veg).low).toBe(microOf(plain).low);
    expect(preferVegPlan122(veg, plain, INPUT)).toBe(true);
  });
});
