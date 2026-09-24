/**
 * planner-extreme-diversity.test.ts — §3G (NUTRITION-EXTREME-SCALE-PRO-PLAN §7, остаток G).
 *
 * Чек-инвариант разнообразия на экстриме (1500У/500Б, 120 кг):
 *  - G1: ≥6 разных У-носителей среди РЕГУЛЯРНЫХ приёмов (мейны+снеки; peri/окна — не «приёмы»);
 *  - G2: окна-подкормления ротируются: внутри цепочки одного болюса носители не повторяются,
 *    за день окна несут ≥3 разных носителя (дозированные болюсные окна — не приёмы, §J);
 *  - G3: белковый продукт — не более 3 регулярных приёмов (окна вне порошковой квоты, §J);
 *  - G4: ≥4 разных источника белка за день;
 *  - без дублей id внутри приёма.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
  mealsCount: 10, isTrainingDay: false, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

const insulin = [
  { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
  { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
  { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
] as any;

const train = { isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true };
const PERI = new Set(['preworkout', 'postworkout', 'intra', 'presleep']);

describe('§3G разнообразие экстрима: носители / окна / белок', () => {
  const cells: Array<[string, MealPlanInput]> = [
    ['rest, без инсулина', base()],
    ['train, без инсулина', base(train)],
    ['rest, 3×40 ЕД', base({ injections: insulin })],
    ['train, 3×40 ЕД', base({ ...train, injections: insulin })],
  ];

  for (const [label, inp] of cells) {
    it(`${label}: ≥6 У-носителей, ротация окон, белок ≤3 приёма на id`, { timeout: 240000 }, () => {
      const p = buildDayPlan(inp);
      const carriers = new Set<string>();
      const proteinMeals = new Map<string, number>();
      const windowIdsPerBolus: string[][] = [];
      const windowCarriersAll = new Set<string>();
      for (const m of p.meals as any[]) {
        const ids = (m.items || []).map((it: any) => it.id);
        expect(new Set(ids).size, `${m.label}: дубли ${ids.join(',')}`).toBe(ids.length);
        if (m._insulinWindow) {
          for (const it of m.items || []) windowCarriersAll.add(it.id);
          const bolus = String(m.label || '').replace(/[^А-ЯA-Z]/g, '');
          const prev = windowIdsPerBolus[windowIdsPerBolus.length - 1];
          if (!prev || prev[0] !== bolus) windowIdsPerBolus.push([bolus, ...(m.items || []).map((it: any) => it.id)]);
          else prev.push(...(m.items || []).map((it: any) => it.id));
          continue;
        }
        if (PERI.has(String(m.type || ''))) continue;
        for (const it of m.items || []) {
          const f = FOOD_DB.find(x => x.id === it.id);
          if (f && ['grain', 'carb'].includes(f.category || '') && (it.role === 'carb_slow' || it.role === 'carb_fast')) carriers.add(it.id);
          if (it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein') proteinMeals.set(it.id, (proteinMeals.get(it.id) || 0) + 1);
        }
      }
      // G1: ≥6 разных У-носителей среди регулярных приёмов.
      expect(carriers.size, `носители: ${[...carriers].join(', ')}`).toBeGreaterThanOrEqual(6);
      // G3: белок ≤3 регулярных приёма на id.
      const over = [...proteinMeals].filter(([, n]) => n > 3);
      expect(over, `белок >3 приёмов: ${over.map(([id, n]) => `${id}×${n}`).join(', ')}`).toEqual([]);
      // G4: ≥4 источника белка за день.
      expect(proteinMeals.size, `источники белка: ${[...proteinMeals.keys()].join(', ')}`).toBeGreaterThanOrEqual(4);
      // G2: окна ротируются — внутри цепочки болюса носители без повторов, за день ≥3 разных.
      const hasWins = (p.meals as any[]).some(m => m._insulinWindow);
      if (hasWins) {
        for (const chain of windowIdsPerBolus) {
          const carrierIds = chain.slice(1).filter(id => !/whey|isolate|casein|dextrose/.test(id));
          const uniq = new Set(carrierIds);
          expect(uniq.size, `цепочка ${chain[0]}: носители ${carrierIds.join(',')}`).toBe(carrierIds.length);
        }
        const distinctCarriers = [...windowCarriersAll].filter(id => !/whey|isolate|casein|dextrose/.test(id));
        expect(distinctCarriers.length, `носители окон: ${distinctCarriers.join(',')}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
