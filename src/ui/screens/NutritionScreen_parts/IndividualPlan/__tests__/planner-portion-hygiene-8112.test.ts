/**
 * planner-portion-hygiene-8112.test.ts — §8.112/§8.114: «ни одного обрезка» И «≤3 % по 4 осям»
 * ОДНОВРЕМЕННО, на обоих путях (авто/профиль и ручной).
 *
 * Требование владельца дословно: «нужно чтоб не было обрезок и было не больше 3% при любых
 * параметрах, абсолютно всегда».
 *
 * Замок держит четыре свойства каждого дня сетки (168 авто + 168 ручных: 45–130 кг ×
 * 3–6 приёмов × тренировка/отдых × cut/maint/mass):
 *  1. **ни одного обрезка** — каждая съедобная позиция не меньше пола своей роли
 *     (белок 40 г, быстрый/медленный белок 20 г, гарнир 30/20 г, жир 5 г, овощ и фрукт
 *     40 г — порог §8.59/§8.74 и оси «порции» оценки качества). Добавки, специи/соусы,
 *     вода и микро-посыпка (`role='other'`: зародыши пшеницы 15–25 г на витамин E)
 *     порциями не считаются — у них нет порога в каноне `MIN_MEANINGFUL_G`;
 *  2. все четыре оси (ккал, Б, Ж, У) — ≤3 %;
 *  3. `starchDoubleStats().small === 0` — ни одного «второго гарнира в малом виде»;
 *  4. граммы целые (обещание «ни одного дробного грамма» в плане).
 *
 * Замер после §8.114 (эта сетка, фактический прогон):
 *  • авто: 168/168 дней собраны, обрезков **0** (v4.2: 2; до стадий — 135 в 82 днях),
 *    дней вне канона **0** — пограничный 130/3/R/mass даёт ровно 3.00 % (это «не больше 3 %»,
 *    он стоял в базе и до стадий);
 *  • ручной: 168/168, обрезков **0** (v4.2: 4), вне канона **0**;
 *  • `smallSum` **0** в обоих путях; дробных граммов нет.
 *
 * Историю §8.112 (гигиена порций, замена «порошок → творог») см. в аудите
 * docs/NUTRITION-PLANNER-QUALITY-AUDIT-2026-10.md. Три остатка v4.2 (овсянка 20 г в завтраке,
 * сыворотка 15 г в полднике, барамунди 21 г в предтрене) закрыл §8.114 — «последний рубеж
 * ПОСЛЕ доводки»: обрезок либо дорастает до пола переносом макроса у позиции того же класса
 * с запасом над полом, либо убирается целиком, и день перебалансируется доводчиком
 * («меньше, но крупнее»). Заход принимается только если день остался в каноне по КАЖДОЙ оси;
 * иначе — откат и честная нота «долг §8.114».
 *
 * Поэтому адресный список долга ниже ПУСТ: любой обрезок или любой день вне 3 % валит замок.
 */
import { describe, expect, it } from 'vitest';
import { buildDayPlan, starchDoubleStats, type MealPlanInput } from '../meal-plan-engine';
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

/** Овощ/фрукт: 40 г — «не огрызок» (§8.59/§8.74), а не «полная порция» 60/80 г. */
const PLANT_CRUMB_G = 40;

/**
 * Пол «съедобной порции» по роли. Ноль — позиция не является порцией еды: добавка,
 * специя/соус, вода, микро-посыпка (`other`) и всё, что не является продуктом FOOD_DB.
 */
const minOf = (it: any): number => {
  const role = String(it?.role || '');
  if (!role || role === 'supplement' || role === 'liquid' || role === 'other') return 0;
  // Защищённые позиции (`_fixedGrams`: авторская порция рецепта, микро-добивка) — не порция
  // бюджета дня: гигиена их не трогает, и замок их не судит (§8.59/§8.74).
  if (it && it._fixedGrams) return 0;
  const id = String(it?.id || '');
  const fd: any = FOOD_DB.find((f: any) => String(f.id) === id);
  if (!fd) return 0;
  if (isSauceCondimentFood(fd) || isHerbSpiceId(id)) return 0;
  if (isPureSupplementId(id, fd.category)) return 0;
  // Порошок — «ложка», а не тарелка: пол 20 г независимо от роли (whey в перекусе
  // приходит с role='protein', но 40 г порошка порцией еды не является).
  if (isProteinPowderId(id)) return 20;
  if (role === 'veg' || role === 'fruit') return PLANT_CRUMB_G;
  return Number(MIN_MEANINGFUL_G[role] || 0);
};

type Row = {
  key: string;
  crumbs: string[];
  worst: number;
  worstWhy: string;
  small: number;
  fractional: string[];
};

const buildGrid = (manual: boolean): Row[] => {
  const rows: Row[] = [];
  let i = 0;
  for (const w of [45, 55, 70, 85, 100, 115, 130]) {
    for (const mc of [3, 4, 5, 6]) {
      for (const tr of [true, false]) {
        for (const goal of ['cut', 'maint', 'mass'] as const) {
          const [gp, gf, gc] = GOALS[goal];
          const p = Math.round(w * gp); const f = Math.round(w * gf); const c = Math.round(w * gc);
          const input = {
            weightKg: w, lbmKg: Math.round(w * 0.82), bodyFatPct: 18, sex: 'male',
            goalKcal: atwater(p, f, c), goalProteinG: p, goalFatG: f, goalCarbsG: c,
            mealsCount: mc, isTrainingDay: tr,
            trainStartMin: tr ? 18 * 60 : undefined, trainDurationMin: 75, allowIntraWorkout: true,
            budget: 'medium', dayOffset: i % 7, cyclePhase: 'none', variety: 'medium',
            goal, quality: 'full',
            excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: i % 3,
            ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
          } as unknown as MealPlanInput;
          const plan: any = buildDayPlan(input);
          const t: any = plan.totals || {};
          const key = `${w}/${mc}/${tr ? 'T' : 'R'}/${goal}${manual ? '/manual' : ''}`;
          const axes: [string, number][] = [
            ['ккал', rel(Number(t.kcal), atwater(p, f, c))],
            ['Б', rel(Number(t.p), p)],
            ['Ж', rel(Number(t.f), f)],
            ['У', rel(Number(t.c), c)],
          ];
          const worstAxis = axes.reduce((a, b) => (b[1] > a[1] ? b : a));
          const crumbs: string[] = [];
          const fractional: string[] = [];
          for (const m of plan.meals || []) {
            for (const it of (m.items || [])) {
              const g = Number(it?.amount) || 0;
              if (!Number.isFinite(g) || Math.abs(g - Math.round(g)) > 1e-9) {
                fractional.push(`${key} ${String(it.id)}=${g}`);
              }
              const mn = minOf(it);
              if (mn > 0 && g > 0 && g < mn) crumbs.push(`${key} ${String(it.role)}:${String(it.id)}=${Math.round(g)}<${mn}`);
            }
          }
          rows.push({
            key, crumbs, fractional,
            worst: worstAxis[1], worstWhy: worstAxis[0],
            small: starchDoubleStats((plan.meals || []) as any[]).small,
          });
          i++;
        }
      }
    }
  }
  return rows;
};

const AUTO = buildGrid(false);
const MANUAL = buildGrid(true);

const canonBad = (rows: Row[]) => rows
  .filter((r) => r.worst > 3 + 1e-6)
  .map((r) => `${r.key} ${r.worstWhy} ${r.worst.toFixed(2)}%`);

/**
 * Адресный долг §8.112 (см. шапку). Каждый элемент — ключ дня; всё, что НЕ начинается
 * с одного из этих ключей, — регресс и валит замок.
 *
 * §8.114 закрыл остаток: список ПУСТ. История (v4.2) — авто 2 обрезка в 45/6/R/mass,
 * ручной 4 (45/4/R/cut/manual, 45/6/R/mass/manual, 55/5/R/mass/manual, 55/6/R/mass/manual);
 * на §8.114 все они уходят либо доращиванием до пола, либо «меньше, но крупнее».
 */
const DEBT_AUTO: string[] = [];
const DEBT_MANUAL: string[] = [];

/** Записи вне адресного списка (долг не расширяется). */
const outOfDebt = (entries: string[], allowed: string[]) => entries
  .filter((e) => !allowed.some((k) => e.startsWith(`${k} `)));

const describeDebt = (bad: string[], allowed: string[], cap: number, label: string) => {
  expect(outOfDebt(bad, allowed).join('; '), `${label}: обрезок вне адресного долга`).toBe('');
  expect(bad.length, `${label}: долг вырос (${bad.length} > ${cap}): ${bad.join('; ')}`)
    .toBeLessThanOrEqual(cap);
};

describe('§8.112 гигиена порций: обрезков нет И канон 3% держится (авто-путь)', () => {
  it('сетка собрана целиком', () => {
    expect(AUTO.length).toBe(168);
  });

  it('обрезков нет ни одного', () => {
    const bad = AUTO.flatMap((r) => r.crumbs);
    describeDebt(bad, DEBT_AUTO, 0, 'авто');
  });

  it('все четыре оси каждого дня в пределах 3%', () => {
    const bad = canonBad(AUTO);
    describeDebt(bad, DEBT_AUTO, 0, 'авто/канон');
  });

  it('ни одного второго гарнира в малом виде', () => {
    const bad = AUTO.filter((r) => r.small > 0).map((r) => `${r.key}: ${r.small}`);
    expect(bad.join('; ')).toBe('');
  });

  it('граммы целые', () => {
    expect(AUTO.flatMap((r) => r.fractional).slice(0, 12).join('; ')).toBe('');
  });
});

describe('§8.112 гигиена порций: обрезков нет И канон 3% держится (ручной путь)', () => {
  it('сетка собрана целиком', () => {
    expect(MANUAL.length).toBe(168);
  });

  it('обрезков нет ни одного', () => {
    const bad = MANUAL.flatMap((r) => r.crumbs);
    describeDebt(bad, DEBT_MANUAL, 0, 'ручной');
  });

  it('все четыре оси каждого дня в пределах 3%', () => {
    const bad = canonBad(MANUAL);
    describeDebt(bad, DEBT_MANUAL, 0, 'ручной/канон');
  });

  it('ни одного второго гарнира в малом виде', () => {
    const bad = MANUAL.filter((r) => r.small > 0).map((r) => `${r.key}: ${r.small}`);
    expect(bad.join('; ')).toBe('');
  });

  it('граммы целые', () => {
    expect(MANUAL.flatMap((r) => r.fractional).slice(0, 12).join('; ')).toBe('');
  });
});
