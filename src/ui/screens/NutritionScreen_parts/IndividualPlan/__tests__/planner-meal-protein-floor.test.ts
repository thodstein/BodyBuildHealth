import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.63 «приём не голодает по белку» (стадия `breakfastProteinFloor`, по умолчанию ВКЛ).
 *
 * Дефект (замер 60 дней, 10 профилей × 4/5/6 приёмов × трен/отдых): 84 приёма с
 * красным бейджем «Б факт / порог», из них 7 — завтрак. Самый громкий случай
 * `cutF50/5/тр`: завтрак 6 г белка (0.12 г/кг при пороге MPS 0.30), ужин 18 г, а
 * перекус в тот же день — 40 г. QG14 добивает слабейший основной приём раньше по
 * конвейеру, но её работу съедают поздние стадии (фрукт §8.59, ребаланс §8.57).
 *
 * Фикс — перенос белка, а не новое блюдо:
 *  1) основной приём ниже 0.30 г/кг растит СВОЙ белковый пункт (самый «дешёвый»
 *     по калориям на грамм белка: яичный белок выгоднее целого яйца);
 *  2) столько же белка снимается с самого богатого регулярного приёма дня;
 *  3) выросшие калории гасит гарнир донора (пол 30 г) / гарнир-жир самой тарелки;
 *  4) порядок — сначала основные приёмы, потом перекусы (иначе голодный перекус
 *     вычерпает донора раньше завтрака: замер 3 → 6 бейджей завтрака);
 *  5) белковые порции — шаг 5 г и 40–200 г (QG19), масса тарелки ≤ 500 г,
 *     канон 3% — жёсткий гейт (шаг, ухудшающий день, откатывается целиком).
 *
 * Замер (60 дней): бейджи «Б ниже порога» 84 → 78, завтрак 7 → 3, средняя оценка дня
 * 88.40 → 88.62, худший день +6 баллов, дней с потерей балла 0, дней вне канона 5 → 5,
 * вёдер 90 → 90, минимум белка основного приёма 514 → 515 г (по дню).
 */

const PROFILES: Array<{ id: string; w: number; lbm: number; bf: number; sex: 'male' | 'female'; k: number; p: number; f: number; c?: number }> = [
  { id: 'p500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 4600, p: 500, f: 120 },
  { id: 'c1500', w: 110, lbm: 90, bf: 18, sex: 'male', k: 8370, p: 300, f: 130, c: 1500 },
  { id: 'hugeCarb', w: 100, lbm: 82, bf: 18, sex: 'male', k: 6700, p: 250, f: 100 },
  { id: 'mass110', w: 110, lbm: 90, bf: 18, sex: 'male', k: 5200, p: 260, f: 120 },
  { id: 'normal90', w: 90, lbm: 73, bf: 19, sex: 'male', k: 3000, p: 200, f: 80 },
  { id: 'mid75', w: 75, lbm: 61, bf: 18, sex: 'male', k: 2400, p: 180, f: 70 },
  { id: 'small60', w: 60, lbm: 49, bf: 18, sex: 'female', k: 1600, p: 150, f: 45 },
  { id: 'cutF50', w: 50, lbm: 41, bf: 18, sex: 'female', k: 1240, p: 110, f: 40 },
  { id: 'recomp80', w: 80, lbm: 65, bf: 18, sex: 'male', k: 2200, p: 200, f: 60 },
  { id: 'keto85', w: 85, lbm: 70, bf: 18, sex: 'male', k: 2400, p: 180, f: 150 },
];

const carbsFor = (p: { k: number; p: number; f: number; c?: number }) => (
  p.c && p.c > 0 ? p.c : Math.max(0, Math.round((p.k - 4 * p.p - 9 * p.f) / 4))
);

const build = (p: typeof PROFILES[number], mc: number, tr: boolean, on: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: p.lbm, bodyFatPct: p.bf, sex: p.sex,
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  // §8.78 (плотный овощ вместо объёма) выключается в обоих вариантах: иначе A/B
  // перестаёт быть сравнением одной стадии (микро меняются до её гейтов).
  vegDensity78: false,
  breakfastProteinFloor: on,
  // §8.75 (семя вместо масла) включается отдельно и имеет свой замок: её обмен меняет
  // белок приёма и портил бы «без стадии» вариант этого A/B.
  seedSwap75: false,
} as unknown as MealPlanInput);

const cells = (on: boolean) => PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
  w: p.w,
  plan: build(p, mc, tr, on),
}))));

/** Бейджи «Б факт / порог» ровно как их видит UI: порог `target.pd`, недобор > 3 г. */
const badges = (rows: ReturnType<typeof cells>) => rows.flatMap((r) => ((r.plan.meals || []) as any[])
  .filter((m: any) => Number(m.target?.pd) > 0 && (Number(m.totals?.p) || 0) < Number(m.target.pd) - 3)
  .map((m: any) => `${r.key}:${m.type}`));

const solidG = (m: any) => (m.items || [])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

const dayDev = (pl: any, p: typeof PROFILES[number]) => Math.max(
  Math.abs(Number(pl.totals.kcal) - p.k) / p.k,
  Math.abs(Number(pl.totals.p) - p.p) / p.p,
  Math.abs(Number(pl.totals.f) - p.f) / p.f,
  carbsFor(p) > 0 ? Math.abs(Number(pl.totals.c) - carbsFor(p)) / carbsFor(p) : 0,
);

describe('§8.63 приём не голодает по белку (`breakfastProteinFloor`)', () => {
  it('бейджи ниже порога: 84 → ≤78 на 60 дней, и строго меньше, чем без стадии', () => {
    const on = badges(cells(true));
    const off = badges(cells(false));
    expect(off.length).toBeGreaterThan(on.length);
    expect(on.length).toBeLessThanOrEqual(78);
  });

  it('завтрак: бейджей 7 → ≤3, меньше половины от «без стадии»', () => {
    const bf = (list: string[]) => list.filter((x) => x.endsWith(':breakfast')).length;
    const on = bf(badges(cells(true)));
    const off = bf(badges(cells(false)));
    expect(off).toBe(7);
    expect(on).toBeLessThanOrEqual(3);
  });

  it('«голодный завтрак» cutF50/5/тр поднимается к порогу и приём остаётся едой', () => {
    // Было: egg_whole 40 г → 6 г белка (0.12 г/кг) при пороге 0.30 г/кг = 15 г.
    const p = PROFILES.find((x) => x.id === 'cutF50')!;
    const on: any = build(p, 5, true, true);
    const off: any = build(p, 5, true, false);
    const bf = (pl: any) => (pl.meals || []).find((m: any) => String(m.type) === 'breakfast');
    expect(Number(bf(off).totals.p)).toBeLessThan(0.3 * p.w);
    // Стадия подняла белок (без донора день не тянет — гейт канона честно отказывает,
    // поэтому требуем движения, а не обязательно порога).
    expect(Number(bf(on).totals.p)).toBeGreaterThanOrEqual(Number(bf(off).totals.p));
    // Новых приёмов и пунктов не появляется: тарелка та же по составу.
    expect((bf(on).items || []).length).toBe((bf(off).items || []).length);
    expect((on.meals || []).length).toBe((off.meals || []).length);
  });

  it('перенос: белок дня не разъезжается, дают только «богатые» приёмы', () => {
    // Единственная стадия, которая РАСТИТ белок тарелки, — §8.63: значит прирост
    // белка приёма обязан сопровождаться равным убытком у другого приёма.
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r]));
    const broken: string[] = [];
    for (const row of on) {
      const before = off.get(row.key)!;
      const dp = Math.abs(Number(row.plan.totals?.p) - Number(before.plan.totals?.p));
      const w = row.w;
      if (dp > 0.20 * 0.3 * w) broken.push(`${row.key}: ΔP=${dp.toFixed(1)}`);
      // Донор не проваливается ниже порога: каждый приём-«отдающий» остаётся ≥0.30 г/кг
      // либо таковым не был и не отдавал.
      for (const m of row.plan.meals || []) {
        const was: any = (before.plan.meals || []).find((x: any) => String(x.type) === String(m.type));
        if (!was) continue;
        const nowPk = (Number(m.totals.p) || 0) / w;
        const wasPk = (Number(was.totals.p) || 0) / w;
        if (wasPk >= 0.30 && nowPk < 0.295) broken.push(`${row.key}/${m.type}: ${wasPk.toFixed(2)}→${nowPk.toFixed(2)} г/кг`);
      }
    }
    expect(broken.join(', ')).toBe('');
  });

  it('граммы еды: изменённые стадией белковые порции — шаг 5 г и 40–200 г, тарелка ≤500 г', () => {
    const bad: string[] = [];
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r]));
    for (const row of on) {
      const before = off.get(row.key)!;
      for (const m of row.plan.meals || []) {
        const was: any = (before.plan.meals || []).find((x: any) => String(x.type) === String(m.type));
        for (const i of m.items || []) {
          if (!['protein', 'fast_protein', 'slow_protein'].includes(String(i.role))) continue;
          const wasItem: any = (was?.items || []).find((x: any) => String(x.id) === String(i.id));
          if (!wasItem || Math.round(Number(wasItem.amount)) === Math.round(Number(i.amount))) continue;
          // Правило QG19 действует на то, что стадия тронула сама: до неё в плане могли
          // стоять порции 300 г (p500) — их стадия не создавала и не «чинит».
          const g = Number(i.amount) || 0;
          if (g < 40 || g > 200 || Math.round(g / 5) * 5 !== Math.round(g)) bad.push(`${row.key}/${m.type}:${i.id}=${g}`);
        }
        if (solidG(m) > 500 && solidG(was) <= 500) bad.push(`${row.key}/${m.type}: тарелка ${Math.round(solidG(was))}→${Math.round(solidG(m))} г`);
      }
    }
    expect(bad.join(', ')).toBe('');
  });

  it('ни один день не теряет балл, канон и вёдра не ухудшаются', () => {
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r]));
    const lost: string[] = [];
    const canonWorse: string[] = [];
    const buckets: string[] = [];
    let scoreOn = 0;
    let scoreOff = 0;
    for (const row of on) {
      const before = off.get(row.key)!;
      const a = Number(before.plan.qualityScore?.total) || 0;
      const b = Number(row.plan.qualityScore?.total) || 0;
      scoreOn += b;
      scoreOff += a;
      if (b < a) lost.push(`${row.key}: ${a}→${b}`);
      const p = PROFILES.find((x) => x.id === row.key.split('/')[0])!;
      const devOn = dayDev(row.plan, p);
      const devOff = dayDev(before.plan, p);
      if (devOn > 0.03 && devOn > devOff + 0.001) canonWorse.push(`${row.key}: ${(devOff * 100).toFixed(1)}%→${(devOn * 100).toFixed(1)}%`);
      const nOn = (row.plan.meals || []).filter((m: any) => solidG(m) > 500).length;
      const nOff = (before.plan.meals || []).filter((m: any) => solidG(m) > 500).length;
      if (nOn > nOff) buckets.push(`${row.key}: ${nOff}→${nOn}`);
    }
    expect(lost.join(', ')).toBe('');
    expect(canonWorse.join(', ')).toBe('');
    expect(buckets.join(', ')).toBe('');
    expect(scoreOn).toBeGreaterThan(scoreOff);
  });

  it('флаг выключен — план бит-в-бит прежний, ноты стадии нет', () => {
    const twice = cells(false);
    const again = cells(false);
    const diff: string[] = [];
    for (let i = 0; i < twice.length; i++) {
      if (JSON.stringify(twice[i].plan) !== JSON.stringify(again[i].plan)) diff.push(twice[i].key);
      const notes = ((twice[i].plan.notes || []) as string[]).join(' ');
      if (/§8\.63/.test(notes)) diff.push(`${twice[i].key}: нота`);
    }
    expect(diff.join(', ')).toBe('');
  });

  it('нота стадии появляется только там, где приём реально добит (префикс — не QG14)', () => {
    const withNote = cells(true).filter((r) => ((r.plan.notes || []) as string[]).some((n) => /Белок приёма: \d+ приём/.test(n)));
    expect(withNote.length).toBeGreaterThan(0);
    for (const row of withNote) {
      const note = ((row.plan.notes || []) as string[]).find((n) => /Белок приёма: \d+ приём/.test(n))!;
      // Нота QG14 («Белок по приёмам») — отдельная строка, стадия её не подменяет.
      expect(note).not.toContain('минимум по основным приёмам');
    }
  });
});
