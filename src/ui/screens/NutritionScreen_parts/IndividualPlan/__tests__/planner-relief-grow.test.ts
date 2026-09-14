import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { DRY_DENSE_IDS } from '../day-target-corrector';
import { stapleFamilyOf } from '../food-availability';
import { FOOD_DB } from '../../../../../core/nutrition-database';

// Lock-тесты P1-2 «relief-клапан» (план §3, остаток):
// второй сухой носитель — только ростом существующего, не новым пунктом.
// Проверено дампами: и на полных пулах (6 сидов HV), и на узком пуле
// (только рис+овсянка из стейплов, 3 сида) ни один приём не получает два
// сухих носителя из РАЗНЫХ семейств (десертные пары рис+пряник — легитимны
// правилом №3, десертов нет в DRY_DENSE_IDS). Рост вместо дубля держат
// merge-door + grow-фолбэки; relief-клапан лишь открывает гейт при
// структурном недоборе дня. Узкий пул при этом сходится ≥85% — relief
// работает ростом, а не свалкой.
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

const NARROW_KEEP = new Set(['rice_white', 'oats_dry', 'oats', 'chicken_breast', 'egg_whole', 'egg_white', 'cottage_cheese_5', 'whey_protein', 'olive_oil', 'banana', 'apple']);

function dryDoubles(p: any): string[] {
  const out: string[] = [];
  for (const m of p.meals as any[]) {
    const dry = ((m.items || []) as any[]).filter((x: any) =>
      (x.role === 'carb_slow' || x.role === 'carb_fast') &&
      (DRY_DENSE_IDS as ReadonlyArray<string>).includes(x.id));
    const fams = new Set(dry.map((x: any) => stapleFamilyOf(x.id)).filter(Boolean));
    if (fams.size >= 2) {
      out.push(`${m.label}: ${dry.map((x: any) => `${x.id}:${x.amount}`).join(' + ')}`);
    }
  }
  return out;
}

describe('P1-2 relief-клапан (второй сухой — ростом, не пунктом)', () => {
  it('HV-матрица 6 сидов: нет дублей сухих из разных семейств', () => {
    for (let d = 0; d < 6; d++) {
      const p = buildDayPlan(hvBase({ dayOffset: d }));
      expect(dryDoubles(p), `dayOffset=${d}`).toEqual([]);
    }
  });
  it('узкий пул (рис+овсянка): нет дублей + сходимость ≥85% ростом', () => {
    const excl = new Set((FOOD_DB as any[]).map((f: any) => f.id).filter((id: string) => !NARROW_KEEP.has(id)));
    for (let d = 0; d < 3; d++) {
      const p = buildDayPlan(hvBase({ dayOffset: d, excludedIds: excl }));
      expect(dryDoubles(p), `narrow dayOffset=${d}`).toEqual([]);
      expect(p.totals.c / 900, `narrow сходимость d=${d}`).toBeGreaterThanOrEqual(0.85);
    }
  });
});
