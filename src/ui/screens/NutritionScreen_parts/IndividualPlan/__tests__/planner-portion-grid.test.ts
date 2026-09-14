import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

// Lock-тесты P2-2 «дискретный ряд порций» (план §3, остаток) — verify-close.
// Попытка финального округления крахмалов к кратным 5 доказала
// несовместимость с калибровкой в ОБЕ стороны: вниз рвало MPS-пол
// (Ужин 16 г → 0.2195, dietology-guarantees), вверх — белковый кап
// (253 > 253.0, meal-target-scale). Код округления откачен; держим
// доказанный инвариант: все граммовки — целые (дробных в матрице ноль).
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

function fractional(p: any): string[] {
  const out: string[] = [];
  for (const m of p.meals as any[]) {
    for (const it of (m.items || []) as any[]) {
      const a = it.amount || 0;
      if (Math.abs(a - Math.round(a)) > 1e-9) out.push(`${m.label}: ${it.id}:${a}`);
    }
  }
  return out;
}

describe('P2-2 verify (граммовки целые; сетка откачена)', () => {
  it('матрица 8 конфигов: дробных порций нет', () => {
    for (let d = 0; d < 5; d++) {
      expect(fractional(buildDayPlan(normalBase({ dayOffset: d }))), `N${d}`).toEqual([]);
    }
    for (let d = 0; d < 3; d++) {
      expect(fractional(buildDayPlan(hvBase({ dayOffset: d }))), `HV${d}`).toEqual([]);
    }
  });
});
