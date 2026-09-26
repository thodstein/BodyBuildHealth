/**
 * combat-e1-budget-constants.test.ts — локи именованных констант бюджета (E1.6).
 *
 * Смысл теста: числа бюджета стояли инлайном (0.08 / 12 / 2 / 3 / 100) и
 * менялись «на глаз». Теперь они названы, и этот файл не даёт им снова
 * разъехаться с движком и не дать движку вернуть себе магические числа.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COND_MIN_TO_SET, SET_EQ_COND_MIN, MIN_WEEKLY_SET_BUDGET, MIN_SETS_PER_EXERCISE,
  MAX_TRIM_PASSES_PER_EX, MAX_TRIM_ITERATIONS,
  conditioningSetCost, effectiveWeeklySetBudget,
} from '../combat-budget-constants';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';

const builderSrc = readFileSync(join(process.cwd(), 'src/engines/combat/combat-builder.engine.ts'), 'utf8');

describe('E1.6.1 — константы имеют смысл и взаимную согласованность', () => {
  it('перевод минуты кондиционирования в сет непротиворечив', () => {
    expect(COND_MIN_TO_SET).toBeCloseTo(1 / SET_EQ_COND_MIN, 1);
    // документированное правило: ~12 мин зоны-2 ≈ 1 сет
    expect(SET_EQ_COND_MIN).toBeGreaterThanOrEqual(12);
  });

  it('пол бюджета положителен, минимумы не вырождены', () => {
    expect(MIN_WEEKLY_SET_BUDGET).toBeGreaterThan(0);
    expect(MIN_SETS_PER_EXERCISE).toBe(2);
    expect(MAX_TRIM_PASSES_PER_EX).toBeGreaterThan(0);
    expect(MAX_TRIM_ITERATIONS).toBeGreaterThan(MAX_TRIM_PASSES_PER_EX);
  });

  it('каждая константа задокументирована — есть пометка об источнике', () => {
    const src = readFileSync(join(process.cwd(), 'src/engines/combat/combat-budget-constants.ts'), 'utf8');
    // инженерные числа честно помечены как не-измерения
    expect(src).toMatch(/ИНЖЕНЕРНАЯ КОНСТАНТА/);
    expect(src).toMatch(/не измерение/);
    // и явно сказано, что научные пороги живут отдельно
    expect(src).toContain('combat-science.ts');
  });
});

describe('E1.6.2 — расчёт стоимости кондиционирования', () => {
  it('минуты переводятся в сет по канону', () => {
    expect(conditioningSetCost([{ durationMin: 100 }])).toBe(8);
    expect(conditioningSetCost([])).toBe(0);
    expect(conditioningSetCost(null as any)).toBe(0);
  });

  it('битые записи не роняют расчёт', () => {
    expect(conditioningSetCost([null, undefined, { durationMin: null }] as any)).toBe(0);
    expect(conditioningSetCost([{ durationMin: 25 }, {} as any])).toBe(2);
  });

  it('бюджет не проваливается ниже пола', () => {
    expect(effectiveWeeklySetBudget(40, 0)).toBe(40);
    expect(effectiveWeeklySetBudget(40, 10)).toBe(30);
    // кондиционирование съело всё — пол всё равно держит структуру
    expect(effectiveWeeklySetBudget(40, 999)).toBe(MIN_WEEKLY_SET_BUDGET);
  });
});

describe('E1.6.3 — source-guard: магических чисел в билдере больше нет', () => {
  it('в бюджетном блоке нет инлайн-литералов', () => {
    // 0.08 больше не встречается в билдере как константа перевода
    expect(builderSrc).not.toMatch(/\*\s*0\.08/);
    // пол бюджета и минимум сетов — только из канона
    expect(builderSrc).not.toMatch(/Math\.max\(12,/);
    expect(builderSrc).not.toMatch(/allEx\.length \* 3\b/);
    expect(builderSrc).not.toMatch(/if \(idx > 100\)/);
  });

  it('канон реально импортирован, а не объявлен локально', () => {
    expect(builderSrc).toMatch(/from '\.\/combat-budget-constants'/);
    expect(builderSrc).toMatch(/conditioningSetCost/);
    expect(builderSrc).toMatch(/effectiveWeeklySetBudget/);
    expect(builderSrc).toMatch(/MIN_SETS_PER_EXERCISE/);
    expect(builderSrc).toMatch(/MAX_TRIM_ITERATIONS/);
  });
});

describe('E1.6.4 — поведение плана не изменилось', () => {
  it('обычный план: ни одно упражнение не опускается ниже минимума', () => {
    const p = finalizeCombatPlan(buildCombatPlan({
      discipline: 'mma', goal: 'mass', level: 'intermediate', weeks: 6, daysPerWeek: 4, bodyweight: 80,
    } as any));
    for (const wk of p.weeksData) {
      for (const s of wk.sessions) {
        for (const e of s.exercises) {
          if (e.warmupActivator) continue;
          expect(e.sets, `${e.id} в неделю ${wk.week}`).toBeGreaterThanOrEqual(MIN_SETS_PER_EXERCISE);
        }
      }
    }
  });

  it('обрезка не оставляет нулевых упражнений даже при агрессивной кондиции', () => {
    const p = finalizeCombatPlan(buildCombatPlan({
      discipline: 'mma', goal: 'mass', level: 'intermediate', weeks: 6, daysPerWeek: 5,
      bodyweight: 80, conditioningMode: 'hiit', outsideSessions: 8,
    } as any));
    const zero = p.weeksData.flatMap(w => w.sessions.flatMap(s =>
      s.exercises.filter(e => !e.warmupActivator && e.sets < MIN_SETS_PER_EXERCISE).map(e => `${e.id}=${e.sets}`)));
    expect(zero).toEqual([]);
  });
});
