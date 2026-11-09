import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.57 «выравнивание тарелок» (стадия `autoMealRebalance`, по умолчанию ВКЛ).
 *
 * Зачем: ведро — арифметика «N приёмов × кап массы». 2065 г еды на 3000 ккал
 * (1.45 ккал/г) при 4 приёмах = 500–880 г на тарелку; раскладка (QG53) и плотные
 * носители (§8.56) вёдра не чинят без потери GL/микро, а новый приём дробит белок
 * и роняет ось «белок ядра» (замер 88.18 против 91.25).
 *
 * Что делает стадия: у самого тяжёлого приёма дня берёт гарнир и переносит в приём
 * с 0–1 гарниром (не в peri-окна, не в предсон). Два пасса:
 *  1) новый пункт — только если в получателе ≤1 гарнира (лимит «≤2 гарнира», P1/P1b),
 *     семейный кап дня проходит, «второй гарнир ≤30%» держится, завтрак не получает
 *     рис/картофель/макароны (P1), поздний перекус — овсянку/десерты (E17),
 *     anti-repeat carb-id между основными приёмами не появляется, донор не роняет
 *     ось «белок основного приёма» ниже 0.30 г/кг;
 *  2) слияние с уже стоящим в приёме тем же гарниром — новый пункт не появляется,
 *     поэтому лимиты гарниров/семейств/anti-repeat не затрагиваются вовсе.
 * Число приёмов, белок, жир, микро дня не меняются.
 *
 * Гейты (как у перекладки белка QG14): рецептурный контур, HV-дни и болюс-дни ведут
 * свои проходы — стадия их не трогает, иначе ломаются контракты инсулиновых окон и
 * HV-матриц.
 *
 * Замер (60 дней: 10 профилей × 4/5/6 приёмов × трен/отдых, стадия включена):
 * - обычные дни: вёдер 19 → 10, максимум тарелки 878 → 629 г, дней с 2+ вёдрами нет;
 * - экстремальные (HV/болюс): не тронуты гейтом — те же ≤5 вёдер и ≤888 г;
 * - средняя оценка дня 91.25 → 91.30, НИ ОДИН день не потерял балл;
 * - число приёмов не изменилось ни в одном дне;
 * - весь контур IndividualPlan: 191 файл зелёный.
 */

const PROFILES: Array<{ id: string; w: number; lbm: number; bf: number; sex: 'male' | 'female'; k: number; p: number; f: number; c?: number; extreme: boolean }> = [
  { id: 'p500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 4600, p: 500, f: 120, extreme: true },
  { id: 'c1500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 8370, p: 300, f: 130, c: 1500, extreme: true },
  { id: 'hugeCarb', w: 100, lbm: 82, bf: 18, sex: 'male', k: 6700, p: 250, f: 100, extreme: true },
  { id: 'mass110', w: 110, lbm: 90, bf: 18, sex: 'male', k: 5200, p: 260, f: 120, extreme: true },
  { id: 'normal90', w: 90, lbm: 73, bf: 19, sex: 'male', k: 3000, p: 200, f: 80, extreme: false },
  { id: 'mid75', w: 75, lbm: 61, bf: 18, sex: 'male', k: 2400, p: 180, f: 70, extreme: false },
  { id: 'small60', w: 60, lbm: 49, bf: 18, sex: 'female', k: 1600, p: 150, f: 45, extreme: false },
  { id: 'cutF50', w: 50, lbm: 41, bf: 18, sex: 'female', k: 1240, p: 110, f: 40, extreme: false },
  { id: 'recomp80', w: 80, lbm: 65, bf: 18, sex: 'male', k: 2200, p: 200, f: 60, extreme: false },
  { id: 'keto85', w: 85, lbm: 70, bf: 18, sex: 'male', k: 2400, p: 180, f: 150, extreme: false },
];

const carbsFor = (p: { k: number; p: number; f: number; c?: number }) => (
  p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4))
);

const build = (p: typeof PROFILES[number], mc: number, tr: boolean, rebalance: boolean, fruitFloor = true): any => buildDayPlan({
  weightKg: p.w, lbmKg: p.lbm, bodyFatPct: p.bf, sex: p.sex,
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  // §8.78 (плотный овощ вместо объёма) выключается в обоих вариантах: иначе A/B
  // перестаёт быть сравнением одной стадии (микро меняются до её гейтов).
  vegDensity78: false,
  // §8.84 (перенос белка между приёмами) изолирован: замок мерит только свою стадию.
  proteinSmooth84: false,
  autoMealRebalance: rebalance,
  fruitPortionFloor: fruitFloor,
} as unknown as MealPlanInput);

const SOLID_SKIP = new Set(['liquid', 'supplement']);
const solidG = (m: any): number => (m.items || [])
  .filter((i: any) => !SOLID_SKIP.has(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

const cells = (extreme: boolean, rebalance: boolean, fruitFloor = true) => PROFILES.filter((p) => p.extreme === extreme)
  .flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
    key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
    plan: build(p, mc, tr, rebalance, fruitFloor),
  }))));

describe('§8.57 выравнивание тарелок (`autoMealRebalance`)', () => {
  it('обычный день: вёдер ≤2 на день и ≤650 г в приёме; было 878 г', () => {
    const rows = cells(false, true);
    expect(rows).toHaveLength(36);
    const perDay = rows.map((r) => ({
      key: r.key,
      n: (r.plan.meals || []).filter((m: any) => solidG(m) > 500).length,
      max: Math.max(0, ...(r.plan.meals || []).map((m: any) => solidG(m))),
    }));
    expect(perDay.filter((r) => r.n > 2).map((r) => `${r.key}=${r.n}`).join(', ')).toBe('');
    expect(perDay.filter((r) => r.max > 650).map((r) => `${r.key}=${Math.round(r.max)}г`).join(', ')).toBe('');
  });

  it('экстремальный HV/болюс-день: гейт — стадия не трогает день (≤5 вёдер, ≤900 г)', () => {
    const rows = cells(true, true);
    expect(rows).toHaveLength(24);
    const perDay = rows.map((r) => ({
      key: r.key,
      n: (r.plan.meals || []).filter((m: any) => solidG(m) > 500).length,
      max: Math.max(0, ...(r.plan.meals || []).map((m: any) => solidG(m))),
    }));
    expect(perDay.filter((r) => r.n > 5).map((r) => `${r.key}=${r.n}`).join(', ')).toBe('');
    expect(perDay.filter((r) => r.max > 900).map((r) => `${r.key}=${Math.round(r.max)}г`).join(', ')).toBe('');
  });

  it('гейт: на HV/болюс-дне стадия не меняет ни один грамм', () => {
    const off = cells(true, false);
    const on = cells(true, true);
    const changed: string[] = [];
    for (let i = 0; i < off.length; i++) {
      const a = JSON.stringify((off[i].plan.meals || []).map((m: any) => (m.items || []).map((it: any) => [it.id, it.amount])));
      const b = JSON.stringify((on[i].plan.meals || []).map((m: any) => (m.items || []).map((it: any) => [it.id, it.amount])));
      if (a !== b) changed.push(off[i].key);
    }
    expect(changed.join(', ')).toBe('');
  });

  it('ни один день не теряет балл, число приёмов не меняется', () => {
    const off = new Map(cells(false, false).concat(cells(true, false)).map((r) => [r.key, r.plan]));
    const on = cells(false, true).concat(cells(true, true));
    expect(on).toHaveLength(60);
    const lost: string[] = [];
    const countChanged: string[] = [];
    for (const row of on) {
      const before = off.get(row.key);
      const a = Number(before?.qualityScore?.total) || 0;
      const b = Number(row.plan.qualityScore?.total) || 0;
      if (b < a) lost.push(`${row.key}: ${a}→${b}`);
      if ((before?.meals || []).length !== (row.plan.meals || []).length) {
        countChanged.push(`${row.key}: ${(before?.meals || []).length}→${(row.plan.meals || []).length}`);
      }
    }
    expect(lost.join(', ')).toBe('');
    expect(countChanged.join(', ')).toBe('');
  });

  it('цель приёма переезжает вместе с гарниром: сумма целей дня не меняется', () => {
    const sumT = (pl: any, k: string) => (pl.meals || []).reduce((s: number, m: any) => s + (Number(m.target?.[k]) || 0), 0);
    const off = cells(false, false, false);
    const on = cells(false, true, false);
    const bad: string[] = [];
    for (const row of on) {
      const before = off.find((r) => r.key === row.key)!.plan;
      for (const k of ['p', 'c', 'f']) {
        if (Math.abs(sumT(row.plan, k) - sumT(before, k)) > 0.5) bad.push(`${row.key}:${k}`);
      }
      for (const m of row.plan.meals || []) {
        for (const k of ['p', 'c', 'f']) if ((Number(m.target?.[k]) || 0) < 0) bad.push(`${row.key}:${m.type}:${k}<0`);
      }
    }
    expect(bad.join(', ')).toBe('');
  });

  it('перенос не оставляет в получателе красный перебор углеводов', () => {
    // Замер: 15 дней / 31 приём, где перенос сдвинул углеводы тарелки больше 5 г.
    // Цель обязана сдвинуться РОВНО на столько же: иначе UI показывал «60,7 / 10 г»
    // красным перебором, хотя план сам положил еду в этот приём.
    const off = cells(false, false, false);
    const on = cells(false, true, false);
    const bad: string[] = [];
    let checked = 0;
    for (const row of on) {
      const before = off.find((r) => r.key === row.key)!.plan;
      const offByType = new Map<string, any[]>();
      for (const m of before.meals || []) {
        const list = offByType.get(String(m.type)) || [];
        list.push(m);
        offByType.set(String(m.type), list);
      }
      const seen = new Map<string, number>();
      for (const m of row.plan.meals || []) {
        const idx = seen.get(String(m.type)) || 0;
        seen.set(String(m.type), idx + 1);
        const o = (offByType.get(String(m.type)) || [])[idx];
        if (!o) continue;
        const dFood = (Number(m.totals?.c) || 0) - (Number(o.totals?.c) || 0);
        if (Math.abs(dFood) <= 5) continue;
        checked++;
        const dTarget = (Number(m.target?.c) || 0) - (Number(o.target?.c) || 0);
        if (Math.abs(dFood - dTarget) > 2) {
          bad.push(`${row.key} ${m.type}: еда ${dFood.toFixed(1)} г, цель ${dTarget.toFixed(1)} г`);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(15);
    expect(bad.join('; ')).toBe('');
  });
});
