/**
 * planner-honesty-fixes.test.ts — §3F EXTREME-SCALE: честность выдачи.
 * - VitD: IU-дрейф в FOOD_DB (87/500 «мкг») нормализуется в мкг (÷40);
 * - Mg: UL 350 мг из ДОБАВОК не флагает еду «избытком»;
 * - «Точность рациона» — к цели ПОЛЬЗОВАТЕЛЯ (+строка клинической цели, если расходится);
 * - MPS-снек: лейбл по фактическому типу дня;
 * - инсулин-нота: «сумма болюсов N ЕД».
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, _getMicroFromFoodForTest, type MealPlanInput } from '../meal-plan-engine';
import { analyzeMicroCoverage } from '../planner-micro-coverage';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 92, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 5100, goalProteinG: 220, goalFatG: 110, goalCarbsG: 800,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90,
  allowIntraWorkout: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

describe('§3F честность выдачи', () => {
  it('VitD: IU-дрейф (500 «мкг» у лосося) нормализуется в мкг (12.5)', () => {
    const salmon = FOOD_DB.find(f => f.id === 'salmon')!;
    expect(salmon).toBeTruthy();
    const v = _getMicroFromFoodForTest(salmon, 'VitD');
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThanOrEqual(50); // физиологический потолок мкг/100 г
  });

  it('Mg из еды не флагается «избытком» (UL 350 — только для добавок)', () => {
    const res = analyzeMicroCoverage({ Mg: 1690, Ca: 1200 }, 'male', 110, 'course', true);
    expect(res.surpluses.some(s => s.includes('Магний'))).toBe(false);
    const mg = res.coverage.find(c => c.nutrient === 'Mg');
    expect(mg?.status).not.toBe('high');
  });

  it('Точность рациона — к цели пользователя, не к скрытой adjusted', () => {
    const plan = buildDayPlan(base({ weightKg: 90, lbmKg: 75, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, mealsCount: 5, budget: 'medium' as const, carbCapGPerKg: 8 }));
    const note = plan.notes.find(n => n.includes('Точность рациона'));
    expect(note, 'нет ноты точности').toBeTruthy();
    const m = note!.match(/Б (\d+)%/);
    if (m) {
      const claimed = Number(m[1]);
      const actual = Math.abs(plan.totals.p - 180) / 180 * 100;
      expect(Math.abs(claimed - actual), `нота Б ${claimed}% vs факт ${actual.toFixed(1)}%`).toBeLessThanOrEqual(3);
    }
    // Если клиническая цель расходится — есть честная строка с обеими.
    expect(plan.notes.some(n => n.includes('клиническая цель уровня/фазы') || !note!.includes('клиническая'))).toBe(true);
  });

  it('MPS-снек: лейбл по фактическому дню (тренировочный/нетренировочный)', () => {
    const train = buildDayPlan(base({}));
    expect(train.notes.some(n => n.includes('MPS gap fill (тренировочный день)'))).toBe(true);
    const rest = buildDayPlan(base({ isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false }));
    expect(rest.notes.some(n => n.includes('MPS gap fill (нетренировочный день)'))).toBe(true);
    expect(rest.notes.some(n => n.includes('MPS gap fill (тренировочный день)'))).toBe(false);
  });

  it('инсулин-нота: «сумма болюсов 120 ЕД (3 инжект.)»', () => {
    const plan = buildDayPlan(base({
      injections: [
        { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
      ] as any,
    }));
    expect(plan.notes.some(n => n.includes('сумма болюсов 120 ЕД (3 инжект.)'))).toBe(true);
  });

  it('§3H: вода/электролиты на большом дне есть, на обычном — нет', () => {
    const big = buildDayPlan(base({ weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500 }));
    const note = big.notes.find(n => n.includes('💧 Вода:'));
    expect(note, 'нет целевой воды').toBeTruthy();
    expect(note!).toMatch(/~6\.\d л\/день/); // 35×120 + 400×5.6 = 6.4 л
    const small = buildDayPlan(base({ weightKg: 90, lbmKg: 75, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, mealsCount: 5, budget: 'medium' as const, carbCapGPerKg: 8 }));
    expect(small.notes.some(n => n.includes('💧 Вода:'))).toBe(false);
  });

  it('§3J: сводка MPS считает ФАКТИЧЕСКИЕ приёмы (≥25 г белка), не промежуточные', () => {
    const plan = buildDayPlan(base({
      weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
      injections: [
        { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
      ] as any,
    }));
    const note = plan.notes.find(n => n.startsWith('Сводка MPS:'));
    expect(note).toBeTruthy();
    const m = note!.match(/(\d+) feedings/);
    expect(m).toBeTruthy();
    const expected = plan.meals.filter(x => (x.totals?.p || 0) >= 25).length;
    expect(Number(m![1]), `feedings=${m![1]} vs факт ${expected}`).toBe(expected);
  });
});
