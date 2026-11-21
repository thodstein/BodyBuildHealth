import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G } from '../planner-quality-score';
import { isHerbSpiceId, isProteinPowderId, isPureSupplementId, isSauceCondimentFood } from '../food-availability';
import { FOOD_DB } from '../../../../../core/nutrition-database';

/**
 * §8.128 «не еда»: крахмальная тарелка без белка — гарнир, а не приём (замок).
 *
 * Метрика (по замеру, не по документации): в приёме есть крахмал ≥ 100 г, а белка в приёме
 * < 20 г — это не приём, а гарнир. Такой «перекус» пользователь читает как ошибку плана.
 *
 * Замер сетки 160 дней (10 профилей × 3–6 приёмов × трен/отдых × авто/ручной) до правки:
 * «не еда» = **42 авто / 40 руч**, из них 99 % — ПЕРЕКУСЫ (`potato_boiled 475 г` при 11 г
 * белка, `corn_flakes 165 г` при 12 г); 1–2 пункта были в мейнах; все — на экстремальных
 * углеводных днях (`c1500` 1500 У, `hugeCarb` 1200 У), где день просит 9–12 приёмов.
 *
 * Причина — распределение, а не калории: 12 приёмов и 300 г белка (ровно 25 г на приём),
 * но перекусы-носители получили 10–14 г, а обед/ужин — 36–45 г.
 *
 * Правило §8.128: перекус получает белок у приёма, где он в избытке (пункт выше пола роли,
 * приём остаётся ≥ 25 г — MPS), а равную по ккал часть своего носителя отдаёт в приём
 * с комнатой в тарелке. Суммы дня сохраняются точно (обмен, не добор), поэтому ≤ 3 % не
 * затрагивается по построению.
 *
 * Замер после правки (та же сетка): «не еда» 42 → **25** (авто) и 40 → **20** (руч), в мейнах
 * 0; обрезков 0; ≤ 3 % 0/0/0/0; тарелки > 700 г 48 → **44** (авто) и 27 → 27 (руч);
 * вёдра в классе **не выросли** (19/18 и 16/16); цена — «2+ носителя на тарелке» 32 → 39 (авто)
 * и 50 → 54 (руч): срез крахмала уезжает в приём, где носитель уже есть.
 *
 * Остаток (25/20) — физика тех же экстремальных дней: 12 приёмов × 25 г белка (MPS) при
 * поле пункта 40 г для мяса/рыбы и 20 г для творога/порошка не дают донора — передать
 * «чуть-чуть» белка нельзя, не оставив на тарелке обрезок. Это записано как долг, не как успех.
 */

const PROFILES = [
  { id: 'p500', w: 110, k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, k: 2400, p: 180, f: 150 },
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
} as unknown as MealPlanInput);

const CRUMB_PLANT_G = 40;
const crumbFloor = (it: any): number => {
  const role = String(it?.role || '');
  if (!role || role === 'supplement' || role === 'liquid' || role === 'other') return 0;
  if (it && it._fixedGrams) return 0;
  const id = String(it?.id || '');
  const fd: any = FOOD_DB.find((f: any) => String(f.id) === id);
  if (!fd) return 0;
  if (isSauceCondimentFood(fd) || isHerbSpiceId(id)) return 0;
  if (isPureSupplementId(id, fd.category)) return 0;
  if (isProteinPowderId(id)) return 20;
  if (role === 'veg' || role === 'fruit') return CRUMB_PLANT_G;
  return Number((MIN_MEANINGFUL_G as any)[role] || 0);
};

const pOf = (m: any): number => (m.items || []).reduce((s: number, x: any) => s + (Number(x.p) || 0), 0);
const solid = (m: any): number => (m.items || [])
  .filter((x: any) => String(x.role || '') !== 'liquid')
  .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
const items = (plan: any): any[] => (plan.meals || []).flatMap((m: any) => m.items || []);
const crumbs = (plan: any): number => items(plan).filter((x: any) => {
  const f = crumbFloor(x);
  return f > 0 && (Number(x.amount) || 0) < f - 1e-9;
}).length;
/** «Не еда»: крахмал ≥ 100 г в приёме, где белка меньше 20 г. */
const notFoodOf = (m: any): number => {
  if (pOf(m) >= 20) return 0;
  return (m.items || []).filter((x: any) =>
    (x.role === 'carb_slow' || x.role === 'carb_fast') && (Number(x.amount) || 0) >= 100).length;
};
const notFood = (plan: any): number => (plan.meals || []).reduce((s: number, m: any) => s + notFoodOf(m), 0);
const notFoodMains = (plan: any): number => (plan.meals || [])
  .filter((m: any) => ['breakfast', 'lunch', 'dinner'].includes(String(m.type)))
  .reduce((s: number, m: any) => s + notFoodOf(m), 0);
const clsOf = (t: string): string => (t === 'breakfast' || t === 'lunch' || t === 'dinner')
  ? 'main' : (/^snack/.test(t) ? 'snack' : 'peri');
const classBuckets = (plan: any): number => {
  let n = 0;
  for (const cls of ['main', 'snack']) {
    const list = (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && clsOf(String(m.type)) === cls);
    if (list.length < 2) continue;
    const sh = list.reduce((s: number, m: any) => s + (Number(m.totals?.kcal) || 0), 0) / list.length;
    if (!(sh > 0)) continue;
    n += list.filter((m: any) => (Number(m.totals?.kcal) || 0) > sh * 1.35).length;
  }
  return n;
};

type Row = { key: string; manual: boolean; goalKcal: number; plan: any };
const ROWS: Row[] = [];
for (const manual of [true, false]) {
  for (const p of PROFILES) for (const mc of [3, 5]) for (const tr of [true, false]) {
    ROWS.push({ key: `${manual ? 'руч' : 'авт'}/${p.id}/${mc}/${tr ? 'тр' : 'отд'}`, manual, goalKcal: p.k, plan: build(p, mc, tr, manual) });
  }
}
const at = (key: string) => ROWS.find(r => r.key === key)!;

describe('§8.128 «не еда»: крахмальная тарелка без белка', () => {
  it('сетка покрывает 80 дней (40 авто + 40 ручных)', () => {
    expect(ROWS).toHaveLength(80);
  });

  it('в мейнах «гарниров без белка» нет ни одного дня', () => {
    const bad = ROWS.filter(r => notFoodMains(r.plan) > 0).map(r => `${r.key}: ${notFoodMains(r.plan)}`);
    expect(bad.join(' | ')).toBe('');
  });

  it('«не еда» в перекусах: авто ≤ 12, ручной ≤ 10 (было 42 / 40 на 160 днях)', () => {
    const auto = ROWS.filter(r => !r.manual).reduce((s, r) => s + notFood(r.plan), 0);
    const manual = ROWS.filter(r => r.manual).reduce((s, r) => s + notFood(r.plan), 0);
    const worst = ROWS.filter(r => notFood(r.plan) > 0)
      .map(r => `${r.key}:${notFood(r.plan)}`).join(' | ');
    expect(auto, worst).toBeLessThanOrEqual(12);
    expect(manual, worst).toBeLessThanOrEqual(10);
  });

  it('обмен не создаёт обрезков и не выпускает день за канон', () => {
    const bad: string[] = [];
    for (const r of ROWS) {
      if (crumbs(r.plan) > 0) bad.push(`${r.key}: обрезков ${crumbs(r.plan)}`);
      const dev = Number(r.plan.deviationPct) || 0;
      const lim = r.manual ? 2 : 3;
      if (dev > lim + 1e-6) bad.push(`${r.key}: ${dev.toFixed(2)} % > ${lim} %`);
    }
    expect(bad.join(' | ')).toBe('');
  });

  it('тарелки не выходят за контракт 900 г, вёдра в классе не растут', () => {
    const bad: string[] = [];
    for (const r of ROWS) {
      for (const m of r.plan.meals || []) {
        if (solid(m) > 900) bad.push(`${r.key}: ${m.type} ${Math.round(solid(m))} г`);
      }
    }
    expect(bad.join(' | ')).toBe('');
    const auto = ROWS.filter(r => !r.manual).reduce((s, r) => s + classBuckets(r.plan), 0);
    const manual = ROWS.filter(r => r.manual).reduce((s, r) => s + classBuckets(r.plan), 0);
    expect(auto, 'вёдра в классе, авто').toBeLessThanOrEqual(19);
    expect(manual, 'вёдра в классе, руч').toBeLessThanOrEqual(16);
  });

  it('адресные дни: перекус-гарнир получил белок (было 11 / 10 г)', () => {
    const snack = (key: string, type: string) =>
      (at(key).plan.meals || []).find((m: any) => String(m.type) === type)!;
    for (const key of ['авт/c1500/3/тр', 'руч/c1500/3/тр']) {
      const m = snack(key, 'snack3');
      expect(pOf(m), `${key} snack3: ${Math.round(pOf(m))} г белка`).toBeGreaterThanOrEqual(20);
      expect(notFoodOf(m), key).toBe(0);
    }
  });

  it('суммы дня сохраняются обменом: ккал совпадает с целью дня', () => {
    for (const r of ROWS) {
      const t = r.plan.totals || {};
      expect(Math.abs((Number(t.kcal) || 0) - r.goalKcal) / r.goalKcal, r.key).toBeLessThanOrEqual(0.031);
    }
  });
});
