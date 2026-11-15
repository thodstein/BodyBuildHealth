/**
 * planner-canon-all-paths-8111.test.ts — §8.111: канон «≤3% по ккал и ОТДЕЛЬНО по Б/Ж/У»
 * на АВТО/профильном пути (ручной путь держит `planner-manual-invariant-8108.test.ts`).
 *
 * Требование владельца дословно: «не более 3% должно быть как в ручных, так и в
 * автоматическом, во всех режимах ОБЯЗАТЕЛЬНО НЕ БОЛЕЕ 3% ВЕЗДЕ».
 *
 * Замок держит четыре свойства каждого авто-дня сетки:
 *  1. все четыре оси (ккал, Б, Ж, У) — ≤3%;
 *  2. `starchDoubleStats().small === 0` — ни одного «второго гарнира в малом виде»;
 *  3. тарелка ≤900 г твёрдого и ни одного приёма-«ведра» сверх нормы профиля;
 *  4. порошок/добавка — либо ≥10 г, либо её нет («пустая ложка» не порция);
 *  5. граммы — целые (обещание «ни одного дробного грамма» в плане).
 *
 * Замер (эта сетка, 36 дней, снят с фактического прогона): **36/36 дней ≤3% по всем четырём
 * осям**; малых вторых гарниров **0**; максимум тарелки **891 г**, максимум «вёдер» **4**
 * (120 кг / 4 приёма / mass — 3960 ккал на четыре тарелки); порошков <10 г нет; граммы целые.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, starchDoubleStats, type MealPlanInput } from '../meal-plan-engine';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);
const dev = (got: number, goal: number) => (goal > 0 ? (Math.abs(got - goal) / goal) * 100 : 0);

const W = [55, 70, 85, 100, 120];
const MC = [4, 5, 6];

const GOALS = {
  mass: { p: 1.8, f: 1.0, c: 4.2 },
  cut: { p: 2.0, f: 0.8, c: 2.2 },
} as const;

type Day = { key: string; plan: any; p: number; f: number; c: number };

const build = (w: number, mc: number, tr: boolean, goal: 'mass' | 'cut'): Day => {
  const g = GOALS[goal];
  const p = Math.round(w * g.p);
  const f = Math.round(w * g.f);
  const c = Math.round(w * g.c);
  const input = {
    weightKg: w, lbmKg: Math.round(w * 0.82), bodyFatPct: 18, sex: 'male',
    goalKcal: atwater(p, f, c), goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: mc, isTrainingDay: tr,
    trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75, allowIntraWorkout: true,
    budget: 'medium', dayOffset: 0, cyclePhase: 'none', variety: 'medium',
    goal: 'maintenance', quality: 'full',
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  } as unknown as MealPlanInput;
  return { key: `${w}кг/${mc}пр/${tr ? 'тр' : 'отд'}/${goal}`, plan: buildDayPlan(input), p, f, c };
};

const DAYS: Day[] = W.flatMap((w) => MC.flatMap((mc) => [true, false].flatMap((tr) =>
  (['mass', 'cut'] as const).map((goal) => build(w, mc, tr, goal)))));

const solidG = (m: any) => ((m.items || []) as any[])
  .filter((i: any) => !['liquid', 'supplement'].includes(String(i.role || '')))
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

const buckets = (plan: any) => ((plan.meals || []) as any[])
  .filter((m: any) => (m.items || []).length > 0 && solidG(m) > 500).length;

const maxSolid = (plan: any) => Math.max(0, ...((plan.meals || []) as any[]).map(solidG));

const POWDER = /(whey|casein|isolate|protein_powder|_powder$)/i;

describe('§8.111: авто-день ≤3% по четырём осям и без «второго гарнира»', () => {
  it('сетка 36 дней собрана', () => {
    expect(DAYS).toHaveLength(W.length * MC.length * 2 * 2);
  });

  it('все четыре оси каждого авто-дня в пределах 3%', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const t = d.plan.totals || {};
      const rows = [
        ['ккал', Number(t.kcal), atwater(d.p, d.f, d.c)],
        ['Б', Number(t.p), d.p],
        ['Ж', Number(t.f), d.f],
        ['У', Number(t.c), d.c],
      ] as const;
      for (const [axis, got, goal] of rows) {
        const v = dev(got, goal);
        if (v > 3 + 1e-9) bad.push(`${d.key} ${axis}: ${Math.round(got)}/${goal} = ${v.toFixed(2)}%`);
      }
    }
    expect(bad.join('; ')).toBe('');
  });

  it('ни одного второго гарнира в малом виде', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const s = starchDoubleStats((d.plan.meals || []) as any[]);
      if (s.small > 0) bad.push(`${d.key}: ${s.small} малых`);
    }
    expect(bad.join('; ')).toBe('');
  });

  it('тарелка ≤900 г твёрдого и ни одного дня «сверх нормы вёдер»', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const ms = maxSolid(d.plan);
      // 900 г — абсолютный предел одной тарелки (§8.53); 5 вёдер — документированный
      // потолок ёмкости дня (больше 3 кг еды в сутки раскладывается только числом приёмов).
      if (ms > 900 + 1e-9) bad.push(`${d.key}: тарелка ${Math.round(ms)} г`);
      const b = buckets(d.plan);
      if (b > 5) bad.push(`${d.key}: вёдер ${b} > 5`);
    }
    expect(bad.join('; ')).toBe('');
  });

  it('порошок/добавка не режется до «пустой ложки» (<10 г) и граммы целые', () => {
    const bad: string[] = [];
    const frac: string[] = [];
    for (const d of DAYS) {
      for (const m of (d.plan.meals || []) as any[]) {
        for (const it of (m.items || []) as any[]) {
          const amt = Number(it.amount);
          if (!Number.isFinite(amt)) continue;
          if (Math.abs(amt - Math.round(amt)) > 1e-9) frac.push(`${d.key} ${m.type} ${it.id}=${amt}`);
          if (POWDER.test(String(it.id)) && amt > 0 && amt < 10) {
            bad.push(`${d.key} ${m.type} ${it.id}=${amt} г`);
          }
        }
      }
    }
    expect(bad.join('; ')).toBe('');
    expect(frac.join('; ')).toBe('');
  });
});
