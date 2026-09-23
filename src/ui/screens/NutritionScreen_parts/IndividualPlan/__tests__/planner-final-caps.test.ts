/**
 * planner-final-caps.test.ts — §3D EXTREME-SCALE: финальный инвариант порций/тарелки.
 * Поздние проходы (P5b/P7/P4/P6, корректор, доборы) больше не оставляют джем 215 г
 * при капе 35, рис 522 при EDIBILITY 450 и тарелки >900 г: излишек ПЕРЕНОСИТСЯ в приём
 * с комнатой (сумма дня сохраняется), срез — только если день реально перебран.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

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

const solidOf = (m: any): number => (m.items || []).filter((i: any) => i.role !== 'liquid').reduce((s: number, i: any) => s + (i.amount || 0), 0);

describe('§3D финальные капы на экстриме', () => {
  it('1500У+инсулин: нет позиций выше капов, тарелки ≤900, день сходится', () => {
    const plan = buildDayPlan(base({
      weightKg: 120, lbmKg: 100, goalKcal: 8600, goalProteinG: 280, goalFatG: 120, goalCarbsG: 1500,
      injections: [
        { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
        { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
      ] as any,
    }));
    for (const m of plan.meals) {
      expect(solidOf(m), `${m.label} ${solidOf(m)} г`).toBeLessThanOrEqual(900);
      for (const it of (m.items || []) as any[]) {
        if ((m as any)._insulinWindow) continue; // окна дозированы по уколу
        if (it.id === 'jam') expect(it.amount || 0, `${m.label}/jam`).toBeLessThanOrEqual(35);
        if (/^rice_|^rice_basmati|cream_of_rice/.test(it.id)) expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(600);
        if (it.role === 'fruit') expect(it.amount || 0, `${m.label}/${it.id}`).toBeLessThanOrEqual(150);
      }
    }
    expect(Math.abs(plan.totals.c - 1500) / 1500).toBeLessThanOrEqual(0.06);
  });

  it('обычный день: §3D не активен (профиль выключен, заметки нет)', () => {
    const plan = buildDayPlan(base({ weightKg: 90, lbmKg: 75, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340, mealsCount: 5, budget: 'medium' as const }));
    expect(plan.notes.some(n => (n || '').includes('Финальные капы §3D'))).toBe(false);
  });
});
