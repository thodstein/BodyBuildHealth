import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';
import { computeDieteticCarbTarget, computePlannerTargets } from '../planner-targets';

// Lock-тесты P3 «Пустые полдники» (план §3, остаток):
// 1) снек с углеводной целью не стоит пустым: ≥60% цели по углям,
//    иначе в нотах честное «не сошлось» (критерий §5);
// 2) долив исполняется едой (стейпл, не сахар) там, где есть комнаты;
// 3) A/B-guard: глобальный кап джема откачен (рвал сходимость) —
//    вкус держится стейпл-приоритетом пасса + сахарными капами дня.
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

const isSnackMeal = (m: any) =>
  (m.type === 'snack' || m.type === 'snack2' || m.type === 'snack3' ||
    m.type === 'snack4' || m.type === 'snack5' || m.type === 'snack6') &&
  !(m as any)._insulinWindow;

describe('P3 snack minimum (снек ≥60% У-цели)', () => {
  it('обычный день: все снеки ≥60% углеводной цели', () => {
    for (let d = 0; d < 5; d++) {
      const p = buildDayPlan(normalBase({ dayOffset: d }));
      const notes = ((p as any).notes || []).join('\n');
      for (const m of p.meals as any[]) {
        if (!isSnackMeal(m) || !m.target || (m.target.c || 0) <= 5) continue;
        const floor = 0.6 * (m.target.c || 0);
        const ok = (m.totals.c || 0) >= floor - 0.51;
        expect(ok || /не сошлось/i.test(notes), `${m.label}: ${(m.totals.c || 0).toFixed(1)}У из цели ${m.target.c}У (<60%) без ноты`).toBe(true);
      }
    }
  });
  it('HV-день: все снеки ≥60% углеводной цели (кейс Перекус 5: 39.6/76)', () => {
    for (let d = 0; d < 3; d++) {
      const p = buildDayPlan(hvBase({ dayOffset: d }));
      const notes = ((p as any).notes || []).join('\n');
      for (const m of p.meals as any[]) {
        if (!isSnackMeal(m) || !m.target || (m.target.c || 0) <= 5) continue;
        const floor = 0.6 * (m.target.c || 0);
        const ok = (m.totals.c || 0) >= floor - 0.51;
        expect(ok || /не сошлось/i.test(notes), `${m.label}: ${(m.totals.c || 0).toFixed(1)}У из цели ${m.target.c}У (<60%) без ноты`).toBe(true);
      }
    }
  });
  it('долив исполняется едой, а не нотой (fill-ветка: рост/стейпл с капами)', () => {
    // Конфиг с белковой комнатой и голодающими снеками: пасс обязан ДОЛИТЬ
    // (нота «долит», снеки ≥60%), а не отделаться «не сошлось».
    const p = buildDayPlan(normalBase({
      weightKg: 100, lbmKg: 82, goalKcal: 4200, goalProteinG: 300,
      goalFatG: 95, goalCarbsG: 550, mealsCount: 6, dayOffset: 4,
    }));
    const notes = ((p as any).notes || []).join('\n');
    expect(/долит/i.test(notes)).toBe(true);
    for (const m of p.meals as any[]) {
      if (!isSnackMeal(m) || !m.target || (m.target.c || 0) <= 5) continue;
      expect((m.totals.c || 0), `${m.label}: ниже 60% без долива`).toBeGreaterThanOrEqual(0.6 * (m.target.c || 0) - 0.51);
    }
  });
  it('A/B-guard: w120/train сходится по углям (кап джема 20 давал dC 0.21 — откачен)', () => {
    // Мутационный guard эпизода: глобальный кап джема 35→20 рвал сходимость
    // каскадом (dC 0.13→0.21 на этом комбо dietology-матрицы). Кап откачен, вкус
    // держится стейпл-приоритетом снек-пасса + сахарными капами. Этот тест падает,
    // если кто-то снова ужмёт карту. База — 1-в-1 как в dietology-матрице.
    const raw = computePlannerTargets({
      weightKg: 120, heightCm: 185, age: 30, sex: 'male' as const, goal: 'mass', phase: 'course',
      bodyFatPct: 20, workoutsPerWeek: 5, avgWorkoutMinutes: 75, dailySteps: 8000,
      householdActivity: 'moderate', trainType: 'mixed', trainIntensity: 'high', surplusPct: 10,
      injections: [], weightAdaptMode: false, weightLogWeek: [], expectedLossKgWeek: 0,
      metabolicAdaptEnabled: false, metabolicAdaptPct: 0,
      manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
    });
    const effP = Math.round(raw.protein * 1.15);
    const effF = Math.max(Math.round(120 * 0.8), Math.round(raw.fats * 1.15));
    const effC = computeDieteticCarbTarget({ weightKg: 120, rawCarbsG: raw.carbs, insulinTotalUnits: 0 });
    const effK = Math.round(effP * 4 + effF * 9 + effC * 4);
    const p = buildDayPlan({
      weightKg: 120, lbmKg: Math.round(120 * 0.83), bodyFatPct: 18, sex: 'male' as const,
      goalKcal: effK, goalProteinG: effP, goalFatG: effF, goalCarbsG: effC,
      mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 75,
      allowIntraWorkout: true, budget: 'medium' as const, dayOffset: 0,
      cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
      quality: 'full' as const, randomSalt: 3,
      wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
    } as any);
    expect(Math.abs(p.totals.c - effC) / effC).toBeLessThanOrEqual(0.20);
  });
});
