import { describe, it, expect } from 'vitest';
import { buildDayPlan, capSecondaryStapleExcess } from '../meal-plan-engine';

// Lock-тесты P2-3 «excess-control второго гарнира» (план §3):
// «ведро» = НЕ-главный carb-пункт свыше 30% ккал приёма (батат 330 к рису).
// Главный пункт exempt (основа тарелки), белок/жиры/овощи/фрукты exempt
// (своя физика и свои капы), peri/pre-sleep exempt (фикс-бюджеты).
// §5-«25% для всех» недостижим без сноса legit-структуры: дамп 8 конфигов —
// 119/263 items >25% (мясные пары, жиры, peri-окна), а вторых гарниров
// выше 30% в живой матрице ноль (максимум 29%).
const normalBase = (overrides: any = {}) => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'medium' as const, eveningLowCarb: false,
  ...overrides,
});

const hvBase = (overrides: any = {}) => ({
  weightKg: 110, lbmKg: 90, bodyFatPct: 15, sex: 'male' as const,
  goalKcal: 5500, goalProteinG: 260, goalFatG: 110, goalCarbsG: 900,
  mealsCount: 9, isTrainingDay: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3,
  wakeTime: '07:00', lunchTime: '12:30', dinnerTime: '19:00', bedTime: '23:00',
  trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true,
  ...overrides,
} as any);

const SECONDARY_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'snack2', 'snack3', 'snack4', 'snack5', 'snack6']);

describe('P2-3 excess-control (второй гарнир ≤30%)', () => {
  it('ведро режется: рис 150 + батат 330 → батат ≤30%, рис цел, нота есть', () => {
    const meals: any[] = [{
      label: 'Обед', type: 'lunch',
      items: [
        { id: 'rice_white', name: 'Рис', amount: 150, role: 'carb_slow', kcal: 516, p: 10, f: 1, c: 117, fiber: 2 },
        { id: 'sweet_potato', name: 'Батат', amount: 330, role: 'carb_slow', kcal: 284, p: 5, f: 0, c: 66, fiber: 10 },
      ],
      totals: { kcal: 800, p: 15, f: 1, c: 183 },
    }];
    const notes = capSecondaryStapleExcess(meals);
    const lunch = meals[0];
    const rice = lunch.items.find((i: any) => i.id === 'rice_white')!;
    const potato = lunch.items.find((i: any) => i.id === 'sweet_potato')!;
    expect(rice.amount).toBe(150);
    expect(potato.amount).toBeLessThanOrEqual(Math.floor(0.30 * 800 / (284 / 330) / 5) * 5);
    expect(potato.amount).toBeLessThan(330);
    expect(potato.kcal / lunch.totals.kcal).toBeLessThanOrEqual(0.30 + 1e-9);
    expect(notes.length).toBeGreaterThan(0);
  });
  it('главный пункт exempt: рис 315 (52% обеда) не трогаем', () => {
    const meals: any[] = [{
      label: 'Обед', type: 'lunch',
      items: [
        { id: 'rice_white', name: 'Рис', amount: 315, role: 'carb_slow', kcal: 406, p: 8, f: 1, c: 92, fiber: 2 },
        { id: 'chicken_breast', name: 'Курица', amount: 75, role: 'protein', kcal: 83, p: 17, f: 1, c: 0, fiber: 0 },
      ],
      totals: { kcal: 489, p: 25, f: 2, c: 92 },
    }];
    const notes = capSecondaryStapleExcess(meals);
    expect(meals[0].items.find((i: any) => i.id === 'rice_white')!.amount).toBe(315);
    expect(notes.length).toBe(0);
  });
  it('матрица 8 конфигов: вторых гарниров >30% нет (живой максимум 29%)', () => {
    const cfgs: Array<[string, any]> = [];
    for (let d = 0; d < 5; d++) cfgs.push([`N${d}`, normalBase({ dayOffset: d })]);
    for (let d = 0; d < 3; d++) cfgs.push([`HV${d}`, hvBase({ dayOffset: d })]);
    for (const [name, input] of cfgs) {
      const p = buildDayPlan(input);
      for (const m of p.meals as any[]) {
        if (!SECONDARY_TYPES.has(m.type) || (m as any)._insulinWindow) continue;
        const items = ((m.items || []) as any[]).filter((x: any) =>
          (x.role === 'carb_slow' || x.role === 'carb_fast') && !(x as any)._fixedGrams);
        if (items.length < 2) continue;
        const mk = (m.totals?.kcal || 0);
        if (mk <= 0) continue;
        const rank0 = [...items].sort((a, b) => (b.kcal || 0) - (a.kcal || 0))[0];
        for (const it of items) {
          if (it === rank0) continue;
          expect((it.kcal || 0) / mk, `${name} ${m.label}: второй гарнир ${it.id} ${it.amount}г`).toBeLessThanOrEqual(0.30);
        }
      }
    }
  });
});
