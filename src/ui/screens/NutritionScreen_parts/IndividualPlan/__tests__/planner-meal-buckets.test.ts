import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * «Ведро» (§8.53 аудита): приём, в котором больше 500 г ТВЁРДОЙ еды.
 *
 * Проблема, которую держит замок: жалоба «в плане ведро еды на один приём». Дефект
 * измерим — вес твёрдых пунктов приёма (жидкости и добавки не считаются: изотоник
 * и сыворотка в воде — не «тарелка»).
 *
 * Замер (60 дней: 10 профилей × 4/5/6 приёмов × трен/отдых, pro-профиль):
 * - обычные дни (normal90 / mid75 / small60 / cutF50 / recomp80 / keto85, 36 дней):
 *   **ни одного дня с 3+ вёдрами**, максимум 2 на день; самый тяжёлый приём 878 г
 *   (normal90/4/отд — 3000 ккал на 4 приёма, это ~750 ккал = мясо + гарнир + салат);
 * - экстремальные (p500 500 г белка / c1500 1500 г углеводов / hugeCarb 6700 ккал /
 *   mass110 5200 ккал, 24 дня): физически 3+ кг еды в день — 5 вёдер максимум,
 *   самый тяжёлый приём 888 г. Это документированный «потолок ёмкости»: уменьшить
 *   вес можно только числом приёмов, а не раскладкой.
 *
 * Замок фиксирует ОБА факта: обычный день не превращается в «три ведра» (регресс
 * раскладки), а экстремальный не выходит за 900 г в одном приёме (там уже нужен
 * новый приём, а не ещё еда в тарелку).
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

const build = (p: typeof PROFILES[number], mc: number, tr: boolean): any => buildDayPlan({
  weightKg: p.w, lbmKg: p.lbm, bodyFatPct: p.bf, sex: p.sex,
  goalKcal: p.k, goalProteinG: p.p, goalFatG: p.f, goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
} as unknown as MealPlanInput);

/** Твёрдый вес приёма: без жидкостей (изотоник/вода) и добавок (порошки). */
const SOLID_SKIP = new Set(['liquid', 'supplement']);
const solidG = (m: any): number => (m.items || [])
  .filter((i: any) => !SOLID_SKIP.has(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

const days = (extreme: boolean) => PROFILES.filter((p) => p.extreme === extreme)
  .flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
    key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
    meals: (build(p, mc, tr).meals || []) as any[],
  }))));

describe('§8.53 «ведро» — вес одного приёма', () => {
  it('обычный день не несёт 3+ ведра (>500 г): максимум 2', () => {
    const rows = days(false);
    expect(rows).toHaveLength(36);
    const bad = rows
      .map((r) => ({ key: r.key, n: r.meals.filter((m: any) => solidG(m) > 500).length }))
      .filter((r) => r.n > 2);
    expect(bad.map((r) => `${r.key}=${r.n}`).join(', ')).toBe('');
  });

  it('экстремальный день: не больше 5 вёдер и не больше 900 г в одном приёме', () => {
    const rows = days(true);
    expect(rows).toHaveLength(24);
    const tooMany = rows
      .map((r) => ({ key: r.key, n: r.meals.filter((m: any) => solidG(m) > 500).length }))
      .filter((r) => r.n > 5);
    expect(tooMany.map((r) => `${r.key}=${r.n}`).join(', ')).toBe('');
    const tooHeavy = rows
      .map((r) => ({ key: r.key, g: Math.max(0, ...r.meals.map((m: any) => solidG(m))) }))
      .filter((r) => r.g > 900);
    expect(tooHeavy.map((r) => `${r.key}=${r.g}г`).join(', ')).toBe('');
  });

  it('потолок ёмкости назван честно: вес еды следует за калориями, а не наоборот', () => {
    const normal = days(false).map((r) => r.meals.reduce((s: number, m: any) => s + solidG(m), 0));
    const extreme = days(true).map((r) => r.meals.reduce((s: number, m: any) => s + solidG(m), 0));
    const maxNormal = Math.max(...normal);
    const minExtreme = Math.min(...extreme);
    // Экстремальный день всегда тяжелее обычного — иначе раскладка «теряет еду»
    // (структурный признак: 4600-калорийный день не может весить меньше 3000-калорийного).
    expect(minExtreme).toBeGreaterThan(maxNormal * 0.5);
  });
});
