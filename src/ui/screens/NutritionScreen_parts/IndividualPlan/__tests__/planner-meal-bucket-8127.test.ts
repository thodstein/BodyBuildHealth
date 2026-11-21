/**
 * planner-meal-bucket-8127.test.ts — §8.127 «ведро — это один пункт».
 *
 * Замер §8.126 (160 дней, 10 профилей × 3–6 приёмов × тр/отд × авто/руч): «ведро» — это
 * ОДИН пункт 300–850 г (`grain_rice_flakes 846`, `oats_dry + мука 541`, `картофель 390`),
 * а не сумма позиций. Перенос ЦЕЛОЙ позиции отклонялся в 90 % случаев: у такого приёма
 * единственный носитель, уносить его некуда.
 *
 * Решение владельца (вариант А): носитель можно ДРОБИТЬ между двумя приёмами — одна позиция
 * продукта в двух тарелках, обе части ≥ пола роли (это не обрезок). §8.127 делает это
 * последним пасом, с приёмкой «класс приёмов стал ровнее»:
 *   вёдра в классе (мейны с мейнами, перекусы с перекусами) 31/25 → 19/18 (авто) и 36/31 → 16/16 (руч);
 *   пункт сухой крупы не хуже базы (541 г авто / 500 г руч), тарелки > 900 г остаются 0;
 *   цена варианта А: «2+ носителя на тарелке» 22 → 32 (авто) и 34 → 50 (руч) — часть тарелок
 *   получает второй крахмал. Это осознанный размен решения владельца, см. §8.127 в аудите.
 *
 * Замок фиксирует инварианты паса, а не конкретные граммы:
 *  1) день ≤ 3 % по ккал (сходимость не тронута — граммы те же, меняется только тарелка);
 *  2) обрезков нет: каждая часть носителя ≥ пола роли;
 *  3) тарелка ≤ 900 г (дробление не выводит приём за кап профиля);
 *  4) вёдра в классе на этих днях отсутствуют.
 */
import { describe, expect, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G } from '../planner-quality-score';

const PROFILES = [
  { id: 'c1500', w: 110, k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, k: 6700, p: 250, f: 100 },
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
];
const carbsFor = (p: any) => (p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4)));
const build = (p: any, mc: number, tr: boolean, manual: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: Math.round(p.w * 0.82), bodyFatPct: 18, sex: 'male',
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
} as unknown as MealPlanInput) as any;

const solid = (m: any): number => ((m.items || []) as any[])
  .filter((x: any) => String(x.role || '') !== 'liquid')
  .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);

/** вёдра внутри класса: мейны сравниваются с мейнами, перекусы — с перекусами */
const classBuckets = (plan: any): string[] => {
  const out: string[] = [];
  const meals = (plan.meals || []).filter((m: any) => (m.items || []).length > 0);
  for (const [cls, list] of [
    ['main', meals.filter((m: any) => ['breakfast', 'lunch', 'dinner'].includes(String(m.type)))],
    ['snack', meals.filter((m: any) => /^snack/.test(String(m.type)))],
  ] as any[][]) {
    if (list.length < 2) continue;
    const sh = list.reduce((s: number, m: any) => s + (Number(m.totals?.kcal) || 0), 0) / list.length;
    for (const m of list) {
      const mk = Number(m.totals?.kcal) || 0;
      if (mk > sh * 1.35 + 1) out.push(`${cls}:${m.type} ${Math.round(mk)} ккал при доле ${Math.round(sh)}`);
    }
  }
  return out;
};

const carbCrumbs = (plan: any): string[] => {
  const out: string[] = [];
  for (const m of plan.meals || []) {
    for (const it of (m as any).items || []) {
      const r = String(it.role || '');
      if (r !== 'carb_slow' && r !== 'carb_fast') continue;
      if (it._fixedGrams) continue;
      const floor = Number((MIN_MEANINGFUL_G as any)[r] || 0);
      if ((Number(it.amount) || 0) < floor - 1e-9) {
        out.push(`${m.type}: ${it.id} ${(Number(it.amount) || 0).toFixed(0)} г < ${floor} (${r})`);
      }
    }
  }
  return out;
};

describe('§8.127 — дробление носителя между приёмами: день не хуже, обрезков нет', () => {
  const cases: Array<[string, any, number, boolean, boolean]> = [
    ['c1500/6/отд/руч', PROFILES[0], 6, false, true],
    ['hugeCarb/5/тр/авт', PROFILES[1], 5, true, false],
    ['hugeCarb/5/тр/руч', PROFILES[1], 5, true, true],
    ['p500/4/тр/авт', PROFILES[2], 4, true, false],
    ['p500/4/тр/руч', PROFILES[2], 4, true, true],
    ['small60/3/тр/авт', PROFILES[3], 3, true, false],
    ['small60/3/тр/руч', PROFILES[3], 3, true, true],
  ];
  for (const [key, p, mc, tr, manual] of cases) {
    it(key, () => {
      const plan = build(p, mc, tr, manual);
      expect(Number(plan.deviationPct), `${key}: отклонение дня`).toBeLessThanOrEqual(3.001);
      const crumbs = carbCrumbs(plan);
      expect(crumbs, `${key}: обрезков нет — обе части выше пола роли`).toEqual([]);
      for (const m of plan.meals || []) {
        expect(solid(m), `${key}: тарелка ${m.type} за капом 900 г`).toBeLessThanOrEqual(900);
      }
      const buckets = classBuckets(plan);
      expect(buckets, `${key}: вёдра в классе приёмов`).toEqual([]);
    });
  }

  // Известное ограничение (не улучшено, поэтому не замыкается): на `c1500/3` авто-контура
  // тарелка завтрака уже >700 г до паса — переносить некуда, пункт 541 г остаётся. Замок
  // фиксирует только то, что пас гарантирует: дни выше без вёдер в классе, без обрезков.
});
