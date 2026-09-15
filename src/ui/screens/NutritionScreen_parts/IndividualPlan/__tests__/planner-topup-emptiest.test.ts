import { describe, it, expect } from 'vitest';
import { correctDayToTargets, type CorrectorMeal } from '../day-target-corrector';

// Lock-тест P0-1b «топ-ап в самый пустой» (план §3, критерий §5):
// полный обед (≥100% своей ккал-цели) не получает топапов — углеводный
// недобор дня закрывается в недолитом перекусе, а не в сытом обеде
// (регресс-класс «батат 330 в полный обед при пустом полднике»).
const lunchCarbs = (m: CorrectorMeal) =>
  (m.items || []).filter((x: any) => x.role === 'carb_slow' || x.role === 'carb_fast')
    .reduce((s: number, x: any) => s + (x.c || 0), 0);

describe('P0-1b топ-ап в самый пустой приём', () => {
  it('обед ≥100% не получает топапов, недобор 42У едет в голодный перекус', () => {
    const lunch: CorrectorMeal = {
      label: 'Обед', type: 'lunch',
      items: [
        { id: 'chicken_breast', name: 'Курица', amount: 120, kcal: 132, p: 27.6, f: 1.4, c: 0, fiber: 0, role: 'protein' },
        { id: 'rice_white', name: 'Рис', amount: 150, kcal: 516, p: 10, f: 1, c: 117, fiber: 1.5, role: 'carb_slow' },
      ],
      totals: { kcal: 648, p: 37.6, f: 2.4, c: 117, fiber: 1.5 },
      // цель 608 ккал → share 648/608 = 1.07 (сытый)
      target: undefined as any,
    } as any;
    (lunch as any).target = { p: 30, c: 95, f: 12 };
    const snack: CorrectorMeal = {
      label: 'Перекус', type: 'snack',
      items: [
        { id: 'whey_protein', name: 'Сыворотка', amount: 20, kcal: 80, p: 16, f: 1, c: 2, fiber: 0, role: 'protein' },
        { id: 'apple', name: 'Яблоко', amount: 100, kcal: 52, p: 0.3, f: 0.2, c: 14, fiber: 2.4, role: 'fruit' },
      ],
      totals: { kcal: 132, p: 16.3, f: 1.2, c: 16, fiber: 2.4 },
      // цель 412 ккал → share 132/412 = 0.32 (голодный)
    } as any;
    (snack as any).target = { p: 15, c: 70, f: 8 };
    const snackCarbsBefore = lunchCarbs(snack);
    const lunchBefore = new Map(lunch.items.map((x: any) => [x.id, x.amount]));
    // День: ккал/белок/жир в цели, углей не хватает 42 г (175 − 133).
    const res = correctDayToTargets([lunch, snack], { kcal: 820, p: 54, f: 4, c: 175 }, {});
    const outLunch = res.meals.find((m) => m.type === 'lunch')!;
    const outSnack = res.meals.find((m) => m.type === 'snack')!;
    // Полный обед не получает топапов: ни новых пунктов, ни роста
    // существующих (срезка перебора белка — отдельная легитимная механика).
    expect(outLunch.items.length, 'в обед доложили пункт').toBe(lunch.items.length);
    for (const it of outLunch.items as any[]) {
      expect(it.amount ?? 0, `пункт обеда ${it.id} вырос`).toBeLessThanOrEqual(lunchBefore.get(it.id) ?? 0);
    }
    // Недобор закрыт в перекусе.
    expect(lunchCarbs(outSnack), 'перекус не добран').toBeGreaterThan(snackCarbsBefore + 5);
  });
});
