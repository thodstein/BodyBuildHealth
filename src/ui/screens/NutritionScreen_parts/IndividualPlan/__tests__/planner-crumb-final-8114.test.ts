/**
 * planner-crumb-final-8114.test.ts — §8.114: «последний рубеж» против обрезков.
 *
 * §8.112 довёл обрезки до адресного списка, но три позиции пережили и гигиену, и
 * доводчик: «Завтрак: oats_dry 20 г» (45/6/T/cut), «Полдник: whey_protein 15 г»
 * (45/4/R/cut/manual), «Пост-трен: whey_isolate 10 г» (45/4/T/mass/manual) и
 * «Предтрен: барамунди 21 г». Их рожали стадии ДО последней мили (срез по капу окна,
 * MPS-добор, срез кап-пасса), поэтому ни `enforcePortionHygiene`, ни `microTuneDay`
 * их не видели.
 *
 * §8.114 работает ПОСЛЕ доводки и убирает обрезок тремя заходами по возрастанию цены:
 *  1) дорастить до пола, забрав макрос у позиции того же класса с запасом над полом;
 *  2) убрать обрезок и отдать перебаланс доводчику (день остаётся собранным);
 *  3) «меньше, но крупнее»: убрать обрезок целиком — макрос дорастает в других позициях.
 * Заход принимается только если день остался в каноне (≤3 % авто / ≤2 % ручной) по КАЖДОЙ
 * оси; иначе откат и честная нота «долг §8.114» (инвариант «≤3 %» дороже формы порции).
 *
 * Замок держит дни-адреса §8.114 и §8.114b и три обещания на каждом:
 *  • ни одной позиции ниже пола своей роли;
 *  • все четыре оси в пределах 3 %;
 *  • граммы целые;
 *  • в плане нет ноты «⚠ Обрезок … (долг §8.114)».
 * Плюс хотя бы на одном из дней видна нота «🔧 Обрезок …» — стадия действительно
 * срабатывает, а не «молчит, потому что обрезков не бывает».
 *
 * Два адреса §8.114b (`45/6/R/mass`, `45/6/R/maint/manual`) — дни, которые после §8.114
 * оставались вне канона БЕЗ обрезков: доводчик упирался в полы/капы, а жирового ножа в
 * пред-сне не было (все масла дня — авторские рецепты). Их держит отдельный `it`.
 */
import { describe, expect, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G } from '../planner-quality-score';
import {
  isHerbSpiceId, isProteinPowderId, isPureSupplementId, isSauceCondimentFood,
} from '../food-availability';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);
const rel = (v: number, t: number) => (t > 0 ? (Math.abs(v - t) / t) * 100 : 0);

const GOALS: Record<'cut' | 'maint' | 'mass', [number, number, number]> = {
  cut: [2.0, 0.8, 2.2],
  maint: [1.8, 1.0, 3.0],
  mass: [1.8, 1.0, 4.2],
};

/** Пол «съедобной порции» (тот же критерий, что у замка §8.112). */
const minOf = (it: any): number => {
  const role = String(it?.role || '');
  if (!role || role === 'supplement' || role === 'liquid' || role === 'other') return 0;
  if (it && it._fixedGrams) return 0;
  const id = String(it?.id || '');
  const fd: any = FOOD_DB.find((f: any) => String(f.id) === id);
  if (!fd) return 0;
  if (isSauceCondimentFood(fd) || isHerbSpiceId(id)) return 0;
  if (isPureSupplementId(id, fd.category)) return 0;
  if (isProteinPowderId(id)) return 20;
  if (role === 'veg' || role === 'fruit') return 40;
  return Number(MIN_MEANINGFUL_G[role] || 0);
};

type Case = { key: string; manual: boolean; w: number; mc: number; tr: boolean; goal: 'cut' | 'maint' | 'mass' };

/** Адреса §8.114: именно здесь оставались обрезки после §8.112 v4.2. */
const CASES: Case[] = [
  { key: '45/6/T/cut', manual: false, w: 45, mc: 6, tr: true, goal: 'cut' },
  { key: '45/5/T/mass', manual: false, w: 45, mc: 5, tr: true, goal: 'mass' },
  { key: '45/4/T/mass/manual', manual: true, w: 45, mc: 4, tr: true, goal: 'mass' },
  { key: '45/4/R/cut/manual', manual: true, w: 45, mc: 4, tr: false, goal: 'cut' },
];

/** Адреса §8.114b: день вне канона БЕЗ обрезков (жир дня заперт авторскими рецептами). */
const CASES_B114B: Case[] = [
  { key: '45/6/R/mass', manual: false, w: 45, mc: 6, tr: false, goal: 'mass' },
  { key: '45/6/R/maint/manual', manual: true, w: 45, mc: 6, tr: false, goal: 'maint' },
];

const build = (c: Case): any => {
  const [gp, gf, gc] = GOALS[c.goal];
  const p = Math.round(c.w * gp); const f = Math.round(c.w * gf); const cc = Math.round(c.w * gc);
  // dayOffset/randomSalt — как в сетке §8.112 (i растёт по порядку w→mc→tr→goal).
  const wi = [45, 55, 70, 85, 100, 115, 130].indexOf(c.w);
  const i = ((wi * 4 + [3, 4, 5, 6].indexOf(c.mc)) * 2 + (c.tr ? 0 : 1)) * 3
    + ['cut', 'maint', 'mass'].indexOf(c.goal);
  const input = {
    weightKg: c.w, lbmKg: Math.round(c.w * 0.82), bodyFatPct: 18, sex: 'male',
    goalKcal: atwater(p, f, cc), goalProteinG: p, goalFatG: f, goalCarbsG: cc,
    mealsCount: c.mc, isTrainingDay: c.tr,
    trainStartMin: c.tr ? 18 * 60 : undefined, trainDurationMin: 75, allowIntraWorkout: true,
    budget: 'medium', dayOffset: i % 7, cyclePhase: 'none', variety: 'medium',
    goal: c.goal, quality: 'full',
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: i % 3,
    ...(c.manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
  } as unknown as MealPlanInput;
  return buildDayPlan(input);
};

const PLANS = [...CASES, ...CASES_B114B].map((c) => ({ c, plan: build(c) }));

const crumbsOf = (plan: any): string[] => {
  const bad: string[] = [];
  for (const m of plan.meals || []) {
    for (const it of (m.items || [])) {
      const g = Number(it?.amount) || 0;
      const mn = minOf(it);
      if (mn > 0 && g > 0 && g < mn) bad.push(`${String(m.type)}:${String(it.id)}=${Math.round(g)}<${mn}`);
    }
  }
  return bad;
};

const axesOf = (c: Case, plan: any) => {
  const [gp, gf, gc] = GOALS[c.goal];
  const p = Math.round(c.w * gp); const f = Math.round(c.w * gf); const cc = Math.round(c.w * gc);
  const t: any = plan.totals || {};
  const axes: Array<[string, number]> = [
    ['ккал', rel(Number(t.kcal), atwater(p, f, cc))],
    ['Б', rel(Number(t.p), p)],
    ['Ж', rel(Number(t.f), f)],
    ['У', rel(Number(t.c), cc)],
  ];
  return axes;
};

describe('§8.114 последний рубеж: обрезков нет на адресных днях', () => {
  it('шесть адресов собраны целиком', () => {
    expect(PLANS).toHaveLength(6);
    for (const { plan } of PLANS) {
      expect((plan.meals || []).length).toBeGreaterThan(0);
    }
  });

  it('ни одной позиции ниже пола своей роли', () => {
    const bad = PLANS.flatMap(({ c, plan }) => crumbsOf(plan).map((x) => `${c.key} ${x}`));
    expect(bad.join('; ')).toBe('');
  });

  it('все четыре оси в пределах 3 % (ручные дни — тоже: 2 %-е обещание, 3 %-й канон)', () => {
    const bad: string[] = [];
    for (const { c, plan } of PLANS) {
      for (const [name, v] of axesOf(c, plan)) {
        if (v > 3 + 1e-6) bad.push(`${c.key} ${name} ${v.toFixed(2)}%`);
      }
    }
    expect(bad.join('; ')).toBe('');
  });

  it('граммы целые', () => {
    const bad: string[] = [];
    for (const { c, plan } of PLANS) {
      for (const m of plan.meals || []) {
        for (const it of (m.items || [])) {
          const g = Number(it?.amount) || 0;
          if (!Number.isFinite(g) || Math.abs(g - Math.round(g)) > 1e-9) {
            bad.push(`${c.key} ${String(it.id)}=${g}`);
          }
        }
      }
    }
    expect(bad.join('; ')).toBe('');
  });

  it('нет ноты «долг §8.114» — обрезки закрыты, а не отданы в долг', () => {
    const bad = PLANS.flatMap(({ c, plan }) => ((plan.notes || []) as string[])
      .filter((n) => typeof n === 'string' && n.startsWith('⚠ Обрезок'))
      .map((n) => `${c.key}: ${n}`));
    expect(bad.join('; ')).toBe('');
  });

  it('стадия действительно срабатывает: хотя бы один «🔧 Обрезок»', () => {
    const fired = PLANS.flatMap(({ plan }) => ((plan.notes || []) as string[])
      .filter((n) => typeof n === 'string' && n.startsWith('🔧 Обрезок')));
    expect(fired.length).toBeGreaterThanOrEqual(1);
  });

  it('§8.114b: адресные дни доведены канон-ремонтом, «Не сошлось» не висит', () => {
    const b = PLANS.filter(({ c }) => CASES_B114B.includes(c));
    expect(b).toHaveLength(2);
    for (const { c, plan } of b) {
      expect(crumbsOf(plan).join('; '), `${c.key}: обрезок`).toBe('');
      const axes = axesOf(c, plan);
      expect(axes.every(([, v]) => v <= 3 + 1e-6), `${c.key}: ось вне 3 %`).toBe(true);
      const notes = ((plan.notes || []) as string[]).filter((n) => typeof n === 'string');
      // «Не сошлось» / «долг» — витрина не должна объяснять уже исправленный дефект.
      expect(notes.filter((n) => /Не сошлось/.test(n)).join('; '), `${c.key}: витрина врёт`).toBe('');
      expect(notes.filter((n) => n.startsWith('⚠ Обрезок')).join('; '), `${c.key}: долг §8.114`).toBe('');
    }
    // Ремонт обязан быть виден хотя бы на одном из двух дней (иначе день сошёлся сам).
    const repaired = b.flatMap(({ plan }) => ((plan.notes || []) as string[])
      .filter((n) => typeof n === 'string' && n.startsWith('🎯 Канон дня')));
    expect(repaired.length).toBeGreaterThanOrEqual(1);
  });
});
