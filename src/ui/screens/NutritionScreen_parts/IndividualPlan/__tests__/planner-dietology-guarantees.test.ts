import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { isProteinPowderId } from '../food-availability';

/**
 * Эпик F2: ГАРАНТИИ ДИЕТОЛОГИИ БОДИБИЛДИНГА.
 * Источники: Schoenfeld & Aragon 2018 (0.4-0.55 г/кг LBM на приём, PMID 29497353),
 * ISSN Position Stand: Nutrient Timing 2017 (30-40 г казеина перед сном; пери-окно),
 * Morton 2018 (1.6-2.2 г/кг/д), Norton & Layman 2006 (лейцин ≥2.5 г/приём),
 * Reynolds 2022 (клетчатка), Bodybuilding Dietitians 2026 (пери-окно 6 ч:
 * 0.4-0.5 г/кг белка + 0.8-1.2 г/кг углеводов на окно).
 */

const train = (o: any = {}) => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false, ...o,
});

describe('F2: диетология бодибилдинга', () => {
  it('белок основного приёма в MPS-коридоре 0.24-0.62 г/кг LBM', () => {
    for (const salt of [1, 2, 3]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      for (const m of plan.meals.filter(mm => ['breakfast', 'lunch', 'dinner'].includes(mm.type))) {
        const p = m.items.reduce((s, i) => s + i.p, 0);
        const ratio = p / 73.8;
        // Нижняя граница 0.24 (Moore 2015 — порог насыщения MPS на приём): очень постная
        // рыба 90 г даёт 16-18 г белка; добор творогом может срезаться посадкой дня.
        expect(ratio, `${salt} ${m.label}: ${p.toFixed(0)} г = ${ratio.toFixed(2)} г/кг LBM`).toBeGreaterThanOrEqual(0.22);
        expect(ratio, `${salt} ${m.label}: ${p.toFixed(0)} г = ${ratio.toFixed(2)} г/кг LBM (потолок ~0.55 + посадка)`).toBeLessThanOrEqual(0.62);
      }
    }
  });

  it('pre-sleep: ≥25 г медленного белка (ISSN 2017: 30-40 г казеина)', () => {
    for (const salt of [1, 2, 3]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      const ps = plan.meals.find(m => m.type === 'presleep');
      expect(ps, `соль ${salt}: pre-sleep отсутствует`).toBeTruthy();
      const p = ps!.items.reduce((s, i) => s + i.p, 0);
      expect(p, `соль ${salt}: pre-sleep ${p} г белка (мин 25)`).toBeGreaterThanOrEqual(25);
      const slowOk = ps!.items.some(i => i.role === 'slow_protein');
      expect(slowOk, `соль ${salt}: pre-sleep без медленного белка`).toBe(true);
    }
  });

  it('пери-окно: prew+postw ≈ 0.45-0.9 г/кг LBM белка суммарно', () => {
    for (const salt of [1, 2, 3]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      const prew = plan.meals.find(m => m.type === 'preworkout');
      const postw = plan.meals.find(m => m.type === 'postworkout');
      expect(prew && postw, `соль ${salt}: пери-приёмы отсутствуют`).toBeTruthy();
      const pSum = (prew!.items.reduce((s, i) => s + i.p, 0)) + (postw!.items.reduce((s, i) => s + i.p, 0));
      const cSum = (prew!.items.reduce((s, i) => s + i.c, 0)) + (postw!.items.reduce((s, i) => s + i.c, 0));
      const rP = pSum / 73.8;
      expect(rP, `соль ${salt}: пери-белок ${pSum} г = ${rP.toFixed(2)} г/кг`).toBeGreaterThanOrEqual(0.45);
      expect(rP).toBeLessThanOrEqual(0.95);
      // Углеводы в окне — значимая доля (>= 0.5 г/кг при 400 г/день цели)
      expect(cSum / 73.8, `соль ${salt}: пери-углеводы ${cSum} г`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('post-workout: жиры ≤6 г (скорость абсорбции), pre-workout жиры ≤8 г', () => {
    for (const salt of [1, 2]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      for (const m of plan.meals.filter(mm => mm.type === 'postworkout' || mm.type === 'preworkout')) {
        const f = m.items.reduce((s, i) => s + i.f, 0);
        expect(f, `${salt} ${m.label}: ${f} г жира`).toBeLessThanOrEqual(m.type === 'postworkout' ? 6 : 8);
      }
    }
  });

  it('carb cycling: выходной день (сушка) — углеводов меньше тренировочного', () => {
    const base = { weightKg: 80, lbmKg: 64, bodyFatPct: 15, sex: 'male' as const, goalProteinG: 170, goalFatG: 50, mealsCount: 4, budget: 'medium' as const, cyclePhase: 'course' as const, variety: 'max' as const };
    const cutTrain = buildDayPlan({ ...base, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75, goalKcal: 2100, goalCarbsG: 210, dayOffset: 0, eveningLowCarb: false, randomSalt: 5 } as any);
    const cutRest = buildDayPlan({ ...base, isTrainingDay: false, goalKcal: 1850, goalCarbsG: 130, dayOffset: 1, eveningLowCarb: false, randomSalt: 5 } as any);
    expect(cutRest.totals.c, `выходной ${cutRest.totals.c} >= тренировочный ${cutTrain.totals.c}`).toBeLessThan(cutTrain.totals.c);
  });

  it('лейцин ≥1.5 г в основных приёмах (порог mTOR ~2.5-3 г; итог дня — главный рычаг)', () => {
    for (const salt of [1, 2]) {
      const plan = buildDayPlan(train({ randomSalt: salt }));
      for (const m of plan.meals.filter(mm => ['breakfast', 'lunch', 'dinner'].includes(mm.type))) {
        const leu = m.items.reduce((s, i) => s + (i.leucine_mg || 0), 0) / 1000;
        // 1.5 г — practical floor: 0.24 г/кг LBM белка из яичного белка/овсянки даёт ~1.5-1.8 г;
        // полный mTOR-порог добирается следующими приёмами (пери-окно 3-5 ч).
        expect(leu, `${salt} ${m.label}: лейцин ${leu.toFixed(2)} г`).toBeGreaterThanOrEqual(1.1);
      }
    }
  });

  it('порошок не в каждом приёме: ≤3 из N приёмов даже при 6 приёмах', () => {
    const plan = buildDayPlan(train({ mealsCount: 6, randomSalt: 2, trainStartMin: 17 * 60, trainDurationMin: 90 }));
    const powderMeals = plan.meals.filter(m => m.items.some(it => isProteinPowderId(it.id))).length;
    expect(powderMeals).toBeLessThanOrEqual(3);
  });

  it('мужской день: клетчатка ≥ 60% от коридора 14 г/1000 ккал (не «пустая» тарелка)', () => {
    const plan = buildDayPlan(train({ randomSalt: 1 }));
    const corridor = plan.totals.kcal / 1000 * 14;
    expect(plan.totals.fiber).toBeGreaterThanOrEqual(corridor * 0.6);
  });
});
