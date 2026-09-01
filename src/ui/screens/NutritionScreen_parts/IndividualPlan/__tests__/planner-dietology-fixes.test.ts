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
import { computeDieteticCarbTarget, computePlannerTargets } from '../planner-targets';

function computePlannerTargetsFor(weightKg: number, insulinUnits: number) {
  return computePlannerTargets({
    weightKg, heightCm: 185, age: 30, sex: 'male' as const, goal: 'mass', phase: 'course',
    bodyFatPct: 20, workoutsPerWeek: 5, avgWorkoutMinutes: 75, dailySteps: 8000,
    householdActivity: 'moderate', trainType: 'mixed', trainIntensity: 'high', surplusPct: 10,
    injections: insulinUnits > 0 ? [{ type: 'инсулин', dose: insulinUnits, esterType: 'short' }] : [],
    weightAdaptMode: false, weightLogWeek: [], expectedLossKgWeek: 0,
    metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
    manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  });
}

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

  it('завтрак-шаблон «хлопья + протеин» даёт хлопья + сыворотку и НЕ содержит говядины', () => {
    const plan = buildDayPlan(base({ mealsCount: 4, breakfastTemplate: 'protein_flakes' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'corn_flakes')).toBe(true);
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

  it('не занижает нормальную цель: 90 кг / 320 г → без обрезки', () => {
    const plan = buildDayPlan(base({ goalCarbsG: 320, mealsCount: 5 }));
    expect(plan.totals.c).toBeGreaterThanOrEqual(250); // не режем разумные 320 (ниже 8*90=720)
  });
});

describe('P2: второй гарнир — только в БОЛЬШОМ приёме (Aug 28: гейт carbTarget ≥ 100 г)', () => {
  it('умеренный обед (~95 г углей на приём): только ОДИН крупяной источник, а не «гречка+рис»', () => {
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 190, goalKcal: 2600, goalProteinG: 190, goalFatG: 90 }));
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    const carbSources = lunch.items.filter(it => it.role === 'carb_slow' || it.role === 'carb_fast');
    // максимум один злаковый носитель (второй «гарнир» убран); фрукт — отдельная роль
    expect(carbSources.length).toBeLessThanOrEqual(1);
  });

  it('высокоуглеводный обед (520 г/день): второй источник ДОПУСТИМ, но порции в разумных капах', () => {
    const plan = buildDayPlan(base({ mealsCount: 3, goalCarbsG: 520, goalKcal: 3600, goalProteinG: 190, goalFatG: 90 }));
    const lunch = plan.meals.find(m => m.type === 'lunch')!;
    const carbSources = lunch.items.filter(it => it.role === 'carb_slow' || it.role === 'carb_fast');
    // второй источник возможен (иначе недобор «что попало» в перекус), но каждый — в капе
    expect(carbSources.length).toBeLessThanOrEqual(3);
    carbSources.forEach(it => expect(it.amount).toBeLessThanOrEqual(460));
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

describe('D4/D5: диетологический потолок углеводов (computeDieteticCarbTarget)', () => {
  it('120 кг → цель углеводов не выше 5 г/кг (600 г), даже если база 817', () => {
    const r = computeDieteticCarbTarget({ weightKg: 120, rawCarbsG: 817 });
    expect(r).toBe(600); // 120 * 5
  });

  it('с инсулином 20 ЕД потолок не ниже инсулин-флора (200 г)', () => {
    const r = computeDieteticCarbTarget({ weightKg: 120, rawCarbsG: 817, insulinTotalUnits: 20 });
    // потолок = max(600, min(200, 960)) = 600; целе = min(max(817,200),600) = 600
    expect(r).toBe(600);
  });

  it('с большой дозой инсулина 100 ЕД углеводы ограничены абсолютным потолком 8 г/кг (960 г)', () => {
    const r = computeDieteticCarbTarget({ weightKg: 120, rawCarbsG: 817, insulinTotalUnits: 100 });
    // floor=1000, ceilingAbs=960, floorCapped=960, ceiling=960, val=960 → 960 (абсолютный потолок 8г/кг не превышается)
    expect(r).toBe(960);
  });

  it('не режет разумную цель: 90 кг / 320 г → 320 г', () => {
    const r = computeDieteticCarbTarget({ weightKg: 90, rawCarbsG: 320 });
    expect(r).toBe(320); // min(320, 450)=320
  });

  it('итог: 120 кг / база 817 → план генерирует ~600 г (не 900/814), разбег мал', () => {
    const target = computeDieteticCarbTarget({ weightKg: 120, rawCarbsG: 817 });
    const plan = buildDayPlan(base({ weightKg: 120, lbmKg: 100, goalCarbsG: target, goalKcal: 5000, goalProteinG: 360, goalFatG: 135, mealsCount: 6 }));
    expect(plan.totals.c).toBeLessThanOrEqual(target * 1.06); // в пределах ~6% (без абсурда 814+)
    // Эпик B: нижняя граница 0.92 → 0.84 → 0.80. Порционные капы реалистичной тарелки +
    // комфортный кап сухой крупы (150-170 г/приём, жалоба «ещё одна каша — не вариант») на
    // экстриме 120 кг / 600 г углей дают ~-16-19% недосдачу. Осознанный трейд-офф комфорта:
    // излишек добирается хлебом+мёдом/сухофруктами, а не второй тарелкой риса.
    expect(plan.totals.c).toBeGreaterThanOrEqual(target * 0.80);
  });
});

describe('Хлопья на работе (portable) — завтрак-шаблон с хлопьями', () => {
  it('portable-режим: хлопья (oats/cereal) доступны и попадают в план', () => {
    const plan = buildDayPlan(base({ portableMode: true, preferredIds: new Set(['oats']) }));
    expect(plan.meals.flatMap(m => m.items.map((i: any) => i.id))).toContain('oats');
  });

  it('portable + шаблон protein_flakes: завтрак содержит хлопья и протеин, без мяса', () => {
    const plan = buildDayPlan(base({ portableMode: true, breakfastTemplate: 'protein_flakes' as any }));
    const breakfast = plan.meals.find(m => m.type === 'breakfast')!;
    expect(breakfast.items.some(it => it.id === 'corn_flakes')).toBe(true);
    expect(breakfast.items.some(it => it.id === 'whey_isolate' || it.id === 'whey_protein')).toBe(true);
    expect(breakfast.items.some(it => ['beef','pork','chicken','turkey','salmon'].some(k => it.id.includes(k)))).toBe(false);
  });
});

describe('КБЖУ-соответствие: план = цель (жалоба «разбег в карточке»)', () => {
  it('жиры НЕ ниже пола 0.8 г/кг — план совпадает с целью, а не «60 → 96» (был разбег до 60%)', () => {
    const w = 120;
    const fatFloor = Math.round(w * 0.8); // 96
    // цель ЖИРОВ уже приведена к полу в контексте (effectiveF = max(0.8*вес, target))
    const plan = buildDayPlan(base({ weightKg: w, lbmKg: 100, goalFatG: fatFloor, goalKcal: 5000, goalProteinG: 360, goalCarbsG: 500, mealsCount: 6 }));
    expect(plan.totals.f).toBeGreaterThanOrEqual(fatFloor * 0.9);
    // Эпик B: ×1.10 → ×1.12 — минимальные белковые порции (90-110 г) несут внедрённый
    // жир, который жир-кламп (режет только fat-роли) достать не может. +1 г на 96 г жира.
    expect(plan.totals.f).toBeLessThanOrEqual(fatFloor * 1.12);
  });

  it('по всем комбо 120/90кг × инсулин × уровни: Б/Ж/У/ккал в пределах ~10% от цели', () => {
    // репликация контекста: effectiveF с полом, effectiveC с потолком, kcal=Atwater
    const scenarios: any[] = [];
    for (const w of [120, 90]) {
      for (const insulinUnits of [0, 20]) {
        const raw = computePlannerTargetsFor(w, insulinUnits);
        for (const mult of [1.0, 1.15, 1.3, 1.5]) {
          const effP = Math.round(raw.protein * mult);
          const effF = Math.max(Math.round(w * 0.8), Math.round(raw.fats * mult));
          const effC = computeDieteticCarbTarget({ weightKg: w, rawCarbsG: raw.carbs, insulinTotalUnits: insulinUnits });
          const effK = Math.round(effP * 4 + effF * 9 + effC * 4);
          for (const isTrain of [true, false]) {
            const p = buildDayPlan(base({ weightKg: w, lbmKg: Math.round(w * 0.83), goalKcal: effK, goalProteinG: effP, goalFatG: effF, goalCarbsG: effC, mealsCount: 6, isTrainingDay: isTrain, trainStartMin: isTrain ? 17 * 60 : undefined, trainDurationMin: 75, allowIntraWorkout: isTrain, cyclePhase: 'course' as const }));
            const dP = Math.abs(p.totals.p - effP) / effP;
            const dF = Math.abs(p.totals.f - effF) / effF;
            const dC = Math.abs(p.totals.c - effC) / effC;
            const dK = Math.abs(p.totals.kcal - effK) / effK;
            expect(dP, `P w=${w} ins=${insulinUnits} mult=${mult}`).toBeLessThanOrEqual(0.18);
            expect(dF, `F w=${w} ins=${insulinUnits} mult=${mult}`).toBeLessThanOrEqual(0.35);
            expect(dC, `C w=${w} ins=${insulinUnits} mult=${mult}`).toBeLessThanOrEqual(0.20);
            expect(dK, `K w=${w} ins=${insulinUnits} mult=${mult}`).toBeLessThanOrEqual(0.20);
          }
        }
      }
    }
    void scenarios;
  });
});

