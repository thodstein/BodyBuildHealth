import { describe, it, expect } from 'vitest';
import { reconcileDay, reconMaxDev, type ReconMeal } from '../planner-day-reconciler';

// E0 (PRO-план §3): финальный reconciliation-pass продуктового дня.
// Чистая функция: двигает граммы flex-пунктов на сетке, минимизируя max-отклонение.

const mk = (id: string, role: string, amount: number, p: number, f: number, c: number): any =>
  ({ id, role, amount, p, f, c, kcal: Math.round(4 * p + 9 * f + 4 * c) });

const sum = (meals: ReconMeal[]): { kcal: number; p: number; f: number; c: number } =>
  meals.reduce((a, m) => { for (const it of m.items) { a.kcal += it.kcal || 0; a.p += it.p || 0; a.f += it.f || 0; a.c += it.c || 0; } return a; }, { kcal: 0, p: 0, f: 0, c: 0 });

describe('E0: reconnectDay (чистая функция)', () => {
  it('сводит белок-перебор + углевод-недобор к меньшему max-dev', () => {
    const meals: ReconMeal[] = [{ type: 'lunch', items: [
      mk('chicken', 'protein', 200, 46, 7, 0),   // 46P
      mk('rice', 'carb_slow', 100, 7, 1, 78),    // 78C
    ] }];
    const targets = { kcal: 600, p: 30, f: 20, c: 100 };
    const before = reconMaxDev(sum(meals), targets);
    const r = reconcileDay(meals, targets, { snap: (_it, g) => Math.round(g / 5) * 5, maxIter: 6 });
    expect(r.devPct).toBeLessThan(before);
    expect(r.devPct).toBe(reconMaxDev(sum(r.meals), targets)); // devPct = факт
  });

  it('не мутирует вход', () => {
    const meals: ReconMeal[] = [{ type: 'lunch', items: [mk('chicken', 'protein', 200, 46, 7, 0), mk('rice', 'carb_slow', 100, 7, 1, 78)] }];
    const snap = JSON.stringify(meals);
    reconcileDay(meals, { kcal: 600, p: 30, f: 20, c: 100 }, { snap: (_it, g) => Math.round(g / 5) * 5 });
    expect(JSON.stringify(meals)).toBe(snap);
  });

  it('protected-типы (intra) не трогаются', () => {
    const meals: ReconMeal[] = [
      { type: 'intra', items: [mk('amylopectin', 'liquid', 30, 0, 0, 27)] },
      { type: 'lunch', items: [mk('chicken', 'protein', 200, 46, 7, 0)] },
    ];
    const r = reconcileDay(meals, { kcal: 300, p: 30, f: 10, c: 20 }, { protectTypes: ['intra'], snap: (_it, g) => Math.round(g / 5) * 5 });
    expect(r.meals[0].items[0].amount).toBe(30);
  });

  it('укол-окно (_insulinWindow) защищено', () => {
    const meals: ReconMeal[] = [{ type: 'snack', _insulinWindow: true, items: [mk('rice', 'carb_slow', 100, 7, 1, 78)] }];
    const r = reconcileDay(meals, { kcal: 1000, p: 100, f: 50, c: 500 }, { snap: (_it, g) => Math.round(g / 5) * 5 });
    expect(r.meals[0].items[0].amount).toBe(100);
  });

  it('цельный белок основного приёма не ниже пола (75 г)', () => {
    const meals: ReconMeal[] = [{ type: 'lunch', items: [
      mk('chicken', 'protein', 300, 69, 10, 0),
      mk('rice', 'carb_slow', 50, 3, 0, 39),
    ] }];
    const r = reconcileDay(meals, { kcal: 200, p: 10, f: 3, c: 10 }, { mainProteinFloor: 75, snap: (_it, g) => Math.round(g / 5) * 5 });
    const chicken = r.meals[0].items.find(i => i.id === 'chicken')!;
    expect(chicken.amount).toBeGreaterThanOrEqual(75);
  });

  it('пустая/нулевая цель — no-op', () => {
    const meals: ReconMeal[] = [{ type: 'lunch', items: [mk('a', 'protein', 100, 20, 5, 0)] }];
    const r = reconcileDay(meals, { kcal: 0, p: 0, f: 0, c: 0 });
    expect(r.adjusted).toBe(false);
    expect(r.devPct).toBe(0);
  });

  it('E14: growCap получает приём и уважает бюджет тарелки (третий аргумент)', () => {
    // Чисто-углеводный носитель (без белка/жира) — единственная ось роста: углеводы.
    const meals: ReconMeal[] = [{ type: 'lunch', items: [mk('rice', 'carb_slow', 100, 0, 0, 78)] }];
    const targets = { kcal: 600, p: 0, f: 0, c: 220 };
    const r = reconcileDay(meals, targets, {
      snap: (_it, g) => Math.max(0, Math.round(g / 5) * 5),
      growCap: (_it, _role, meal) => {
        // бюджет тарелки: рост только в комнату приёма (мелкий тест-аналог 700 г).
        // Без третьего аргумента (meal) комната считалась бы от пустого приёма и
        // лимит не сработал бы — лок ловит именно это.
        const solid = (meal?.items || []).reduce((s, x) => s + (x.amount || 0), 0);
        return 100 + Math.max(0, 150 - solid);
      },
    });
    const rice = r.meals[0].items[0];
    expect(rice.amount).toBeGreaterThan(100);   // рост состоялся
    expect(rice.amount).toBeLessThanOrEqual(150); // упёрся в бюджет тарелки приёма
  });
});
