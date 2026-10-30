/**
 * planner-deadbest-tracker.test.ts — B31 (аудит 2026-10).
 *
 * Находка: `_deadBest` в `correctDayToTargets` был обычным `Set`, который жил весь
 * прогон дня. Кандидат, отброшенный на ранней итерации («в приёме нет места»,
 * «кап семейства», «порция уже максимум»), оставался запрещённым до конца, хотя
 * следующие итерации меняют граммовки и место освобождается. На плотных днях это
 * давало «кандидатов нет» при наличии подходящей еды.
 *
 * Замок: список живёт поколениями — пока отклонение дня не улучшается, он сохраняется
 * (защита от бесконечного выбора одного и того же продукта), а после улучшения
 * отброшенные кандидаты снова доступны.
 */
import { describe, it, expect } from 'vitest';
import {
  createDeadBestTracker,
  correctDayToTargets,
  deviationPct,
  type CorrectorMeal,
  type DayTargets,
} from '../day-target-corrector';

const it1 = (id: string, name: string, amount: number, p: number, f: number, c: number, fiber = 0, role = 'carb') => ({
  id, name, amount, kcal: Math.round(p * 4 + f * 9 + c * 4), p, f, c, fiber, role,
});

describe('B31: чёрный список «мёртвых» кандидатов не вечный', () => {
  it('сохраняется, пока день НЕ улучшается', () => {
    const dead = createDeadBestTracker();
    dead.add('c:rice_white');
    dead.observeDeviation(12);
    dead.observeDeviation(12);
    dead.observeDeviation(13);
    expect(dead.has('c:rice_white')).toBe(true);
  });

  it('сбрасывается, когда отклонение дня заметно улучшилось', () => {
    const dead = createDeadBestTracker();
    dead.add('c:rice_white');
    dead.add('f:olive_oil');
    dead.observeDeviation(18);
    expect(dead.size()).toBe(2);
    // Итерация реально приблизила день к цели — освободившееся место может подойти
    // продуктам, которые раньше не поместились.
    dead.observeDeviation(11);
    expect(dead.size()).toBe(0);
    expect(dead.has('c:rice_white')).toBe(false);
  });

  it('мелкое колебание (шум) не сбрасывает список', () => {
    const dead = createDeadBestTracker();
    dead.add('c:oats_dry');
    dead.observeDeviation(9);
    dead.observeDeviation(8.99); // улучшение меньше порога 0.05 п.п.
    expect(dead.has('c:oats_dry')).toBe(true);
  });

  it('NaN/Infinity от тоталов не ломают сброс', () => {
    const dead = createDeadBestTracker();
    dead.add('c:rice_white');
    dead.observeDeviation(Number.NaN);
    dead.observeDeviation(Number.POSITIVE_INFINITY);
    expect(dead.has('c:rice_white')).toBe(true);
    // Первое валидное наблюдение задаёт базу (состояние, в котором продукт отбросили).
    dead.observeDeviation(4);
    expect(dead.has('c:rice_white')).toBe(true);
    // А реальное улучшение после базы — освобождает.
    dead.observeDeviation(3);
    expect(dead.size()).toBe(0);
  });
});

describe('B31: поведение корректора не деградировало', () => {
  const meals = (): CorrectorMeal[] => [
    {
      type: 'breakfast', time: '08:00',
      items: [it1('oats_dry', 'Овсянка', 60, 7.5, 4.2, 37, 6)],
    },
    {
      type: 'lunch', time: '13:00',
      items: [it1('chicken_breast', 'Курица', 150, 34.5, 3, 0, 0, 'protein'), it1('rice_white', 'Рис', 100, 7, 0.6, 78, 1.5)],
    },
    {
      type: 'dinner', time: '19:00',
      items: [it1('beef_lean', 'Говядина', 130, 27, 5, 0, 0, 'protein'), it1('buckwheat', 'Гречка', 90, 11.3, 3, 62, 9)],
    },
  ];

  it('день всё ещё сходится к целям и не становится хуже исходного', () => {
    const start = meals();
    const totals = start.reduce<DayTargets>((acc, m) => ({
      kcal: acc.kcal + m.items.reduce((s, i) => s + i.kcal, 0),
      p: acc.p + m.items.reduce((s, i) => s + i.p, 0),
      f: acc.f + m.items.reduce((s, i) => s + i.f, 0),
      c: acc.c + m.items.reduce((s, i) => s + i.c, 0),
    }), { kcal: 0, p: 0, f: 0, c: 0 });
    const targets: DayTargets = { kcal: 2600, p: 180, f: 70, c: 320 };
    const before = deviationPct(totals, targets);
    const res = correctDayToTargets(start, targets, { weightKg: 80 });
    expect(res.deviationPct).toBeLessThan(before);
    expect(res.meals.length).toBe(start.length);
    // Ни один приём не превратился в пустой список.
    for (const m of res.meals) expect(m.items.length).toBeGreaterThan(0);
  });
});
