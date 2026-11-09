/**
 * planner-night-protein-note.test.ts — §8.81: урезанный ночной казеин больше не молчит.
 *
 * Замер 60 дней: 12 дней из 48 с предсоном недобирают больше 5 г (в среднем 16.7 г),
 * и все — HV/болюс-дни. Корень не в сборке ночи (buildPreSleep кладёт творог 250 г под
 * бюджет 44 г — проверено журналом стадий: [build] 250, [converge] 250, [p4b] 250,
 * [p4c-fat] 250, [reconcile] 100), а в reconcileDay: пол ночи считается как «что осталось
 * после ФАКТА других тарелок». На c1500/4/тр перекусы спроектированы на 14 г, но несут
 * 21–29 г — белок приходит попутно с углеводными носителями (bread_rice_cakes 200 г =
 * 14.5 г), и этот перебор съедает казеин ночи (44 → 20 г).
 *
 * Переложить обратно нельзя: якоря других приёмов стоят на порогах порции (egg_white 50 г
 * при полу 40 = 1.1 г), а перебор сидит в гарнирах — срез означает вырезать 250–350 г
 * углеводов из дня, где углеводы уже на пределе вместимости тарелки.
 *
 * Поэтому план не меняется — меняется только честность: дефицит ночи называется вслух.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, preSleepProteinBudget } from '../meal-plan-engine';

const PROFILES: Array<[string, number, number, 'male' | 'female', number, number, number, number]> = [
  ['p500', 110, 90, 'male', 4600, 500, 120, 0],
  ['c1500', 110, 90, 'male', 8370, 300, 130, 1500],
  ['hugeCarb', 100, 82, 'male', 6700, 250, 100, 0],
  ['mass110', 110, 90, 'male', 5200, 260, 120, 0],
  ['normal90', 90, 73, 'male', 3000, 200, 80, 0],
  ['mid75', 75, 61, 'male', 2400, 180, 70, 0],
  ['small60', 60, 49, 'female', 1600, 150, 45, 0],
  ['cutF50', 50, 41, 'female', 1240, 110, 40, 0],
  ['recomp80', 80, 65, 'male', 2200, 200, 60, 0],
  ['keto85', 85, 70, 'male', 2400, 180, 150, 0],
];
type P = (typeof PROFILES)[number];
const carbsFor = (p: P) => p[7] || Math.max(0, Math.round((p[4] - 4 * p[5] - 9 * p[6]) / 4));

const build = (p: P, mc: number, tr: boolean, on = true) => buildDayPlan({
  weightKg: p[1], lbmKg: p[2], bodyFatPct: 18, sex: p[3],
  goalKcal: p[4], goalProteinG: p[5], goalFatG: p[6], goalCarbsG: carbsFor(p),
  mealsCount: mc, isTrainingDay: tr, trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75,
  allowIntraWorkout: true, budget: 'medium', dayOffset: 0, cyclePhase: 'none',
  variety: 'medium', goal: 'maintenance', quality: 'full',
  excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
  ...(on ? {} : { nightNote81: false }),
} as any) as any;

const NIGHT = 'Ночной приём';
const nightNote = (plan: any) => ((plan.notes || []) as string[]).filter((n) => typeof n === 'string' && n.includes(NIGHT));
const presleep = (plan: any) => ((plan.meals || []) as any[]).find((m) => String(m.type) === 'presleep');

const DAYS = PROFILES.flatMap((p) => [4, 5, 6].flatMap((mc) => [true, false].map((tr) => ({
  key: `${p[0]}/${mc}/${tr ? 'тр' : 'отд'}`, p, mc, tr, plan: build(p, mc, tr),
}))));

describe('§8.81 ночной казеин: урезан — скажи вслух', () => {
  it('нота молчит, когда ночь получила свой бюджет', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const ps = presleep(d.plan);
      if (!ps) continue;
      const budget = preSleepProteinBudget(d.p[1]);
      const fact = Number(ps.totals?.p) || 0;
      const upscaled = ((d.plan.notes || []) as string[]).some((n) => typeof n === 'string' && n.includes('Цель белка') && n.includes('pre-sleep'));
      if (!upscaled && budget - fact <= 5 && nightNote(d.plan).length > 0) {
        bad.push(`${d.key}: ночь ${fact.toFixed(1)}/${budget}, а нота есть`);
      }
    }
    expect(bad.join(', ')).toBe('');
  });

  it('нота называет цифры и звучит, когда дефицит больше 5 г', () => {
    const bad: string[] = [];
    let noted = 0;
    for (const d of DAYS) {
      const ps = presleep(d.plan);
      if (!ps) continue;
      const budget = preSleepProteinBudget(d.p[1]);
      const fact = Number(ps.totals?.p) || 0;
      const upscaled = ((d.plan.notes || []) as string[]).some((n) => typeof n === 'string' && n.includes('Цель белка') && n.includes('pre-sleep'));
      if (upscaled || budget - fact <= 5) continue;
      const notes = nightNote(d.plan);
      if (notes.length === 0) { bad.push(`${d.key}: ${fact.toFixed(1)}/${budget} без ноты`); continue; }
      noted++;
      const n = String(notes[0]);
      if (!n.includes(String(Math.round(budget))) || !/г белка вместо/.test(n)) {
        bad.push(`${d.key}: нота без цифр — ${n.slice(0, 60)}`);
      }
    }
    expect(bad.join(', ')).toBe('');
    expect(noted).toBeGreaterThanOrEqual(8);
  });

  it('нота не меняет план: те же макросы, те же приёмы, та же оценка', () => {
    const bad: string[] = [];
    for (const d of DAYS) {
      const off = build(d.p, d.mc, d.tr, false);
      const near = (a: any, b: any) => Math.abs(Number(a || 0) - Number(b || 0)) < 1e-9;
      if (!near(off.totals?.kcal, d.plan.totals?.kcal) || !near(off.totals?.p, d.plan.totals?.p)
        || !near(off.totals?.f, d.plan.totals?.f) || !near(off.totals?.c, d.plan.totals?.c)) {
        bad.push(`${d.key}: макросы разошлись`);
      }
      if (Number(off.qualityScore?.total) !== Number(d.plan.qualityScore?.total)) bad.push(`${d.key}: оценка разошлась`);
      if (((off.meals || []) as any[]).length !== ((d.plan.meals || []) as any[]).length) bad.push(`${d.key}: число приёмов разошлось`);
    }
    expect(bad.join(', ')).toBe('');
  });
});
