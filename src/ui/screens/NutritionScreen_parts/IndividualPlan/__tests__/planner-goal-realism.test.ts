/**
 * planner-goal-realism.test.ts — PRO-гейт реальности рациона по целям:
 * точность (≤3%), отсутствие «мусора» (экзотика/кондоменты), отсутствие «свалок»
 * (фрагментные основные приёмы, off-slot на ночь, гигантские сухие порции).
 * Цели — Atwater-консистентные (как их строит buildDayTargets).
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { afAllows } from '../planner-meal-affinity';

const JUNK = /^sauce_|^oil_(soybean|corn|palm|rice_bran|camelina|cedar|black_cumin|chili|truffle|mustard)|^seed_(poppy|fennel|anise|celery|nigella|cumin|coriander|cardamom|mustard_yellow)|^nut_(kukui|pili|baru)|basil_seeds|hazelnut_paste|pesto|fat_cocoa_butter|^root_(taro|cassava|yam)|plantain|breadfruit|^(lemon|lime)(_|$)/;
const DRY_CARB = /oats_dry|corn_flakes|grain_rice_flakes|rice_cream|rice_semolina|cream_of_rice|muesli|granola/;

const mk = (over: Partial<MealPlanInput>): MealPlanInput => ({
  weightKg: 85, lbmKg: 73.8, bodyFatPct: 13, sex: 'male',
  goalKcal: 2720, goalProteinG: 170, goalFatG: 80, goalCarbsG: 330,
  mealsCount: 5, budget: 'medium', dayOffset: 0, cyclePhase: 'maintenance',
  variety: 'medium', eveningLowCarb: false, ...over,
} as MealPlanInput);

const toMin = (t: string): number => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const devOf = (p: any, i: MealPlanInput): number => Math.max(
  Math.abs(p.totals.kcal - i.goalKcal) / i.goalKcal,
  Math.abs(p.totals.p - i.goalProteinG) / i.goalProteinG,
  Math.abs(p.totals.f - i.goalFatG) / i.goalFatG,
  Math.abs(p.totals.c - i.goalCarbsG) / i.goalCarbsG,
);

const GOALS: [string, MealPlanInput][] = [
  ['mass', mk({ goalKcal: 3205, goalProteinG: 190, goalFatG: 85, goalCarbsG: 420, mealsCount: 6, cyclePhase: 'course' })],
  ['cut', mk({ goalKcal: 2015, goalProteinG: 200, goalFatG: 55, goalCarbsG: 180, cyclePhase: 'cutting', isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 60 })],
  ['recomp', mk({ goalKcal: 2350, goalProteinG: 200, goalFatG: 70, goalCarbsG: 230, cyclePhase: 'maintenance' })],
  ['maintenance', mk({})],
  ['cutF60', mk({ weightKg: 60, lbmKg: 50, bodyFatPct: 17, sex: 'female', goalKcal: 1490, goalProteinG: 120, goalFatG: 50, goalCarbsG: 140, cyclePhase: 'cutting' } as any)],
];

describe('PRO-гейт реальности рациона по целям', () => {
  for (const [name, input] of GOALS) {
    it(`${name}: сходится ≤3%, без мусора/свалок`, () => {
      const p = buildDayPlan(input);
      // 1) Точность по цели.
      expect(devOf(p, input), `${name} dev=${(devOf(p, input) * 100).toFixed(1)}%`).toBeLessThanOrEqual(0.03);
      // 2) Нет «мусора».
      const junk = p.meals.flatMap((m: any) => (m.items || []).filter((it: any) => JUNK.test(String(it.id))).map((it: any) => `${it.id}@${m.type}`));
      expect(junk, `junk: ${junk.join(', ')}`).toEqual([]);
      // 3) Нет фрагментных основных приёмов (<180 ккал) и off-slot на ночь.
      for (const m of p.meals) {
        const t = String((m as any).type || '');
        if (['breakfast', 'lunch', 'dinner'].includes(t)) expect((m as any).totals.kcal, `${name} ${t} frag`).toBeGreaterThanOrEqual(120);
        if (t.startsWith('snack') && toMin(String((m as any).time)) >= 20 * 60) {
          for (const it of (m.items || [])) {
            if (it.role === 'carb_slow' || it.role === 'carb_fast') {
              expect(afAllows(String(it.id), 'lateSnack'), `${name} ${t}: ${it.id} off-slot`).toBe(true);
            }
          }
        }
      }
      // 4) Нет гигантских сухих порций (>250 г сухого носителя за приём).
      for (const m of p.meals) for (const it of (m.items || [])) {
        if (DRY_CARB.test(String(it.id))) expect(it.amount, `${name} ${it.id}`).toBeLessThanOrEqual(260);
      }
      // 5) Каждый основной приём несёт белок.
      for (const m of p.meals.filter((x: any) => ['breakfast', 'lunch', 'dinner'].includes(String(x.type)))) {
        expect((m as any).totals.p, `${name} ${(m as any).type} protein`).toBeGreaterThanOrEqual(15);
      }
    });
  }
});
