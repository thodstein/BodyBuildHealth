/**
 * planner-no-insulin-extreme.test.ts — §3A-2 (NUTRITION-EXTREME-SCALE-PRO-PLAN §7, остаток A).
 *
 * Проблема: rest-день 1500У/500Б БЕЗ инсулина сходился на 90.7% (1361/1500): 10 приёмов
 * × капы не держали 12.5 г/кг, обед/ужин упирались в «пряники 275 г» (которые финальный
 * §3D срезал до 50) и низкоплотные носители (картофель 390 = 66 У при цели 276).
 *
 * Фикс (все ветки только на экстрим-профиле, обычные дни байт-в-бит):
 *  - добор §7.2-7c чтит профиль ёмкости (тарелка 900 / позиция 800) и СОБСТВЕННЫЙ кап
 *    носителя (comfort/EDIBILITY/сухая крупа 240) — не заливает то, что потом режется;
 *  - если растущих носителей нет, а комната тарелки есть — в мейн добавляется ВТОРОЙ
 *    плотный стейпл (рис/крем/хлопья);
 *  - §3D и P5b используют тот же кап сухой крупы, что билдер (`maxDryGrainPerMeal`).
 *
 * Матрица приёмки: train/rest × инсулин/без инсулина.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

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
const solidOf = (m: any): number => (m.items || []).filter((i: any) => i.role !== 'liquid').reduce((s: number, i: any) => s + (i.amount || 0), 0);

describe('§3A-2 no-insulin экстрим: матрица train/rest × инсулин/без', () => {
  const cells: Array<[string, MealPlanInput]> = [
    ['rest, без инсулина', base()],
    ['train, без инсулина', base(train)],
    ['rest, 3×40 ЕД', base({ injections: insulin })],
    ['train, 3×40 ЕД', base({ ...train, injections: insulin })],
  ];

  for (const [label, inp] of cells) {
    it(`${label}: У ≥97% цели, тарелки ≤900, капы носителей целы`, { timeout: 240000 }, () => {
      const p = buildDayPlan(inp);
      const devC = Math.abs(p.totals.c - 1500) / 1500;
      // Честная нота обязательна при недоходе (не молчаливый недобор) — фикс должен давать ≥97%.
      if (devC > 0.03) {
        expect(
          p.notes.some(n => /Не сошлось|добавьте приём|вместимости приёмов/i.test(n || '')),
          `нет честной ноты при недоборе ${(devC * 100).toFixed(1)}%: ${p.notes.filter(n => /сошл|приём|У /i.test(n)).join(' | ')}`,
        ).toBe(true);
      }
      expect(devC, `У ${p.totals.c}/1500 (${(devC * 100).toFixed(1)}%)`).toBeLessThanOrEqual(0.03);
      for (const m of p.meals) {
        expect(solidOf(m), `${m.label} ${solidOf(m)} г`).toBeLessThanOrEqual(900);
        const ids = (m.items || []).map((i: any) => i.id);
        expect(new Set(ids).size, `${m.label}: дубли ${ids.join(',')}`).toBe(ids.length);
        for (const it of (m.items || []) as any[]) {
          if ((m as any)._insulinWindow) continue;
          if (/^rice_|^rice_basmati|cream_of_rice/.test(it.id)) expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(600);
          if (it.role === 'fruit') expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(150);
          if (it.id === 'jam') expect(it.amount || 0, `${m.label}/jam`).toBeLessThanOrEqual(35);
        }
      }
    });
  }

  it('обычный день (3000 ккал, контроль 2692/174/74/332) — не тронут', () => {
    // §3A-2: все новые ветки за экстрим-профилем; обычный день — байт-в-байт
    // (контроль §0 плана: 90 кг, 3000 ккал, 180/80/340, 5 приёмов, medium, тренировка).
    const p = buildDayPlan(base({
      weightKg: 90, lbmKg: 75, bodyFatPct: 14, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340,
      mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true,
      budget: 'medium' as const, dayOffset: 0,
    }));
    expect(p.totals.kcal).toBe(2692);
    expect(p.totals.p).toBe(173.5);
    expect(p.totals.f).toBe(74.4);
    expect(p.totals.c).toBe(332.1);
  });
});
