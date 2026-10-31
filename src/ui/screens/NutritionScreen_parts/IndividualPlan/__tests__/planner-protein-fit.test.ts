import { describe, expect, it } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

/**
 * Этап 1+2 сходимости (B40 + B42): «невидимый» белок носителей и число приёмов,
 * которые цель по белку не выдерживает.
 *
 * Найденный механизм (замер 8 профилей × 5 вариантов приёмов × трен/отдых, ручной режим):
 *  • носители (овсянка 13 г Б/100, картофель 6.3 г Б/100, хлеб 5.4 г Б/100) при цели
 *    110–120 г Б на день приносят 30–50 г белка — до 40% дневного перебора;
 *  • при 10 построенных приёмах цель 120 г Б недостижима в принципе: 10 × минимальная
 *    осмысленная порция (≥13 г Б) > 120 г, сколько ни крути полы.
 *
 * Было/стало (макс. отклонение дня):
 *  S2 7пр/трен  белок 35.5% → 8.1%;  M1 7пр/трен  белок 21.9% → 1.1%;
 *  S1 6пр/трен  белок 22.4% → 6.0%;  M2 7пр/трен  белок 23.7% → 3.1%;
 *  M2 7пр/отдых белок  5.9% → 0.7%.
 * Средний |отклонение| по всем 160 конфигурациям: 2.78% → 2.23%.
 */

const goal = (p: number, f: number, c: number) => p * 4 + f * 9 + c * 4;

const manualDay = (o: {
  weightKg: number; lbmKg: number; bodyFatPct: number; sex: 'male' | 'female';
  p: number; f: number; c: number; mealsCount: number; isTrainingDay: boolean; goalName: string;
}) => buildDayPlan({
  weightKg: o.weightKg,
  lbmKg: o.lbmKg,
  bodyFatPct: o.bodyFatPct,
  sex: o.sex,
  goalKcal: goal(o.p, o.f, o.c),
  goalProteinG: o.p,
  goalFatG: o.f,
  goalCarbsG: o.c,
  mealsCount: o.mealsCount,
  isTrainingDay: o.isTrainingDay,
  trainStartMin: 17 * 60 + 30,
  trainDurationMin: 90,
  allowIntraWorkout: true,
  budget: 'medium',
  dayOffset: 0,
  cyclePhase: 'none',
  variety: 'medium',
  eveningLowCarb: false,
  goal: o.goalName,
  // Ручной режим: цели пользователя неприкосновенны, углеродный кап выключен.
  manualTargetsLocked: true,
  carbCapGPerKg: 0,
} as any);

const dayTotals = (plan: any) => {
  const t = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const m of plan.meals || []) {
    const mt = m.totals || {};
    t.kcal += mt.kcal || 0;
    t.p += mt.p || 0;
    t.f += mt.f || 0;
    t.c += mt.c || 0;
  }
  return t;
};

const devPct = (got: number, target: number) => (target > 0 ? Math.abs(got - target) / target * 100 : 0);

const maxDevPct = (plan: any, p: number, f: number, c: number) => Math.max(
  devPct(dayTotals(plan).kcal, goal(p, f, c)),
  devPct(dayTotals(plan).p, p),
  devPct(dayTotals(plan).f, f),
  devPct(dayTotals(plan).c, c),
);

describe('B40: белок, который приносят углеводные носители', () => {
  it('S2 7 приёмов/трен: цель 120 г Б не перелетается на 35% «невидимым» белком гарниров', () => {
    const plan: any = manualDay({
      weightKg: 58, lbmKg: 47, bodyFatPct: 19, sex: 'female',
      p: 120, f: 65, c: 320, mealsCount: 7, isTrainingDay: true, goalName: 'mass',
    });
    const t = dayTotals(plan);
    // Было 35.5% (159.7 г при цели 120). Канон 3% на такой цели с 10 приёмами недостижим,
    // но двузначный перебор «из ниоткуда» — нет.
    expect(devPct(t.p, 120)).toBeLessThan(12);
  });

  it('замена носителя изокалорийная: ккал дня не уезжает вместе с белком носителя', () => {
    const plan: any = manualDay({
      weightKg: 58, lbmKg: 47, bodyFatPct: 19, sex: 'female',
      p: 120, f: 65, c: 320, mealsCount: 7, isTrainingDay: true, goalName: 'mass',
    });
    const t = dayTotals(plan);
    // Было У 3.3% при белке +35%: изоуглеводная замена уносила ккал дня.
    expect(devPct(t.c, 320)).toBeLessThan(5);
    expect(devPct(t.kcal, goal(120, 65, 320))).toBeLessThan(4);
  });
});

describe('B42: число приёмов не должно требовать белка больше цели', () => {
  it('M1 7 приёмов/трен: белок дня у цели (было +21.9%)', () => {
    const plan: any = manualDay({
      weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male',
      p: 180, f: 60, c: 220, mealsCount: 7, isTrainingDay: true, goalName: 'cutting',
    });
    const t = dayTotals(plan);
    expect(devPct(t.p, 180)).toBeLessThan(5);
  });

  it('M2 7 приёмов/отдых: белок дня у цели (было +5.9%, максимум дня 7.3%)', () => {
    const plan: any = manualDay({
      weightKg: 90, lbmKg: 73, bodyFatPct: 19, sex: 'male',
      p: 160, f: 80, c: 350, mealsCount: 7, isTrainingDay: false, goalName: 'maintenance',
    });
    const t = dayTotals(plan);
    expect(devPct(t.p, 160)).toBeLessThan(2.5);
  });

  it('MPS не страдает: белковых приёмов (≥8 г) остаётся минимум 4', () => {
    const plan: any = manualDay({
      weightKg: 58, lbmKg: 47, bodyFatPct: 19, sex: 'female',
      p: 120, f: 65, c: 320, mealsCount: 7, isTrainingDay: true, goalName: 'mass',
    });
    const proteinMeals = (plan.meals || []).filter((m: any) =>
      (m.items || []).some((x: any) => ['protein', 'fast_protein', 'slow_protein'].includes(String(x.role)) && (x.p || 0) >= 8)).length;
    expect(proteinMeals).toBeGreaterThanOrEqual(4);
  });

  it('ни один приём не остаётся пустым после перевода перекуса в углеводный', () => {
    const plan: any = manualDay({
      weightKg: 58, lbmKg: 47, bodyFatPct: 19, sex: 'female',
      p: 120, f: 65, c: 320, mealsCount: 7, isTrainingDay: true, goalName: 'mass',
    });
    for (const m of plan.meals || []) {
      expect((m.items || []).length).toBeGreaterThan(0);
      expect((m.totals?.kcal || 0)).toBeGreaterThan(0);
    }
  });
});

describe('этап 1+2 не ухудшает суммарную сходимость по матрице профилей', () => {
  const CASES = [
    { name: 'S1 7пр/трен', weightKg: 50, lbmKg: 41, bodyFatPct: 18, sex: 'female' as const, p: 110, f: 40, c: 110, mealsCount: 7, isTrainingDay: true, goalName: 'cutting' },
    { name: 'S2 7пр/трен', weightKg: 58, lbmKg: 47, bodyFatPct: 19, sex: 'female' as const, p: 120, f: 65, c: 320, mealsCount: 7, isTrainingDay: true, goalName: 'mass' },
    { name: 'M1 7пр/трен', weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male' as const, p: 180, f: 60, c: 220, mealsCount: 7, isTrainingDay: true, goalName: 'cutting' },
    { name: 'M2 7пр/трен', weightKg: 90, lbmKg: 73, bodyFatPct: 19, sex: 'male' as const, p: 160, f: 80, c: 350, mealsCount: 7, isTrainingDay: true, goalName: 'maintenance' },
    { name: 'M2 7пр/отдых', weightKg: 90, lbmKg: 73, bodyFatPct: 19, sex: 'male' as const, p: 160, f: 80, c: 350, mealsCount: 7, isTrainingDay: false, goalName: 'maintenance' },
    { name: 'L1 5пр/отдых', weightKg: 110, lbmKg: 88, bodyFatPct: 20, sex: 'male' as const, p: 220, f: 110, c: 560, mealsCount: 5, isTrainingDay: false, goalName: 'mass' },
  ];

  it('средний модуль отклонения по 6 профилям ≤ 5% (было 9.18%)', () => {
    let sum = 0;
    let n = 0;
    for (const cs of CASES) {
      const plan: any = manualDay(cs as any);
      const t = dayTotals(plan);
      // Считаем по осям (так же, как в измерительном стенде).
      sum += devPct(t.kcal, goal(cs.p, cs.f, cs.c));
      sum += devPct(t.p, cs.p);
      sum += devPct(t.f, cs.f);
      sum += devPct(t.c, cs.c);
      n += 4;
    }
    expect(sum / n).toBeLessThan(5);
  });

  it('средний перебор/недобор белка по 6 профилям < 8% (было 20.4%)', () => {
    let sum = 0;
    for (const cs of CASES) {
      const plan: any = manualDay(cs as any);
      const t = dayTotals(plan);
      sum += devPct(t.p, cs.p);
    }
    expect(sum / CASES.length).toBeLessThan(8);
  });
});
