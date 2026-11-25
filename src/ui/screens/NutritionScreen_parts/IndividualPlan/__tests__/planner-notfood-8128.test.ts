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

const build = (p: any, mc: number, tr: boolean, manual: boolean, ex: any = {}): any =>
  buildDayPlan({
    weightKg: p.w,
    lbmKg: Math.round(p.w * 0.82),
    bodyFatPct: 18,
    sex: 'male',
    goalKcal: p.k,
    goalProteinG: p.p,
    goalFatG: p.f,
    goalCarbsG: carbsFor(p),
    mealsCount: mc,
    isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined,
    trainDurationMin: 75,
    allowIntraWorkout: true,
    budget: 'medium',
    dayOffset: 0,
    cyclePhase: 'none',
    variety: 'medium',
    goal: 'maintenance',
    quality: 'full',
    excludedIds: new Set<string>(),
    allergenTags: new Set<string>(),
    randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
    ...ex,
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
const solid = (m: any): number =>
  (m.items || [])
    .filter((x: any) => String(x.role || '') !== 'liquid')
    .reduce((s: number, x: any) => s + (Number(x.amount) || 0), 0);
const items = (plan: any): any[] => (plan.meals || []).flatMap((m: any) => m.items || []);
const crumbs = (plan: any): number =>
  items(plan).filter((x: any) => {
    const f = crumbFloor(x);
    return f > 0 && (Number(x.amount) || 0) < f - 1e-9;
  }).length;
/** «Не еда»: крахмал ≥ 100 г в приёме, где белка меньше 20 г. */
const notFoodOf = (m: any): number => {
  if (pOf(m) >= 20) return 0;
  return (m.items || []).filter(
    (x: any) => (x.role === 'carb_slow' || x.role === 'carb_fast') && (Number(x.amount) || 0) >= 100,
  ).length;
};
const notFood = (plan: any): number => (plan.meals || []).reduce((s: number, m: any) => s + notFoodOf(m), 0);
const notFoodMains = (plan: any): number =>
  (plan.meals || [])
    .filter((m: any) => ['breakfast', 'lunch', 'dinner'].includes(String(m.type)))
    .reduce((s: number, m: any) => s + notFoodOf(m), 0);
const clsOf = (t: string): string =>
  t === 'breakfast' || t === 'lunch' || t === 'dinner' ? 'main' : /^snack/.test(t) ? 'snack' : 'peri';
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
  for (const p of PROFILES)
    for (const mc of [3, 5])
      for (const tr of [true, false]) {
        ROWS.push({
          key: `${manual ? 'руч' : 'авт'}/${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
          manual,
          goalKcal: p.k,
          plan: build(p, mc, tr, manual),
        });
      }
}
const at = (key: string) => ROWS.find((r) => r.key === key)!;

describe('§8.128 «не еда»: крахмальная тарелка без белка', () => {
  it('сетка покрывает 80 дней (40 авто + 40 ручных)', () => {
    expect(ROWS).toHaveLength(80);
  });

  it('в мейнах «гарниров без белка» нет ни одного дня', () => {
    const bad = ROWS.filter((r) => notFoodMains(r.plan) > 0).map((r) => `${r.key}: ${notFoodMains(r.plan)}`);
    expect(bad.join(' | ')).toBe('');
  });

  it('«не еда» в перекусах: авто ≤ 12, ручной ≤ 10 (было 42 / 40 на 160 днях)', () => {
    const auto = ROWS.filter((r) => !r.manual).reduce((s, r) => s + notFood(r.plan), 0);
    const manual = ROWS.filter((r) => r.manual).reduce((s, r) => s + notFood(r.plan), 0);
    const worst = ROWS.filter((r) => notFood(r.plan) > 0)
      .map((r) => `${r.key}:${notFood(r.plan)}`)
      .join(' | ');
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
    const auto = ROWS.filter((r) => !r.manual).reduce((s, r) => s + classBuckets(r.plan), 0);
    const manual = ROWS.filter((r) => r.manual).reduce((s, r) => s + classBuckets(r.plan), 0);
    expect(auto, 'вёдра в классе, авто').toBeLessThanOrEqual(19);
    expect(manual, 'вёдра в классе, руч').toBeLessThanOrEqual(16);
  });

  it('адресные дни: перекус-гарнир получил белок (было 11 / 10 г)', () => {
    const snack = (key: string, type: string) => (at(key).plan.meals || []).find((m: any) => String(m.type) === type)!;
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

  // ─── P2-4: замок на саму полосу допуска §8.128 ─────────────────────────────────
  // Обмен принимается, если `_dev128() <= devB + max(5e-4, min(0.35 п.п., канон − devB))`:
  // округление пунктов до 0.1 г (0.1 г на самой узкой оси — 0.22 п.п.) не отменяет вылеченный
  // перекус, но канон владельца остаётся жёстким потолком — на дне, уже стоящем в полосе
  // 0.35 п.п. от канона, допуск срезается до `канон − devB` (на самом каноне — до 5e-4).
  //
  // Что наблюдаемо, а что нет (честно):
  //  • `plan.deviationPct` — отклонение дня, посчитанное ДО §8.127/§8.128, то есть ровно та
  //    величина, которую приёмка §8.128 видит как `devB` (4 оси, ккал против введённых).
  //    Поэтому здесь она = «старт» дня на входе обмена.
  //  • Финала §8.128 через публичный API не видно: стадия внутренняя, а поздние §8.68/§8.72/
  //    §8.134 переписывают тарелку. Замер `руч/c1500/3/тр`: 1.2 % на входе стадии, 2.85 %
  //    жира по финальной тарелке после §8.134 («Носители не монополисты»). Поэтому финал
  //    сверяется ДВУМЯ независимыми мерами: полем дня (`deviationPct`/`withinTolerance`) и
  //    отклонением, посчитанным из фактической тарелки той же 4-осевой формулой (белок
  //    двусторонний); вторая мера из первой не выводится.
  //  • Дня, который приходит к §8.128 уже ВНЕ канона, на сетке 80 дней нет: максимум равен
  //    канону (на замере 2026-11-25 — 4 дня: `авт/hugeCarb/3/тр`, `авт/hugeCarb/5/тр`,
  //    `руч/cutF50/3/отд`, `руч/recomp80/5/тр`). Пункт «стартует вне канона — не ухудшается»
  //    проверяется на ближайшем наблюдаемом крае: день на самом каноне получает допуск 5e-4 и
  //    не имеет права выторговать приём ценою канона.
  const BAD128_P_G = 18.5;
  /** Крахмальные носители приёма в смысле §8.128: углеводные позиции без `_fixedGrams`. */
  const carbs128Of = (m: any): any[] =>
    (m.items || []).filter((x: any) => (x.role === 'carb_slow' || x.role === 'carb_fast') && !x._fixedGrams);
  /**
   * Крупнейший носитель приёма в граммах — ровно то, что движок зовёт «крахмальной тарелкой»
   * (`_isBad128`, `meal-plan-engine.ts:27140-27143`: `_carOf128(m).some(x => amount >= 100)`).
   * Здесь раньше СУММИРОВАЛИСЬ граммы всех носителей, и два носителя по 60 г давали «не еду»,
   * которой движок не видит: метрика была строже правила и могла покраснеть на законной тарелке.
   */
  const starch128Of = (m: any): number =>
    carbs128Of(m).reduce((mx: number, x: any) => Math.max(mx, Number(x.amount) || 0), 0);
  /** «Не еда» по собственному порогу §8.128 (`_isBad128`): носитель ≥ 100 г при белке < 18.5 г. */
  const bad128Of = (plan: any): any[] =>
    (plan.meals || []).filter((m: any) => (m.items || []).length > 0 && pOf(m) < BAD128_P_G && starch128Of(m) >= 100);
  const mealSig = (m: any): string => `${m.type}: p${Math.round(pOf(m))}/st${Math.round(starch128Of(m))}`;
  const profileOf = (key: string): any => PROFILES.find((p) => key.includes('/' + p.id + '/'))!;
  /** Отклонение дня по ФАКТИЧЕСКОЙ тарелке — 4-осевая формула §8.128 (белок двусторонний). */
  const plateDevOf = (plan: any, p: any): number => {
    const t = (plan.meals || []).reduce(
      (a: any, m: any) => {
        for (const x of m.items || []) {
          a.kcal += Number(x.kcal) || 0;
          a.p += Number(x.p) || 0;
          a.f += Number(x.f) || 0;
          a.c += Number(x.c) || 0;
        }
        return a;
      },
      { kcal: 0, p: 0, f: 0, c: 0 },
    );
    const g = { kcal: p.k, p: p.p, f: p.f, c: carbsFor(p) };
    return (
      100 *
      Math.max(
        Math.abs(t.kcal - g.kcal) / g.kcal,
        Math.abs(t.p - g.p) / g.p,
        Math.abs(t.f - g.f) / g.f,
        g.c > 0 ? Math.abs(t.c - g.c) / g.c : 0,
      )
    );
  };
  const hasSwap128 = (plan: any): boolean =>
    (plan.notes || []).some((n: string) => /Крахмальная тарелка получила белок/.test(n));

  it('полоса §8.128: день, пришедший к обмену внутри канона, остаётся в каноне и закрывает «не еду» (`авт/small60/4/тр`)', () => {
    // Свойство дня, а НЕ свидетель полосы: замер мутацией `_roundNoise128 = 0` (2026-11-25) —
    // обмен здесь принимается и без допуска (нота «Крахмальная тарелка получила белок» остаётся),
    // поэтому тест проверяет, что принятый обмен не выводит день за канон и не оставляет
    // крахмальной тарелки без белка. Полосу держат два свидетеля ниже (`mass110`, `normal90`).
    const p = PROFILES.find((x) => x.id === 'small60')!;
    const plan = build(p, 4, true, false);
    expect(hasSwap128(plan), 'обмен §8.128 принят').toBe(true);
    expect(bad128Of(plan).map(mealSig), '«не еда» по порогу §8.128').toEqual([]);
    expect(notFood(plan), '«не еда» по метрике файла').toBe(0);
    const dev = Number(plan.deviationPct) || 0;
    expect(plan.canonPct, 'канон авто-дня').toBe(3);
    expect(plan.withinTolerance, `поле дня ${dev} %`).toBe(true);
    expect(dev, `поле дня ${dev} %`).toBeLessThanOrEqual(3 + 1e-9);
    const plate = plateDevOf(plan, p);
    expect(plate, `финальная тарелка ${plate.toFixed(2)} %`).toBeLessThanOrEqual(3 + 1e-6);
    // Тот же день по фактической тарелке: обе меры независимо внутри канона. Полосу 0.35 п.п.
    // через РАЗНОСТЬ этих мер мерить нельзя: `deviationPct` считает белок полом (`_dPxUnder`,
    // `meal-plan-engine.ts:26299`), а `plateDevOf` — двусторонне, как `_dev128`; перебор белка
    // дал бы ложное «обмен сдвинул день». На этом дне из поздних стадий сработала только §8.128
    // (в нотах ни §8.68, ни §8.72, ни §8.134), поэтому тарелка и есть финал стадии.
    expect(Math.max(dev, plate), `день ${dev} % / тарелка ${plate.toFixed(2)} %`).toBeLessThanOrEqual(3 + 1e-6);
  });

  it('полоса §8.128: ручной день не выходит за 2 % + 0.05 п.п. (`руч/c1500/3/отд`)', () => {
    const r = at('руч/c1500/3/отд');
    expect(hasSwap128(r.plan), 'обмен §8.128 принят').toBe(true);
    const dev = Number(r.plan.deviationPct) || 0;
    expect(r.plan.canonPct, 'канон ручного дня').toBe(2);
    expect(r.plan.withinTolerance, `поле дня ${dev} %`).toBe(true);
    // `deviationPct` округлён до 0.1 п.п., поэтому здесь наблюдаемо «≤ 2.0 %»; заявленный потолок
    // «2 % + 0.05 п.п.» проверяется ниже по фактической тарелке (`plateDevOf`, без округления).
    expect(dev, `поле дня ${dev} %`).toBeLessThanOrEqual(2.05);
    const plate = plateDevOf(r.plan, profileOf(r.key));
    expect(plate, `финальная тарелка ${plate.toFixed(2)} %`).toBeLessThanOrEqual(2.05);
    expect(bad128Of(r.plan).map(mealSig)).toEqual([]);
    expect(crumbs(r.plan)).toBe(0);
    // Сетка: потолок 2 % + 0.05 п.п. не превышен ни на одном ручном дне, а флаг
    // `withinTolerance` — ровно по канону пути (2 % ручной / 3 % авто).
    const over = ROWS.filter((x) => x.manual && (Number(x.plan.deviationPct) || 0) > 2.05).map((x) => x.key);
    expect(over.join(' | ')).toBe('');
    const flagBad = ROWS.filter((x) => {
      const c = x.manual ? 2 : 3;
      const devOk = (Number(x.plan.deviationPct) || 0) <= c;
      return x.plan.canonPct !== c || x.plan.withinTolerance !== devOk;
    }).map((x) => x.key);
    expect(flagBad.join(' | ')).toBe('');
  });

  it('полоса §8.128: дни у самой границы канона не выходят за него — ни полем, ни тарелкой', () => {
    const canonOf = (r: Row): number => (r.manual ? 2 : 3);
    const devOf = (r: Row): number => Number(r.plan.deviationPct) || 0;
    const edge = ROWS.filter((r) => devOf(r) > canonOf(r) - 0.35 - 1e-9 && devOf(r) <= canonOf(r) + 1e-9);
    expect(edge.length, `в полосе 0.35 п.п.: ${edge.map((r) => r.key).join(', ')}`).toBeGreaterThan(0);
    expect(
      edge.some((r) => r.manual),
      'есть ручной день в полосе',
    ).toBe(true);
    expect(
      edge.some((r) => !r.manual),
      'есть авто-день в полосе',
    ).toBe(true);
    const bad: string[] = [];
    for (const r of edge) {
      const c = canonOf(r);
      const d = devOf(r);
      if (!(d <= c + 1e-9)) bad.push(`${r.key}: поле ${d} % > ${c} %`);
      if (r.plan.withinTolerance !== true) bad.push(`${r.key}: withinTolerance=false при ${d} %`);
      if (r.plan.canonPct !== c) bad.push(`${r.key}: canonPct ${r.plan.canonPct} ≠ ${c}`);
      const plate = plateDevOf(r.plan, profileOf(r.key));
      if (plate > c + 1e-6) bad.push(`${r.key}: тарелка ${plate.toFixed(2)} % > ${c} %`);
      if (crumbs(r.plan) > 0) bad.push(`${r.key}: обрезков ${crumbs(r.plan)}`);
    }
    expect(bad.join(' | ')).toBe('');
    // Дня «стартует ВНЕ канона» на сетке нет — фиксируем это явно, чтобы тест не выдавал
    // себя за проверку сценария, которого здесь нет.
    const outside = ROWS.filter((r) => devOf(r) > canonOf(r) + 1e-9).map((r) => `${r.key}:${devOf(r)}`);
    expect(outside.join(' | '), 'дней вне канона на сетке').toBe('');
    // Самый тесный край — дни у самого канона: `roundNoise = канон − devB ≈ 0`, то есть допуск
    // срезан до 5e-4 и любая «выторгованная» десятая пункта вывела бы день за канон. Поле дня
    // округлено до 0.1 п.п., поэтому «на каноне» наблюдаемо как `|dev − канон| ≤ 0.1`. Состав
    // набора зависит от траектории движка (замер 2026-11-25: 6 дней в пределах 0.1 п.п. от канона —
    // `руч/cutF50/3/отд`, `руч/recomp80/5/тр`, `руч/recomp80/5/отд`, `авт/hugeCarb/3/тр`,
    // `авт/hugeCarb/5/тр`, `авт/small60/3/отд`), поэтому замок держит СВОЙСТВА набора, а не список
    // ключей: прибитый список краснел бы на любой законной правке планировщика, не проверяя при
    // этом ничего сверх тех же свойств.
    const atCanon = ROWS.filter((r) => Math.abs(devOf(r) - canonOf(r)) <= 0.1 + 1e-9);
    expect(atCanon.length, `дни ровно на каноне: ${atCanon.map((r) => r.key).join(', ')}`).toBeGreaterThanOrEqual(2);
    expect(
      atCanon.some((r) => r.manual),
      'есть ручной день ровно на каноне',
    ).toBe(true);
    expect(
      atCanon.some((r) => !r.manual),
      'есть авто-день ровно на каноне',
    ).toBe(true);
    for (const r of atCanon) {
      const c = canonOf(r);
      expect(r.plan.withinTolerance, r.key).toBe(true);
      expect(bad128Of(r.plan).length, `${r.key}: «не еда» ≤ замера — канон не выторгован`).toBeLessThanOrEqual(2);
      const plate = plateDevOf(r.plan, profileOf(r.key));
      expect(plate, `${r.key}: тарелка ${plate.toFixed(2)} %`).toBeLessThanOrEqual(c + 1e-6);
    }
  });

  it('полоса §8.128 решает там, где день не впритык: без неё обмен откатывается (`руч/mass110/2/тр`)', () => {
    // Свидетель найден расширением сетки (10 профилей × 2–8 приёмов × тр/отд × salt 0–2 ×
    // dayOffset 0–2 = 2160 дней): на базовой сетке файла (salt 0, 3/5 приёмов) полоса инертна —
    // удаление допуска (`_roundNoise128 = 0`) не меняет ни одного из 80 дней. Здесь же обмен
    // сдвигает поле на +0.1…0.35 п.п.: с полосой он принят (обмен 1, «не еда» 0), без полосы —
    // откат (обмен 0, «не еда» 1, жир дня 120 → 120.3 г).
    const p = PROFILES.find((x) => x.id === 'mass110')!;
    const plan = build(p, 2, true, true, { randomSalt: 1 });
    expect(hasSwap128(plan), 'обмен §8.128 принят').toBe(true);
    expect(bad128Of(plan).map(mealSig), '«не еда» по порогу §8.128').toEqual([]);
    const dev = Number(plan.deviationPct) || 0;
    expect(plan.canonPct, 'канон ручного дня').toBe(2);
    expect(plan.withinTolerance, `поле дня ${dev} %`).toBe(true);
    expect(dev, `поле дня ${dev} %`).toBeLessThanOrEqual(2 + 1e-9);
    const plate = plateDevOf(plan, p);
    expect(plate, `финальная тарелка ${plate.toFixed(2)} %`).toBeLessThanOrEqual(2 + 1e-6);
    expect(crumbs(plan), 'обрезков').toBe(0);
  });

  it('полоса §8.128 решает и на авто-дне (`авт/normal90/8/отд`, salt=1)', () => {
    // Тот же замер 2160 дней: без полосы обмен на этом дне откатывается — «не еда» 0 → 1.
    const p = PROFILES.find((x) => x.id === 'normal90')!;
    const plan = build(p, 8, false, false, { randomSalt: 1 });
    expect(hasSwap128(plan), 'обмен §8.128 принят').toBe(true);
    expect(bad128Of(plan).map(mealSig), '«не еда» по порогу §8.128').toEqual([]);
    const dev = Number(plan.deviationPct) || 0;
    expect(plan.canonPct, 'канон авто-дня').toBe(3);
    expect(plan.withinTolerance, `поле дня ${dev} %`).toBe(true);
    const plate = plateDevOf(plan, p);
    expect(plate, `финальная тарелка ${plate.toFixed(2)} %`).toBeLessThanOrEqual(3 + 1e-6);
    expect(crumbs(plan), 'обрезков').toBe(0);
  });

  it('§8.128 не оставляет «не еды» на обычных днях: остаток — только крахмальные экстремумы', () => {
    // Сторожевая граница, а не список ключей: на замере 2026-11-25 остаток — 16 гарниров на
    // 8 днях, и все они `hugeCarb`/`c1500` (8–12 приёмов при 250–300 г белка, где 20 г на приём
    // арифметически не влезают — это долг §8.128, записанный в шапке файла). Появление «не еды»
    // на обычном дне — красный; рост остатка на экстремуме — тоже: потолок держит замер, а не
    // «сколько получится». Прибитый список ключей краснел бы от любой законной правки движка,
    // не проверяя ничего сверх этих же свойств.
    const bad = ROWS.filter((r) => bad128Of(r.plan).length > 0);
    const detail = bad.map((r) => `${r.key}:${bad128Of(r.plan).length}`).join(' | ');
    const odd = bad
      .filter((r) => !/\/(hugeCarb|c1500)\//.test(r.key))
      .map((r) => `${r.key}:${bad128Of(r.plan).length}`);
    expect(odd.join(' | '), '«не еда» на обычных днях').toBe('');
    const total = bad.reduce((s, r) => s + bad128Of(r.plan).length, 0);
    expect(total, `остаток: ${detail}`).toBeLessThanOrEqual(16);
    expect(bad.length, `дней с «не едой»: ${detail}`).toBeLessThanOrEqual(8);
  });
});
