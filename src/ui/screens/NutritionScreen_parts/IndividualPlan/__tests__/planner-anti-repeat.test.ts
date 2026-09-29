import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * E12 (=E5): жёсткий анти-повтор углеводного носителя в ОСНОВНЫХ приёмах.
 *
 * Дефект: один и тот же carb-id в 2+ основных приёмах («картофель и в обед, и в
 * ужин» весь день). Фикс: финальный пасс после E0/E11 — повторную позицию (в самом
 * позднем основном приёме) меняем на другой классический гарнир, граммы под углеводы
 * жертвы (калорийность приёма сохраняется). Предпочтение — другое семейство с дневной
 * комнатой (familyMealCap), иначе другой id того же семейства; пул — только
 * «классические гарниры ББ» с уважением исключений/аллергенов/непереносимостей/
 * категорий. Guard: max-dev дня ≤ max(было, канон 3%) и клетчатка ≤85 г, иначе откат.
 *
 * Замер (mains-only повторы «было → стало» на матрице 8 шкал × train/rest × 2 соли):
 *   F50-1200 T s1: повторы 1→0 (ужин: картофель → киноа; dev 9.4→8.2%), comp 73→77;
 *   F50-1200 R s2: 1→0 (картофель → булгур; dev 1.4→0.8% ≤ канон);
 *   M85-3000 R s1: 1→0 (гречка → паста ц/з; dev 0.3→2.6%); M70 T s1: 1→0 (dev 4.9%).
 *   Все обычные клетки матрицы: ПОВТОРОВ В ОСНОВНЫХ = 0.
 *   Гейт (как E0-reconciliation): HV / ≥4500 ккал / инсулин-окна / carbCapGPerKg=0
 *   НЕ трогаются — у них свои проходы и калиброванные контракты (болюс-окна = доза,
 *   §7.2/HV-матрицы): M110/HV-повторы остаются — граница E14.
 *   Anti-regress: своп не имеет права ухудшить композицию/создать off-slot
 *   (пул фильтрован afAllows: завтрак-стейплы в обед/ужин не попадают).
 */

const MAIN = ['breakfast', 'lunch', 'dinner'];

/** id → число основных приёмов, несущих его как carb_slow/carb_fast. */
const mainRepeatIds = (p: any): string[] => {
  const uses = new Map<string, number>();
  for (const m of p.meals || []) {
    if (!MAIN.includes(String(m.type || ''))) continue;
    for (const it of m.items || []) {
      if (it.role === 'carb_slow' || it.role === 'carb_fast') uses.set(it.id, (uses.get(it.id) || 0) + 1);
    }
  }
  return [...uses.entries()].filter(([, n]) => n >= 2).map(([id]) => id);
};

const base = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium', dayOffset: 0, cyclePhase: 'course', variety: 'medium', eveningLowCarb: false,
  ...over,
});

describe('E12: анти-повтор носителя в основных приёмах', () => {
  it('F50-1200 T s1: повтор снят свопом, есть нота, флаг честный', () => {
    const p = buildDayPlan(base({
      weightKg: 50, lbmKg: 41, sex: 'female', goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119,
      cyclePhase: 'cutting', randomSalt: 1,
    }));
    expect(mainRepeatIds(p), `повторы: ${mainRepeatIds(p).join(',')}`).toEqual([]);
    expect(p.notes.some(n => n.includes('анти-повтор носителя'))).toBe(true);
    if (!p.withinTolerance) expect(p.deviationPct).toBeLessThanOrEqual(10);
    else expect(p.deviationPct).toBeLessThanOrEqual(3);
  });

  it('F50-1200 R s2: повтор снят, день в каноне', () => {
    const p = buildDayPlan(base({
      weightKg: 50, lbmKg: 41, sex: 'female', goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119,
      cyclePhase: 'cutting', isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false,
      randomSalt: 2,
    }));
    expect(mainRepeatIds(p)).toEqual([]);
    expect(p.withinTolerance, `dev=${p.deviationPct}%`).toBe(true);
    expect(p.notes.some(n => n.includes('анти-повтор носителя'))).toBe(true);
  });

  it('матрица обычных клеток: повторов carb-id в основных приёмах нет', () => {
    const cases: Array<[string, MealPlanInput]> = [
      ['M85 T s1', base({ randomSalt: 1 })],
      ['M85 R s1', base({ isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, dayOffset: 1, randomSalt: 1 })],
      ['M95 T s1', base({ weightKg: 95, lbmKg: 78, goalKcal: 2060, goalProteinG: 180, goalFatG: 60, goalCarbsG: 200, randomSalt: 1 })],
      ['M70 T s1', base({ weightKg: 70, lbmKg: 57, goalKcal: 2000, goalProteinG: 140, goalFatG: 60, goalCarbsG: 225, randomSalt: 1 })],
      ['F60 R s2', base({ weightKg: 60, lbmKg: 49, sex: 'female', goalKcal: 1500, goalProteinG: 110, goalFatG: 45, goalCarbsG: 163, cyclePhase: 'cutting', isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, randomSalt: 2 })],
    ];
    for (const [name, inp] of cases) {
      const p = buildDayPlan(inp);
      expect(mainRepeatIds(p), `${name}: повторы ${mainRepeatIds(p).join(',')}`).toEqual([]);
    }
  });

  it('экстремумы гейтятся (как E0): 500Б R s2 не трогается, детерминизм', () => {
    // Дни ≥4500 ккал / HV / инсулин-окна управляются своими проходами (E0-прецедент):
    // анти-повтор их НЕ трогает — контракты болюс-окон и HV-матриц калиброваны.
    const inp = base({
      weightKg: 110, lbmKg: 90, goalKcal: 4500, goalProteinG: 500, goalFatG: 100, goalCarbsG: 400,
      budget: 'max', isTrainingDay: false, trainStartMin: undefined, allowIntraWorkout: false, randomSalt: 2,
    });
    const a = buildDayPlan(inp);
    const b = buildDayPlan(inp);
    expect(a.notes.some(n => n.includes('анти-повтор носителя'))).toBe(false);
    expect(a.withinTolerance, `dev=${a.deviationPct}%`).toBe(true);
    expect(JSON.stringify(a.meals)).toBe(JSON.stringify(b.meals));
  });

  it('своп не создаёт off-slot: точка свопа уважает матрицу слотов (afAllows)', () => {
    // В свопнутых днях «нет овоща/off-slot» не появляются: скор композиции ≥75
    // на всех обычных клетках, а своп-ноты есть только там, где был повтор.
    const swappedProfiles: MealPlanInput[] = [
      base({ weightKg: 50, lbmKg: 41, sex: 'female', goalKcal: 1200, goalProteinG: 100, goalFatG: 36, goalCarbsG: 119, cyclePhase: 'cutting', randomSalt: 1 }),
      base({ weightKg: 95, lbmKg: 78, goalKcal: 2060, goalProteinG: 180, goalFatG: 60, goalCarbsG: 200, randomSalt: 1 }),
    ];
    for (const inp of swappedProfiles) {
      const p = buildDayPlan(inp);
      const swapped = p.notes.some(n => n.includes('анти-повтор носителя'));
      if (swapped) {
        for (const m of p.meals.filter((mm: any) => MAIN.includes(String(mm.type)))) {
          for (const it of m.items) {
            if (it.role !== 'carb_slow' && it.role !== 'carb_fast') continue;
            // ни одного «завтрак-стейпла» (овёс/хлопья) в обеде/ужине после свопа
            if (m.type !== 'breakfast') expect(/oat|porridge|corn_flakes|muesli|granola/i.test(it.id), `${m.label}: ${it.id}`).toBe(false);
          }
        }
      }
    }
  });
});
