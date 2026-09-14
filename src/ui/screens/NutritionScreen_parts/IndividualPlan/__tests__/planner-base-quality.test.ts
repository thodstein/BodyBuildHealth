import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

const baseInput = (overrides: any = {}) => ({
  weightKg: 90, lbmKg: 73.8, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 1050, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'medium' as const, eveningLowCarb: false,
  ...overrides,
});

const carbItems = (m: any) => (m.items || []).filter((i: any) => i.role === 'carb_slow' || i.role === 'carb_fast');

describe('base quality lock (жалоба «2-3 каши в приёме») ', () => {
  it('пост-трен: 1 напиток + не более 1 пищевого гарнира', () => {
    for (let d = 0; d < 10; d++) {
      const p = buildDayPlan(baseInput({ dayOffset: d }));
      const post = p.meals.find((m: any) => m.type === 'postworkout');
      expect(post).toBeTruthy();
      expect(carbItems(post).length).toBeLessThanOrEqual(1);
    }
  });
  it('обед/ужин/завтрак: не более 1 гарнира (refeed-исключение только обед)', () => {
    for (let d = 0; d < 10; d++) {
      const p = buildDayPlan(baseInput({ dayOffset: d }));
      for (const m of p.meals as any[]) {
        if (['lunch', 'dinner', 'breakfast'].includes(m.type)) {
          expect(carbItems(m).length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('цитрус в капах (лимон/лайм ≤30 г, грейпфрут ≤80 г), бобовые ≤250 г', () => {
    for (let d = 0; d < 10; d++) {
      const p = buildDayPlan(baseInput({ dayOffset: d }));
      for (const m of p.meals as any[]) {
        for (const it of m.items as any[]) {
          if (/lemon|lime/.test(it.id) && it.role === 'fruit') expect(it.amount).toBeLessThanOrEqual(30);
          if (/grapefruit|orange/.test(it.id) && it.role === 'fruit') expect(it.amount).toBeLessThanOrEqual(80);
          if (/lentil|bean|pea|chickpea|legume/.test(it.id) && (it.role === 'carb_slow' || it.role === 'carb_fast')) expect(it.amount).toBeLessThanOrEqual(250);
        }
      }
    }
  });
  it('экзотика (кенгуру) не попадает в автоплан', () => {
    for (let d = 0; d < 10; d++) {
      const p = buildDayPlan(baseInput({ dayOffset: d }));
      const ids = p.meals.flatMap((m: any) => m.items.map((i: any) => i.id));
      expect(ids.some((id: string) => /kangaroo/i.test(id) || /^exotic_/i.test(id))).toBe(false);
    }
  });
});
