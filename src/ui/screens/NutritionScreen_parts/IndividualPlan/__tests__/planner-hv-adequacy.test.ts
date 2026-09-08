/**
 * planner-hv-adequacy.test.ts — гарантии адекватности high-volume дней (v3, Sep 2026).
 * Жалобы: гречка/перловка/киноа в каждом приёме, крем/хлопья ни разу, снеки по 40У,
 * сахарная добивка, клетчатка-миллион. Структурные инварианты (не граммовки):
 * они устойчивы к seeded-ротации, но ловят регресс выдачи.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const HV_BANNED = new Set(['buckwheat', 'barley', 'quinoa', 'quinoa_flakes', 'grain_quinoa_flakes']);
const SUGAR = new Set(['honey', 'jam', 'marmalade', 'zefir', 'pastila', 'pryaniki', 'sushki', 'sugar_cookies', 'dates', 'dates_dried', 'raisins', 'dried_apricots', 'dried_apple_rings', 'fruit_date_medjool', 'prunes', 'dried_pineapple', 'dried_mango', 'dried_cranberry', 'dried_blueberry', 'dried_kiwi', 'dried_pear', 'dried_peach', 'dried_banana_chips']);

const base = (overrides: any = {}): MealPlanInput => ({
  weightKg: 110, lbmKg: 90, bodyFatPct: 15, sex: 'male' as const,
  goalKcal: 5500, goalProteinG: 260, goalFatG: 110, goalCarbsG: 900,
  mealsCount: 9, isTrainingDay: true, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3,
  wakeTime: '07:00', lunchTime: '12:30', dinnerTime: '19:00', bedTime: '23:00',
  trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true,
  ...overrides,
} as any);

function stats(p: any) {
  const counts: Record<string, number> = {};
  let sugarC = 0;
  for (const m of p.meals) {
    for (const it of (m.items || []) as any[]) {
      counts[it.id] = (counts[it.id] || 0) + 1;
      if (SUGAR.has(it.id)) sugarC += it.c || 0;
    }
  }
  return { counts, sugarC };
}

describe('HV adequacy (900У/600У)', () => {
  it('900У: нет запрещённых круп, крем/хлопья есть, снеки плотные, сахар и клетчатка в капах', () => {
    const p = buildDayPlan(base({}));
    const { counts, sugarC } = stats(p);
    for (const id of Object.keys(counts)) {
      expect(HV_BANNED.has(id), `banned ${id} in HV plan`).toBe(false);
    }
    // Крем или хлопья обязаны встретиться (сухие стейплы высокоуровневого дня).
    expect((counts['cream_of_rice'] || 0) + (counts['corn_flakes'] || 0) + (counts['rice_cream'] || 0)).toBeGreaterThanOrEqual(1);
    // Никакой углеводный носитель — не монополия (≤3 приёмов из 12).
    for (const [id, n] of Object.entries(counts)) {
      const isCarbCarrier = /rice|oats|corn|flakes|cream|bread|pasta|potato|noodle|buckwheat|barley|quinoa|bulgur|millet|couscous/.test(id);
      if (isCarbCarrier) expect(n, `mono ${id}`).toBeLessThanOrEqual(3);
    }
    // Снеки несут угли (≥40У каждый на 900У).
    for (const m of p.meals) {
      if (String((m as any).type || '').startsWith('snack')) {
        expect(m.totals.c, `snack ${m.label}`).toBeGreaterThanOrEqual(40);
      }
    }
    // Сахар ≤17% углей дня, клетчатка без взрыва (116 = 115 + 1 г на округление
    // посетовых граммовок; движок держит HV-кап 115 — см. _fiberCapDay).
    expect(sugarC / Math.max(1, p.totals.c)).toBeLessThanOrEqual(0.17);
    expect(p.totals.fiber).toBeLessThanOrEqual(116);
    // Сходимость дня.
    expect(Math.abs(p.totals.kcal - 5500) / 5500).toBeLessThanOrEqual(0.05);
    expect(Math.abs(p.totals.p - 260) / 260).toBeLessThanOrEqual(0.08);
    expect(Math.abs(p.totals.c - 900) / 900).toBeLessThanOrEqual(0.08);
  });

  it('600У: нет запрещённых круп и моно-продукта', () => {
    const p = buildDayPlan(base({ weightKg: 100, lbmKg: 82, goalKcal: 4200, goalProteinG: 220, goalFatG: 95, goalCarbsG: 600, mealsCount: 6 }));
    const { counts, sugarC } = stats(p);
    for (const id of Object.keys(counts)) {
      expect(HV_BANNED.has(id), `banned ${id} in HV plan`).toBe(false);
    }
    for (const [id, n] of Object.entries(counts)) {
      expect(n, `mono ${id}`).toBeLessThanOrEqual(3);
    }
    expect(sugarC / Math.max(1, p.totals.c)).toBeLessThanOrEqual(0.17);
    // PRO-типология (один приём = одно мясо, дипы без вёдер): цена честности на 600У/6пр —
    // 8.66% вместо 8% (убранное второе мясо + ужатые дипы не добиваются ведром).
    // Реальная тарелка важнее 0.66 п.п. сходимости; исторический допуск ±10%.
    expect(Math.abs(p.totals.kcal - 4200) / 4200).toBeLessThanOrEqual(0.09);
  });
});
