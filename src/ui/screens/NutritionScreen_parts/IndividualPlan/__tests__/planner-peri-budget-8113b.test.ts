/**
 * planner-peri-budget-8113b.test.ts — §8.113b «пери-окно не строит обрезок».
 *
 * Правило: бюджет белка окна (предтрен/пост-трен) меньше цельной порции — 40 г рыбы/птицы
 * ≈ 9 г белка — значит окно ФИЗИЧЕСКИ не может нести белок: сборка дорисует минимальную
 * порцию, а кап окна срежет её в обрезок («Предтрен: барамунди 21 г < 40», долг v4.2).
 * Такое окно остаётся углеводным, а его граммы передаются основным приёмам (сумма белка
 * дня не меняется).
 *
 * Замер (сетка §8.112, 336 дней): правило срабатывает на 6 днях — 45 кг × 4 приёма ×
 * тренировка × cut/maint/mass — и каждый из них остаётся в каноне (худшая ось 2.44 %).
 *
 * Замок держит ДВЕ вещи на этих днях:
 *  1. правило реально срабатывает — нота «остаются углеводными» есть (иначе §8.113b молча
 *     умер: бюджет обнулили, а сборка всё равно поставила порцию — двойной учёт белка,
 *     см. `usedP`, и это уже не ловилось ни одним замком);
 *  2. день не хуже канона: ≤3 % по каждой оси и ни одного обрезка — в том числе цельной
 *     белковой порции в самом окне (40 г рыбы/птицы = 9 г белка).
 *
 * Второе — про §8.107b: белóк пери-окон в «ужатии суммы бюджетов до цели» НЕ участвует
 * (окно — фиксированный болюс, уже вычтенный из дневной цели через `_regP`). Иначе окно
 * ужималось до пола 8 г, §8.113b обнулял его — и `usedP` расходился с фактической сборкой.
 */
import { describe, expect, it } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { MIN_MEANINGFUL_G } from '../planner-quality-score';
import { isProteinPowderId } from '../food-availability';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const atwater = (p: number, f: number, c: number) => Math.round(4 * p + 9 * f + 4 * c);
const rel = (v: number, t: number) => (t > 0 ? (Math.abs(v - t) / t) * 100 : 0);

const GOALS: Record<'cut' | 'maint' | 'mass', [number, number, number]> = {
  cut: [2.0, 0.8, 2.2],
  maint: [1.8, 1.0, 3.0],
  mass: [1.8, 1.0, 4.2],
};

const minOf = (it: any): number => {
  const role = String(it?.role || '');
  if (!role || role === 'supplement' || role === 'liquid' || role === 'other') return 0;
  if (it && it._fixedGrams) return 0;
  const id = String(it?.id || '');
  const fd: any = FOOD_DB.find((f: any) => String(f.id) === id);
  if (!fd) return 0;
  if (isProteinPowderId(id)) return 20;
  if (role === 'veg' || role === 'fruit') return 40;
  return Number(MIN_MEANINGFUL_G[role] || 0);
};

const isPeri = (m: any) => ['preworkout', 'postworkout', 'intra'].includes(String(m?.type));

const build = (goal: 'cut' | 'maint' | 'mass', manual: boolean): { plan: any; goalKcal: number; p: number; f: number; c: number } => {
  const w = 45, mc = 4, tr = true;
  const [gp, gf, gc] = GOALS[goal];
  const p = Math.round(w * gp); const f = Math.round(w * gf); const c = Math.round(w * gc);
  const input = {
    weightKg: w, lbmKg: Math.round(w * 0.82), bodyFatPct: 18, sex: 'male',
    goalKcal: atwater(p, f, c), goalProteinG: p, goalFatG: f, goalCarbsG: c,
    mealsCount: mc, isTrainingDay: tr,
    trainStartMin: 18 * 60, trainDurationMin: 75, allowIntraWorkout: true,
    budget: 'medium', dayOffset: 0, cyclePhase: 'none', variety: 'medium',
    goal, quality: 'full',
    excludedIds: new Set<string>(), allergenTags: new Set<string>(), randomSalt: 0,
    ...(manual ? { kbjuMode: 'manual', manualTargetsLocked: true } : {}),
  } as unknown as MealPlanInput;
  const plan: any = buildDayPlan(input);
  return { plan, goalKcal: atwater(p, f, c), p, f, c };
};

describe('§8.113b — пери-окно с бюджетом белка меньше цельной порции', () => {
  for (const goal of ['cut', 'maint', 'mass'] as const) {
    for (const manual of [false, true]) {
      const key = `45/4/T/${goal}${manual ? '/manual' : ''}`;

      it(`${key}: окно углеводное, обрезков нет, день в каноне`, () => {
        const { plan, goalKcal, p, f, c } = build(goal, manual);
        const notes: string[] = (plan.notes || []).map(String);
        const t: any = plan.totals || {};
        const dump = `${key}: ${Math.round(t.kcal)}/${Number(t.p).toFixed(1)}/${Number(t.f).toFixed(1)}/${Number(t.c).toFixed(1)} :: `
          + (plan.meals || []).map((m: any) => `${m.type}:${Math.round(Number(m.totals?.kcal) || 0)}`
            + `[${(m.items || []).map((i: any) => `${i.id}:${Math.round(Number(i.amount) || 0)}`).join(',')}]`).join(' | ');

        // 1. Правило сработало и витрина об этом говорит.
        expect(notes.some((n) => n.includes('остаются углеводными')), dump).toBe(true);

        // 2. Ни одного обрезка — прежде всего в самих пери-окнах (цельная порция 40 г
        // рыбы/птицы, порошок 20 г).
        const crumbs: string[] = [];
        for (const m of plan.meals || []) {
          for (const it of m.items || []) {
            const g = Number(it?.amount) || 0;
            const mn = minOf(it);
            if (mn > 0 && g > 0 && g < mn) {
              crumbs.push(`${isPeri(m) ? 'ОКНО ' : ''}${m.type} ${String(it?.role)}:${it.id}=${Math.round(g)}<${mn}`);
            }
          }
        }
        expect(crumbs, dump).toEqual([]);

        // 3. День в каноне по каждой оси.
        const axes: [string, number][] = [
          ['ккал', rel(Number(t.kcal), goalKcal)],
          ['Б', rel(Number(t.p), p)],
          ['Ж', rel(Number(t.f), f)],
          ['У', rel(Number(t.c), c)],
        ];
        for (const [name, dev] of axes) {
          expect(dev, `${key} ${name}: ${dump}`).toBeLessThanOrEqual(3);
        }
      });
    }
  }
});
