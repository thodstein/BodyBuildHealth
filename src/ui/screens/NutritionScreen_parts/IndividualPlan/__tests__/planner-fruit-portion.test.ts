import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * §8.59 «фрукт — порция, а не украшение» (стадия `fruitPortionFloor`, по умолчанию ВКЛ).
 *
 * Дефект (замер 60 дней, 10 профилей × 4/5/6 приёмов × трен/отдых): 87 пунктов фрукта
 * меньше 80 г, из них 49 — меньше 40 г («яблоко 20 г», «малина 38 г»). Правило
 * владельца «порции не ниже это еда» нарушено, а ось «порции» (вес 0.18 в оценке дня)
 * считает такой пункт не-едой.
 *
 * Фикс — обмен ВНУТРИ приёма, а не новый пункт и не новый приём:
 *  1) фрукт растёт до 80 г, гарнир того же приёма ужимается ровно на столько же
 *     УГЛЕВОДОВ — КБЖУ дня не двигаются (`apple 20→80`, `potato 138→84`, день −2 ккал);
 *  2) если гарнира в приёме нет (сыворотка + 38 г малины) — фрукт растёт «чисто», и
 *     решение принимает канон дня: короткий день от этого только ближе к цели, а день
 *     «в нуле» правка откатывает сама.
 *
 * Гейты те же, что у §8.57: рецептурный контур, HV-дни, болюс-дни — свои проходы.
 * Предсон не трогается: там фрукт — мелатонин-порция 50 г по дизайну, а не еда.
 *
 * Замер (60 дней): фрукт <80 г 87 → 74, фрукт <40 г 49 → 39, средняя оценка дня
 * 91.30 → 91.50, потерь балла 0, дней вне канона 5 → 5, число приёмов и состав
 * приёмов не меняются (новых пунктов стадия не создаёт).
 * Замер на матрице QG11 (30 дней): фрукт <80 г 26 → 12, ось «порции» 89 → 94.
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
  fruitPortionFloor: on,
  // §8.74 (огрызок — не порция) включается отдельно и имеет свой замок
  // (`planner-fruit-crumb.test.ts`): в «без стадии» варианте §8.59 крошка остаётся —
  // иначе §8.74 её уберёт, и A/B перестанет быть сравнением одной стадии.
  fruitCrumb74: false,
} as unknown as MealPlanInput);

const crumbs = (pl: any) => (pl.meals || []).flatMap((m: any) => ((m.items || []) as any[])
  .filter((i: any) => String(i.role) === 'fruit' && !i._fixedGrams && (Number(i.amount) || 0) > 0 && (Number(i.amount) || 0) < 80)
  .map((i: any) => `${m.type}:${i.id}=${i.amount}`));

const cells = (on: boolean) => PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p.id}/${mc}/${tr ? 'тр' : 'отд'}`,
  plan: build(p, mc, tr, on),
}))));

describe('§8.59 фрукт — порция (`fruitPortionFloor`)', () => {
  it('крошки: пунктов фрукта <80 г ≤74 на 60 дней (было 87), и строго меньше, чем без стадии', () => {
    const on = cells(true).flatMap((r) => crumbs(r.plan));
    const off = cells(false).flatMap((r) => crumbs(r.plan));
    expect(off.length).toBeGreaterThan(on.length);
    expect(on.length).toBeLessThanOrEqual(74);
  });

  it('обмен внутри приёма: «яблоко 20 г» становится порцией, день не сдвигается', () => {
    // mid75/4/тр: перекус держал apple 20 г + подложку potato 138 г.
    const p = PROFILES.find((x) => x.id === 'mid75')!;
    const on: any = build(p, 4, true, true);
    const off: any = build(p, 4, true, false);
    const snack = (pl: any) => (pl.meals || []).find((m: any) => String(m.type) === 'snack');
    const appleOn = (snack(on).items || []).find((i: any) => String(i.id) === 'apple');
    const appleOff = (snack(off).items || []).find((i: any) => String(i.id) === 'apple');
    expect(Number(appleOff.amount)).toBeLessThan(80);
    expect(Number(appleOn.amount)).toBeGreaterThanOrEqual(80);
    // Пунктов не прибавилось: обмен, а не новая еда.
    expect((snack(on).items || []).length).toBe((snack(off).items || []).length);
    // День теряет/получает меньше 1% калорий, углеводы и жир — те же.
    expect(Math.abs(Number(on.totals.kcal) - Number(off.totals.kcal))).toBeLessThan(Number(off.totals.kcal) * 0.01);
    expect(Math.abs(Number(on.totals.c) - Number(off.totals.c))).toBeLessThanOrEqual(2);
    expect(Math.abs(Number(on.totals.f) - Number(off.totals.f))).toBeLessThanOrEqual(2);
    expect(on.withinTolerance).not.toBe(false);
  });

  it('предсон не трогается: мелатонин-фрукт остаётся дизайнерской порцией', () => {
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r.plan]));
    const changed: string[] = [];
    for (const row of on) {
      const pick = (pl: any) => ((pl.meals || []).find((m: any) => String(m.type) === 'presleep')?.items || [])
        .map((i: any) => `${i.id}:${i.amount}`).join(',');
      if (pick(row.plan) !== pick(off.get(row.key))) changed.push(row.key);
    }
    expect(changed.join(', ')).toBe('');
  });

  it('ни один день не теряет балл, приёмов не прибавилось, вёдер не прибавилось', () => {
    const on = cells(true);
    const off = new Map(cells(false).map((r) => [r.key, r.plan]));
    const solidG = (m: any) => (m.items || [])
      .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
      .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
    const lost: string[] = [];
    const countChanged: string[] = [];
    const buckets: string[] = [];
    let scoreOn = 0;
    let scoreOff = 0;
    for (const row of on) {
      const before = off.get(row.key);
      const a = Number(before?.qualityScore?.total) || 0;
      const b = Number(row.plan.qualityScore?.total) || 0;
      scoreOn += b;
      scoreOff += a;
      if (b < a) lost.push(`${row.key}: ${a}→${b}`);
      if ((before?.meals || []).length !== (row.plan.meals || []).length) countChanged.push(row.key);
      const nOn = (row.plan.meals || []).filter((m: any) => solidG(m) > 500).length;
      const nOff = (before?.meals || []).filter((m: any) => solidG(m) > 500).length;
      if (nOn > nOff) buckets.push(`${row.key}: ${nOff}→${nOn}`);
    }
    expect(lost.join(', ')).toBe('');
    expect(countChanged.join(', ')).toBe('');
    expect(buckets.join(', ')).toBe('');
    expect(scoreOn).toBeGreaterThanOrEqual(scoreOff);
  });
});
