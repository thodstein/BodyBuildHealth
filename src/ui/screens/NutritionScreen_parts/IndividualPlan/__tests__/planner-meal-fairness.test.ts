import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

/**
 * QG52 «голодный приём — это не еда» (§8.51 аудита) — барьер + замок стадии.
 *
 * Замер ДО стадии (10 профилей × 4/5/6 приёмов × трен/отдых = 60 дней, свободный
 * pro-режим): **12 приёмов в 8 днях** заканчивались «не едой» — меньше половины СВОЕЙ
 * цели по ккал либо меньше 150 ккал при недоборе заметнее 10 %:
 *   c1500/4 тр — «Перекус 3» 108 ккал при цели 453;
 *   c1500/4 отд — «Перекус 5» 310 из 557;
 *   small60/4 тр — перекус 48 из 169;
 *   small60/6 тр — обед 151 из 291;
 *   cutF50/5 тр — завтрак 146 из 288, ужин 118 из 252;
 *   cutF50/5 отд — обед 179 из 382;
 *   cutF50/6 тр — завтрак 104 из 260;
 *   cutF50/6 отд — перекус 145 из 152, ужин 145 из 240.
 *
 * Стадия (`applyMealFairness`): часть гибкого углеводного носителя снимается с приёма,
 * перекормленного относительно СВОЕЙ цели, и отдаётся голодному. Перенос
 * **пропорциональный** — плотность позиции сохраняется, калории/Б/Ж/У дня не меняются.
 *
 * Замер ПОСЛЕ стадии (те же 60 дней): «не еды» **12 → 4** (дней 8 → 3), средняя оценка
 * **90.92 → 91.25**, ось белка по приёмам 79.0 → 80.7, порции 89.4 → 89.5, канон 3 %
 * не изменился ни в одной клетке, ни один день не потерял балл. Остаток — тонкие дни
 * 50 кг / 1240 ккал и mid75/6 тр, где донора с избытком нет (долг корректора).
 *
 * Рецептурный контур: стадия вызывается ПОСЛЕ посадки блюд (`assembleRecipeDay`),
 * иначе выравнивание меняет выбор рецептов и сходимость уезжает (замер: plain 2600
 * 2.6 % → 4.4 % при локе ≤4 %) — см. `planner-meal-fairness-recipe.test.ts`.
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

const MAIN = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'snack2', 'snack3', 'snack4', 'snack5', 'snack6']);

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

const tgtKcal = (m: any) => (m?.target ? 4 * (m.target.p || 0) + 9 * (m.target.f || 0) + 4 * (m.target.c || 0) : 0);

/** «Не еда»: меньше половины своей цели ЛИБО <150 ккал при недоборе заметнее 10 %. */
const starvingMeals = (plan: any): string[] => (plan.meals || [])
  .filter((m: any) => MAIN.has(String(m.type)) && tgtKcal(m) > 0 && (m.totals?.kcal || 0) > 0)
  .filter((m: any) => {
    const k = Number(m.totals.kcal) || 0;
    const t = tgtKcal(m);
    return k < t * 0.5 || (k < 150 && k < t * 0.9);
  })
  .map((m: any) => `${m.type}:${Math.round(m.totals.kcal)}/${Math.round(tgtKcal(m))}`);

const dev = (plan: any, p: typeof PROFILES[number]) => {
  const t = plan.totals || {};
  const c = carbsFor(p);
  return Math.max(
    Math.abs((t.kcal || 0) - p.k) / p.k,
    Math.abs((t.p || 0) - p.p) / p.p,
    Math.abs((t.f || 0) - p.f) / p.f,
    c > 0 ? Math.abs((t.c || 0) - c) / c : 0,
  ) * 100;
};

const MATRIX = (() => {
  const rows: Array<{ key: string; starving: string[]; dev: number; score: number }> = [];
  for (const p of PROFILES) {
    for (const mc of [4, 5, 6]) {
      for (const tr of [true, false]) {
        const plan = build(p, mc, tr);
        rows.push({
          key: `${p.id}/${mc}/${tr ? 'tr' : 'rest'}`,
          starving: starvingMeals(plan),
          dev: dev(plan, p),
          score: Number(plan.qualityScore?.total) || 0,
        });
      }
    }
  }
  return rows;
})();

describe('QG52: «голодный приём» — барьер и замок стадии', () => {
  it('60 дней: неприёмов-«не еда» не больше 4 (было 12), и они известны поимённо', () => {
    const bad = MATRIX.filter((r) => r.starving.length > 0);
    const total = bad.reduce((s, r) => s + r.starving.length, 0);
    const dump = bad.map((r) => `${r.key}: ${r.starving.join(' ')}`).join(' | ');
    // Замер 2026-11 до стадии: 12 неприёмов в 8 днях. После стадии — 4 в 3 днях
    // (тонкие дни 50 кг / 1240 ккал и mid75/6 тр: донора с избытком нет).
    expect(total, dump).toBeLessThanOrEqual(4);
    expect(bad.length, dump).toBeLessThanOrEqual(3);
  });

  it('генератор при этом не теряет канон: не больше 6 дней вне 3 % (структурные)', () => {
    const fails = MATRIX.filter((r) => r.dev > 3).map((r) => `${r.key}:${r.dev.toFixed(1)}%`).sort();
    // Структурные провалы (потолок ёмкости): hugeCarb ×3, small60/4 тр, recomp80/6 тр, keto85/4 тр.
    expect(fails.length, fails.join(', ')).toBeLessThanOrEqual(6);
  });

  it('средняя оценка 60 дней не ниже 90.9 (замер 90.92)', () => {
    const avg = MATRIX.reduce((s, r) => s + r.score, 0) / MATRIX.length;
    expect(avg, `avg ${avg.toFixed(2)}`).toBeGreaterThanOrEqual(90.9);
  });

  it('детерминизм: повторный прогон даёт тот же набор «не еды»', () => {
    const again: string[] = [];
    for (const p of PROFILES) {
      const plan = build(p, 4, true);
      again.push(...starvingMeals(plan).map((x) => `${p.id}:${x}`));
    }
    const first: string[] = [];
    for (const p of PROFILES) {
      const plan = build(p, 4, true);
      first.push(...starvingMeals(plan).map((x) => `${p.id}:${x}`));
    }
    expect(again).toEqual(first);
  });
});
