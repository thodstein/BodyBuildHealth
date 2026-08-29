import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { EXOTIC_FOOD_IDS, isHerbSpiceId, isPureSupplementId, isProteinPowderId, stapleFamilyOf, QUOTA_LIMITS } from '../food-availability';

const catOf = (id: string): string => FOOD_DB.find(f => f.id === id)?.category || '';

/**
 * Эпик F1: ГАРАНТИИ РЕАЛИСТИЧНОСТИ ТАРЕЛКИ.
 * Матрица профилей × режимов: никаких экзотических продуктов, трав-приправ,
 * добавок-«еды» (креатин 21 г и т.п.); порошок ≤3 приёмов (2 regular + postw);
 * гарнир-семейство ≤3 приёмов (овсянка ≤2); орехи ≤75 г; масла ≤2 приёмов;
 * фрукты ≤4 приёмов; яйца ≤240 г; клетчатка в коридоре; цельный белок
 * основного приёма ≥80 г у атлетов ≥80 кг; kcal = формула Атвотера.
 */

const profiles: any[] = [
  { name: 'масса 90кг/5пр/трен', weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male', goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 400, mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'max', eveningLowCarb: false },
  { name: 'масса 90кг/5пр/отдых', weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male', goalKcal: 2900, goalProteinG: 180, goalFatG: 90, goalCarbsG: 300, mealsCount: 5, isTrainingDay: false, budget: 'medium', dayOffset: 1, cyclePhase: 'course', variety: 'max', eveningLowCarb: false },
  { name: 'сушка 80кг/4пр/трен', weightKg: 80, lbmKg: 64, bodyFatPct: 15, sex: 'male', goalKcal: 1900, goalProteinG: 170, goalFatG: 50, goalCarbsG: 155, mealsCount: 4, isTrainingDay: true, trainStartMin: 18 * 60, trainDurationMin: 75, budget: 'medium', dayOffset: 2, cyclePhase: 'course', variety: 'max', eveningLowCarb: false },
  { name: 'масса 100кг/6пр/трен/max', weightKg: 100, lbmKg: 85, bodyFatPct: 15, sex: 'male', goalKcal: 4200, goalProteinG: 230, goalFatG: 100, goalCarbsG: 530, mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true, budget: 'max', dayOffset: 3, cyclePhase: 'course', variety: 'max', eveningLowCarb: false },
  { name: 'сушка 58кг/4пр/отдых/жен', weightKg: 58, lbmKg: 43.5, bodyFatPct: 24, sex: 'female', goalKcal: 1500, goalProteinG: 110, goalFatG: 48, goalCarbsG: 125, mealsCount: 4, isTrainingDay: false, budget: 'medium', dayOffset: 4, cyclePhase: 'course', variety: 'max', eveningLowCarb: false },
  { name: 'минимал 85кг/3пр/трен', weightKg: 85, lbmKg: 70, bodyFatPct: 18, sex: 'male', goalKcal: 2600, goalProteinG: 170, goalFatG: 70, goalCarbsG: 300, mealsCount: 3, isTrainingDay: true, trainStartMin: 19 * 60, trainDurationMin: 60, budget: 'low', dayOffset: 5, cyclePhase: 'course', variety: 'minimal', eveningLowCarb: false },
];

describe('F1: гарантии реалистичности тарелки', () => {
  for (const prof of profiles) {
    for (const salt of [1, 2, 3]) {
      it(`${prof.name} / соль ${salt}`, () => {
        const plan = buildDayPlan({ ...prof, randomSalt: salt });
        const items = plan.meals.flatMap(m => m.items.map(it => ({ ...it, mealType: m.type })));

        // 1. Экзотика / травы / чистые добавки — НИКОГДА в тарелке автогенерации.
        const junk = items.filter(it => EXOTIC_FOOD_IDS.has(it.id)
          || isHerbSpiceId(it.id)
          || (catOf(it.id) === 'supplement' && isPureSupplementId(it.id, 'supplement') && it.role !== 'supplement'));
        expect(junk, `экзотика/травы/добавки-еда: ${junk.map(j => `${j.name} ${j.amount}г`).join('; ')}`).toEqual([]);

        // 2. Креатин — только фикс-доза ≤5 г (иначе коррекции раздували до 21 г).
        for (const it of items.filter(i => i.role === 'supplement')) {
          expect(it.amount, `${it.name} ${it.amount}г — добавка свыше 5 г`).toBeLessThanOrEqual(5);
        }

        // 3. Порошок: ≤3 приёмов в день (2 regular + пост-трен exempt).
        const powderMeals = plan.meals.filter(m => m.items.some(it => isProteinPowderId(it.id))).length;
        expect(powderMeals, `${prof.name}: ${powderMeals} приёмов с порошком (лимит 3)`).toBeLessThanOrEqual(3);

        // 4. Семейства гарниров: любое ≤3 приёмов, овсянка ≤2.
        const famMeals = new Map<string, number>();
        for (const m of plan.meals) {
          const fams = new Set(m.items.map(it => stapleFamilyOf(it.id)).filter(Boolean) as string[]);
          for (const fam of fams) famMeals.set(fam, (famMeals.get(fam) || 0) + 1);
        }
        for (const [fam, n] of famMeals) {
          if (fam === 'nuts' || fam === 'seeds' || fam === 'oils') continue;
          const cap = fam === 'oats' ? QUOTA_LIMITS.maxOatsFamilyMeals : QUOTA_LIMITS.maxFamilyMeals;
          expect(n, `${prof.name}: семейство «${fam}» в ${n} приёмах (лимит ${cap})`).toBeLessThanOrEqual(cap);
        }

        // 5. Орехи/семена ≤75 г/день суммарно (2 приёма × ~20 г + Mg-доза pre-sleep), масла ≤2 приёмов.
        const nutG = items.filter(it => ['nuts', 'seeds'].includes(stapleFamilyOf(it.id) || '')).reduce((s, it) => s + it.amount, 0);
        expect(nutG, `${prof.name}: орехов/семян ${nutG} г (лимит 75)`).toBeLessThanOrEqual(75);
        const oilMeals = plan.meals.filter(m => m.items.some(it => stapleFamilyOf(it.id) === 'oils')).length;
        expect(oilMeals, `${prof.name}: масел в ${oilMeals} приёмах (лимит 2)`).toBeLessThanOrEqual(2);

        // 6. Фрукты ≤4 приёмов (3 + мелатонин-порция pre-sleep); яйца ≤240 г/день.
        const fruitMeals = plan.meals.filter(m => m.items.some(it => it.role === 'fruit')).length;
        expect(fruitMeals, `${prof.name}: фруктов в ${fruitMeals} приёмах (лимит 4)`).toBeLessThanOrEqual(4);
        const eggG = items.filter(it => it.id === 'egg_whole').reduce((s, it) => s + it.amount, 0);
        expect(eggG, `${prof.name}: яиц ${eggG} г (лимит 240)`).toBeLessThanOrEqual(240);

        // 7. Клетчатка ≤80 г (кап 14 г/1000 ккал + посадка пере-добавляет углеводные носители).
        expect(plan.totals.fiber, `${prof.name}: клетчатка ${plan.totals.fiber} г`).toBeLessThanOrEqual(80);

        // 8. Цельный белок основного приёма ≥80 г у атлетов ≥80 кг (не «треска 57 г»).
        if (prof.weightKg >= 80) {
          for (const m of plan.meals.filter(mm => ['breakfast', 'lunch', 'dinner'].includes(mm.type))) {
            const whole = m.items.filter(it => it.role === 'protein' && !isProteinPowderId(it.id));
            for (const it of whole) {
              expect(it.amount, `${prof.name} / ${m.label}: ${it.name} ${it.amount} г (мин 80)`).toBeGreaterThanOrEqual(80);
            }
          }
        }

        // 9. Atwater: день = 4Б+9Ж+4У (пер-итем формула гарантируется движком).
        const atwater = Math.round(4 * plan.totals.p + 9 * plan.totals.f + 4 * plan.totals.c);
        expect(Math.abs(plan.totals.kcal - atwater), `${prof.name}: kcal ${plan.totals.kcal} vs формула ${atwater}`).toBeLessThanOrEqual(120);
      });
    }
  }
});
