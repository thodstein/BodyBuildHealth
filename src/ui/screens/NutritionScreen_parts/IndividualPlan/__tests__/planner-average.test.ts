/**
 * planner-average.test.ts — B26 (аудит 2026-10).
 *
 * Находка: средние по плану делились на жёстко заданные 3 и 7, поэтому при
 * фактически меньшем числе дней (ошибка генерации, ручное удаление дня) среднее
 * завышалось — пользователь видел «3 000 ккал/день» на плане из 1 дня.
 */
import { describe, it, expect } from 'vitest';
import { avgKcalPerDay } from '../planner-average';

describe('B26: среднее делится на фактическое число дней', () => {
  it('3-дневный план: 6000 ккал / 3 = 2000', () => {
    expect(avgKcalPerDay(6000, 3)).toBe(2000);
  });

  it('7-дневный план: 14000 ккал / 7 = 2000', () => {
    expect(avgKcalPerDay(14000, 7)).toBe(2000);
  });

  it('фактически 1 день из 7: среднее = дневная калорийность (не /7)', () => {
    // РАНЬШЕ: 2000 / 7 = 286 — «среднее» в 7 раз ниже реального дня.
    expect(avgKcalPerDay(2000, 1)).toBe(2000);
  });

  it('фактически 4 дня из 7: делит на 4, а не на 7', () => {
    expect(avgKcalPerDay(8000, 4)).toBe(2000);
  });

  it('нулевое/отрицательное число дней не даёт деления на ноль или Infinity', () => {
    expect(avgKcalPerDay(2000, 0)).toBe(2000);
    expect(avgKcalPerDay(2000, -3)).toBe(2000);
    expect(avgKcalPerDay(2000, NaN as any)).toBe(2000);
    expect(Number.isFinite(avgKcalPerDay(2000, 0))).toBe(true);
  });

  it('мусорная сумма трактуется как 0', () => {
    expect(avgKcalPerDay(NaN as any, 3)).toBe(0);
    expect(avgKcalPerDay(undefined as any, 3)).toBe(0);
  });

  it('дробное число дней усекается вниз (не «полтора дня»)', () => {
    expect(avgKcalPerDay(6000, 2.9)).toBe(3000);
  });
});
